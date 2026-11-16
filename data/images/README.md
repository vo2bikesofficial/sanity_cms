# Seed images

Drop the bicycle photos referenced by `data/bicycles.json` into this folder.
`npm run seed` uploads each file as a Sanity image asset and writes a reference
into the `image` and `gallery` fields — nothing is downloaded from the internet.

Filenames must match `data/bicycles.json` exactly and use a supported extension:
`.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.gif`, `.svg`, `.tiff`, `.tif`.

Expected files (4 per bicycle):

```
aeroform-r9-main.jpg          aeroform-r9-gallery-1.jpg
aeroform-r9-gallery-2.jpg     aeroform-r9-gallery-3.jpg

summit-pro-7-main.jpg         summit-pro-7-gallery-1.jpg
summit-pro-7-gallery-2.jpg    summit-pro-7-gallery-3.jpg

vector-tt-8-main.jpg          vector-tt-8-gallery-1.jpg
vector-tt-8-gallery-2.jpg     vector-tt-8-gallery-3.jpg

endurance-carbon-5-main.jpg   endurance-carbon-5-gallery-1.jpg
endurance-carbon-5-gallery-2.jpg   endurance-carbon-5-gallery-3.jpg

criterium-sl-main.jpg         criterium-sl-gallery-1.jpg
criterium-sl-gallery-2.jpg    criterium-sl-gallery-3.jpg

terra-race-6-main.jpg         terra-race-6-gallery-1.jpg
terra-race-6-gallery-2.jpg    terra-race-6-gallery-3.jpg
```

The importer validates every filename and lists any missing files **before** it
writes anything to the dataset, so it is safe to run once the files are in place.
