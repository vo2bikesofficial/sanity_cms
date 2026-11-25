import { readFile, stat } from 'node:fs/promises'
import { createClient } from '@sanity/client'
import { generateBikeGuid, isBikeGuidForModel, normalizeBikeModel } from './lib/bikeGuid.mjs'

const projectId = 'lkeuttht'
const dataset = 'trial'
const apiVersion = '2025-02-19'
const token = process.env.SANITY_API_TOKEN

if (!token) {
	throw new Error('Set SANITY_API_TOKEN to a Sanity API token with dataset write access before importing.')
}

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false })
const [areaSeeds, bicycleSeeds] = await Promise.all([
	readFile(new URL('./data/inspection-areas.json', import.meta.url), 'utf8').then(JSON.parse),
	readFile(new URL('./data/bicycles.json', import.meta.url), 'utf8').then(JSON.parse),
])

const areaCaps = new Map(areaSeeds.map((area) => [area.key, area.maxPoints]))
const maximumTotal = [...areaCaps.values()].reduce((sum, points) => sum + points, 0)

if (maximumTotal !== 100) throw new Error(`Inspection area maximums must total 100; got ${maximumTotal}.`)

// Images are seeded from local files in data/images/, referenced by filename
// from data/bicycles.json, and uploaded to Sanity as image assets.
const imageDir = new URL('./data/images/', import.meta.url)
const imageContentTypes = new Map([
	['jpg', 'image/jpeg'],
	['jpeg', 'image/jpeg'],
	['png', 'image/png'],
	['webp', 'image/webp'],
	['avif', 'image/avif'],
	['gif', 'image/gif'],
	['svg', 'image/svg+xml'],
	['tif', 'image/tiff'],
	['tiff', 'image/tiff'],
])

async function isImageFile(filename) {
	try {
		return (await stat(new URL(filename, imageDir))).isFile()
	} catch {
		return false
	}
}

const missingImages = new Set()

for (const bike of bicycleSeeds) {
	if (!normalizeBikeModel(bike.name)) throw new Error('Every bicycle must have a name.')
	if (!Number.isInteger(bike.price) || bike.price < 0) {
		throw new Error(`${bike.name} has an invalid selling price.`)
	}
	if (bike.newBikePrice != null && (!Number.isInteger(bike.newBikePrice) || bike.newBikePrice < 0)) {
		throw new Error(`${bike.name} has an invalid new bike price.`)
	}
	const files = [bike.image, ...bike.gallery]
	for (const file of files) {
		if (typeof file !== 'string' || /[/\\]|\.\./.test(file)) {
			throw new Error(`${bike.name} image entries must be plain filenames inside data/images/.`)
		}
		if (!imageContentTypes.has(file.split('.').pop()?.toLowerCase())) {
			throw new Error(`${bike.name} references "${file}", which is not a supported image file.`)
		}
		if (!(await isImageFile(file))) missingImages.add(file)
	}
	if (bike.gallery.length < 3 || new Set(bike.gallery).size !== bike.gallery.length) {
		throw new Error(`${bike.name} needs at least three unique gallery images.`)
	}
	if (bike.inspectionScores.length !== areaCaps.size) throw new Error(`${bike.name} must score every inspection area.`)
	if (new Set(bike.inspectionScores.map((score) => score.areaKey)).size !== areaCaps.size) {
		throw new Error(`${bike.name} must have exactly one score per inspection area.`)
	}
	for (const score of bike.inspectionScores) {
		const maximum = areaCaps.get(score.areaKey)
		if (maximum === undefined || !Number.isInteger(score.points) || score.points < 0 || score.points > maximum) {
			throw new Error(`${bike.name} has invalid points for ${score.areaKey}.`)
		}
	}
	for (const spec of bike.specList ?? []) {
		if (
			typeof spec.label !== 'string' ||
			!spec.label.trim() ||
			typeof spec.value !== 'string' ||
			!spec.value.trim()
		) {
			throw new Error(`${bike.name} has an incomplete spec list entry.`)
		}
	}
	const total = bike.inspectionScores.reduce((sum, score) => sum + score.points, 0)
	if (total > 100) throw new Error(`${bike.name} scores ${total}; the maximum is 100.`)
}

if (missingImages.size > 0) {
	throw new Error(
		`Add the missing image files to data/images/:\n${[...missingImages]
			.map((file) => ` - ${file}`)
			.join('\n')}`,
	)
}

async function upsertByKey(type, key, document) {
	const existingId = await client.fetch(
		'*[_type == $type && key == $key][0]._id',
		{ type, key },
	)
	return existingId
		? client.createOrReplace({ ...document, _id: existingId, _type: type })
		: client.create({ ...document, _type: type })
}

// Each unique filename is uploaded once and reused as a reference by every
// bicycle that mentions it.
const uploadedAssets = new Map()

async function toImageField(filename) {
	let asset = uploadedAssets.get(filename)
	if (!asset) {
		const bytes = await readFile(new URL(filename, imageDir))
		asset = await client.assets.upload('image', bytes, {
			filename,
			contentType: imageContentTypes.get(filename.split('.').pop().toLowerCase()),
		})
		uploadedAssets.set(filename, asset)
	}
	return { _type: 'image', name: filename, asset: { _type: 'reference', _ref: asset._id } }
}

// Array items of object type need a unique `_key`. Derive stable keys from the
// item's identity so re-running the seed produces the same document.
const arrayKey = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const areaIds = new Map()
for (const area of areaSeeds) {
	const { maxPoints, ...areaDocument } = area
	const saved = await upsertByKey('inspectionArea', area.key, areaDocument)
	areaIds.set(area.key, saved._id)
}

await client.createOrReplace({
	_id: 'inspectionStandard',
	_type: 'inspectionStandard',
	title: 'vo2bikes 100-point inspection',
	areas: areaSeeds.map((area) => ({
		_type: 'inspectionAreaWeight',
		_key: arrayKey(area.key),
		area: { _type: 'reference', _ref: areaIds.get(area.key) },
		maxPoints: area.maxPoints,
	})),
})

for (const bike of bicycleSeeds) {
	const model = normalizeBikeModel(bike.name)
	const existing = await client.fetch(
		'*[_type == "bicycle" && name == $name][0]{_id, slug}',
		{ name: model },
	)
	// Re-running the seed keeps the GUID a document already has. Documents with
	// a legacy UUID get the next counter value for their name.
	const slug =
		existing && isBikeGuidForModel(existing.slug, model)
			? existing.slug
			: await generateBikeGuid(model, client)
	const document = {
		...bike,
		slug,
		_type: 'bicycle',
		image: await toImageField(bike.image),
		gallery: await Promise.all(
			bike.gallery.map(async (filename) => ({
				_key: arrayKey(filename),
				...(await toImageField(filename)),
			})),
		),
		inspectionScores: bike.inspectionScores.map(({ areaKey, ...score }) => ({
			_type: 'inspectionScore',
			_key: arrayKey(areaKey),
			area: { _type: 'reference', _ref: areaIds.get(areaKey) },
			...score,
		})),
		specList: (bike.specList ?? []).map(({ label, ...spec }) => ({
			_type: 'bicycleSpec',
			_key: arrayKey(label),
			label,
			...spec,
		})),
	}
	if (existing?._id) await client.createOrReplace({ ...document, _id: existing._id })
	else await client.create(document)
}

console.log(
	`Imported ${areaSeeds.length} inspection areas and ${bicycleSeeds.length} bicycles using ${uploadedAssets.size} uploaded image assets.`,
)