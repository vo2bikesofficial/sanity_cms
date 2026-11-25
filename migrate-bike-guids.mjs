import { createClient } from '@sanity/client'
import {
  BIKE_GUID_COUNTER_TYPE,
  bikeGuidCounterId,
  generateBikeGuid,
  isBikeGuidForModel,
  normalizeBikeModel,
} from './lib/bikeGuid.mjs'

const projectId = 'lkeuttht'
const dataset = 'trial'
const apiVersion = '2025-02-19'
const token = process.env.SANITY_API_TOKEN

if (!token) {
	throw new Error('Set SANITY_API_TOKEN to a Sanity API token with dataset write access before migrating.')
}

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false }).withConfig({
	perspective: 'raw',
})

// Drafts and their published document are one bike: they must share a GUID.
const bikes = await client.fetch('*[_type == "bicycle"]{_id, name, slug}')
const groups = new Map()
for (const bike of bikes) {
	const baseId = bike._id.replace(/^drafts\./, '')
	const group = groups.get(baseId) ?? { draft: null, published: null }
	if (bike._id.startsWith('drafts.')) group.draft = bike
	else group.published = bike
	groups.set(baseId, group)
}

const assignments = []
const usedSlugs = new Set()

for (const [baseId, group] of groups) {
	const model = normalizeBikeModel((group.draft ?? group.published)?.name)
	if (!model) {
		console.warn(`Skipping ${baseId}: no bike name`)
		continue
	}

	const currentSlug = (group.published ?? group.draft)?.slug
	let slug = isBikeGuidForModel(currentSlug, model) && !usedSlugs.has(currentSlug) ? currentSlug : null
	if (slug) usedSlugs.add(slug)
	assignments.push({ baseId, model, slug })
}

// Keep the counter at or above the highest number already in use for a model,
// so GUIDs generated below never collide with GUIDs we decided to keep.
for (const { model, slug } of assignments) {
	if (!slug) continue

	const number = Number(slug.slice(slug.lastIndexOf('-') + 1))
	const counterId = bikeGuidCounterId(model)
	await client.createIfNotExists({
		_id: counterId,
		_type: BIKE_GUID_COUNTER_TYPE,
		model,
		counter: 0,
	})
	const current = await client.fetch('*[_id == $id][0].counter', { id: counterId })
	if ((current ?? 0) < number) await client.patch(counterId).set({ counter: number }).commit()
}

for (const assignment of assignments) {
	if (!assignment.slug) assignment.slug = await generateBikeGuid(assignment.model, client)
}

const existingIds = new Set(bikes.map((bike) => bike._id))
for (const { baseId, slug } of assignments) {
	for (const documentId of [baseId, `drafts.${baseId}`]) {
		if (existingIds.has(documentId)) await client.patch(documentId).set({ slug }).commit()
	}
}

console.log(`Migrated ${assignments.length} bicycles to name + counter Bike GUIDs.`)
