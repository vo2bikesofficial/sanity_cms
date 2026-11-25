# vo2bikes Product CMS

Sanity Studio for the vo2bikes pre-owned bicycle showroom.

## Content model

- `bicycle` stores product details, uploaded image assets (main image + gallery), availability, a generated Bike GUID slug (`<url-friendly bike name>-<counter>`, e.g. `Aeroform_R9-1`), and inspection scores.
- `bikeGuidCounter` keeps one document per bike name with the last counter value handed out for that model.
- `inspectionArea` defines editable checklist areas and their maximum points.
- `inspectionStandard` is a singleton that orders the areas and requires their maximum points to total 100.
- Every bicycle is scored once per configured area. Points cannot exceed that area's maximum; the earned score can be below 100.
- Only bicycles marked `available` are returned by the storefront.

## Import the sample catalogue

The JSON source records are in `data/bicycles.json` and `data/inspection-areas.json`. The importer creates or updates documents by their stable content keys and lets Sanity generate document IDs.

Put the photos listed in `data/bicycles.json` into `data/images/` (see `data/images/README.md` for the expected filenames). The importer uploads every file as a Sanity image asset and stores a reference in the document; it never downloads images, and it lists missing files before writing anything.

Set `SANITY_API_TOKEN` to a Sanity API token with write access to the `trial` dataset, then run from this directory:

```powershell
$env:SANITY_API_TOKEN = "<write-token>"
npm run seed
Remove-Item Env:SANITY_API_TOKEN
```

The token is read only from the environment and is not stored in the repository.

Bike GUIDs are generated from the bike name and a counter (for example, `Aeroform R9-1`). Seeding creates the `bikeGuidCounter` documents and gives existing bicycles with legacy UUID slugs their first counter-based GUID. To migrate a dataset without re-importing the catalogue, run `npm run migrate:guids` with the same token set.

## Fetch images with the Sanity client

`image` and `gallery` hold references to uploaded assets, so dereference them with `asset->` in GROQ:

```groq
*[_type == "bicycle"]{
  name,
  alt,
  "image": image{ asset->{ url, metadata{ dimensions, lqip } }, hotspot, crop },
  "gallery": gallery[]{ asset->{ url } }
}
```

Run `npm run fetch` to execute exactly that query against the `trial` dataset and print the CDN URLs.

Asset URLs accept image pipeline parameters directly (`?w=800&fit=crop&auto=format`). For hotspot-aware crops, responsive `srcset`s, and LQIP blur placeholders, install `@sanity/image-url` in the consuming app:

```ts
import createImageUrlBuilder from '@sanity/image-url'

const urlFor = (source) => createImageUrlBuilder({ projectId, dataset }).image(source)

urlFor(bicycle.image).width(800).height(600).fit('crop').url() // honours the editor's hotspot
```

## Run the Studio

```sh
npm install
npm run dev
```

Use `npm run build` to validate and build the Studio.