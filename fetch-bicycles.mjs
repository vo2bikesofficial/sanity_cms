import { createClient } from '@sanity/client'

const projectId = 'lkeuttht'
const dataset = 'trial'
const apiVersion = '2025-02-19'

const client = createClient({ projectId, dataset, apiVersion, useCdn: false })

// `image` and `gallery` store references to image asset documents. Dereference
// them with `asset->` to read the CDN URL, dimensions, and the LQIP placeholder.
const bicycles = await client.fetch(`*[_type == "bicycle"]{
	name,
	slug,
	available,
	alt,
	"image": image{
		asset->{_id, url, metadata{dimensions{width, height}, lqip}},
		hotspot,
		crop
	},
	"gallery": gallery[]{
		asset->{_id, url},
		hotspot,
		crop
	}
}`)

for (const bicycle of bicycles) {
	const main = bicycle.image?.asset
	if (!main) {
		console.log(`${bicycle.name}: no main image`)
		continue
	}
	// Asset URLs accept image pipeline query parameters directly, e.g. resize.
	// Hotspot-aware cropping needs @sanity/image-url (see README).
	const thumbnail = `${main.url}?w=640&h=480&fit=crop&auto=format`
	console.log(`${bicycle.name} (${bicycle.available ? 'available' : 'hidden'})`)
	console.log(`  alt:     ${bicycle.alt}`)
	console.log(`  main:    ${main.url}`)
	console.log(`  thumb:   ${thumbnail}`)
	console.log(`  size:    ${main.metadata?.dimensions?.width}x${main.metadata?.dimensions?.height}`)
	console.log(`  lqip:    ${main.metadata?.lqip ? 'yes' : 'no'}`)
	console.log(`  gallery: ${bicycle.gallery.length} images`)
}

console.log(`\nFetched ${bicycles.length} bicycles.`)
