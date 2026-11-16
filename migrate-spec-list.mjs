import { createClient } from '@sanity/client'

// One-off migration + cleanup for the retired bicycle fields.
//
//  1. Moves size / weight / frame / groupset / wheels (plus a weight parsed out
//     of the old "Short specification" text) into the "Spec list" array, keeping
//     Size and Weight at the top.
//  2. Drops any "Condition" entry from the spec list — Condition is retired
//     entirely and is not carried over.
//  3. Deletes the retired fields from the documents: category, condition,
//     distance, size, weight, frame, groupset, wheels, specification.
//
// Safe to re-run: spec-list labels that already exist are left alone.
//
//   $env:SANITY_API_TOKEN = '<token with dataset write access>'
//   node migrate-spec-list.mjs
//
// Preview the changes without writing anything (public reads are enough):
//
//   node migrate-spec-list.mjs --dry
const projectId = 'lkeuttht'
const dataset = 'trial'
const apiVersion = '2025-02-19'
const dryRun = process.argv.includes('--dry')
const token = process.env.SANITY_API_TOKEN

if (!token && !dryRun) {
	throw new Error(
		'Set SANITY_API_TOKEN to a Sanity API token with dataset write access, or run with --dry to preview.',
	)
}

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false })

/** Fields removed from the studio schema; their data is deleted after migrating. */
const retiredFields = [
	'category',
	'condition',
	'distance',
	'size',
	'weight',
	'frame',
	'groupset',
	'wheels',
	'specification',
]

const retiredPredicate = retiredFields
	.map((field) => `select(defined(${field}) => "${field}")`)
	.join(', ')

const bicycles = await client.fetch(`*[_type == "bicycle"]{
	_id,
	name,
	specification,
	size,
	weight,
	frame,
	groupset,
	wheels,
	"specList": specList[]{_type, _key, label, value},
	"retired": array::compact([${retiredPredicate}])
}`)

// The retired "Short specification" text still lives on existing documents, so
// its trailing weight (e.g. "9,200 km · 8.6 kg") is used when weight is empty.
const weightFrom = (text) => text?.match(/([\d.,]+\s*kg)/i)?.[1] ?? null

let updated = 0

for (const bike of bicycles) {
	const stored = bike.specList ?? []
	// Condition is retired outright, so drop it from the list as well.
	const existing = stored.filter((item) => item.label?.trim().toLowerCase() !== 'condition')
	const droppedCondition = existing.length !== stored.length
	const seen = new Set(existing.map((item) => item.label?.trim().toLowerCase()))

	const legacy = [
		['Size', bike.size],
		['Weight', bike.weight || weightFrom(bike.specification)],
		['Frame', bike.frame],
		['Groupset', bike.groupset],
		['Wheels', bike.wheels],
	]
		.filter(
			([label, value]) =>
				typeof value === 'string' && value.trim() && !seen.has(label.toLowerCase()),
		)
		.map(([label, value]) => ({
			_type: 'bicycleSpec',
			_key: `legacy-${label.toLowerCase()}`,
			label,
			value,
		}))

	const rewriteList = legacy.length > 0 || droppedCondition
	const purge = bike.retired

	if (!rewriteList && purge.length === 0) {
		console.log(`${bike.name}: already clean`)
		continue
	}

	// Keep the stored item shape (type + key) so untouched entries survive intact.
	const specList = [...legacy, ...existing].map((item, index) => ({
		_type: item._type ?? 'bicycleSpec',
		_key: item._key ?? `spec-${index}`,
		label: item.label,
		value: item.value,
	}))

	const changes = [
		legacy.length > 0 ? `added ${legacy.map((item) => item.label).join(', ')}` : null,
		droppedCondition ? 'removed Condition' : null,
		purge.length > 0 ? `deleted ${purge.join(', ')}` : null,
	].filter(Boolean)

	if (dryRun) {
		console.log(`[dry] ${bike.name}: ${changes.join('; ')}`)
		continue
	}

	let mutation = client.patch(bike._id)
	if (rewriteList) mutation = mutation.set({ specList })
	if (purge.length > 0) mutation = mutation.unset(purge)
	await mutation.commit()
	console.log(`${bike.name}: ${changes.join('; ')}`)
	updated += 1
}

console.log(
	dryRun
		? `\nDry run — ${bicycles.length} bicycles checked, nothing written.`
		: `\nUpdated ${updated} of ${bicycles.length} bicycles.`,
)
