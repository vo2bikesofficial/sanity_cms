import { TagIcon } from '@sanity/icons'
import { defineArrayMember, defineField, defineType } from 'sanity'
import { BikeGuidInput } from '../components/BikeGuidInput'
import {
  BIKE_GUID_API_VERSION,
  isBikeGuidForModel,
  normalizeBikeModel,
  urlFriendlyBikeModel,
} from '../lib/bikeGuid.mjs'

const apiVersion = BIKE_GUID_API_VERSION

export const bicycle = defineType({
  name: 'bicycle',
  title: 'Bicycle',
  type: 'document',
  icon: TagIcon,
  fields: [
    defineField({
      name: 'name',
      title: 'Bike name',
      type: 'string',
      validation: (rule) => rule.required().min(2).max(120),
    }),
    defineField({
      name: 'slug',
      title: 'Bike GUID',
      description:
        'Generated automatically from the bike name and a per-model counter, then locked to keep the bike URL stable and unique.',
      type: 'string',
      components: { input: BikeGuidInput },
      readOnly: true,
      validation: (rule) =>
        rule.required().custom(async (value, context) => {
          const model = normalizeBikeModel(context.document?.name)
          if (!model) return 'Enter a bike name before generating a Bike GUID'
          if (!isBikeGuidForModel(value, model)) {
            return `Bike GUID must be the URL-friendly bike name followed by a counter, e.g. ${urlFriendlyBikeModel(model)}-1`
          }

          // Ignore both the published and the draft copy of the document being
          // edited. Without excluding the draft, a published bike reports its
          // own draft as a duplicate GUID.
          const publishedId = context.document?._id?.replace(/^drafts\./, '')
          if (!publishedId) return true

          const client = context.getClient({ apiVersion }).withConfig({ perspective: 'raw' })
          const duplicates = await client.fetch(
            'count(*[_type == "bicycle" && slug == $slug && !(_id in [$publishedId, $draftId])])',
            { slug: value, publishedId, draftId: `drafts.${publishedId}` },
          )
          return duplicates === 0 || 'This bike GUID is already in use'
        }),
    }),
    defineField({
      name: 'year',
      title: 'Model year',
      type: 'number',
      validation: (rule) => rule.required().integer().min(1900).max(2100),
    }),
    defineField({
      name: 'newBikePrice',
      title: 'New bike price (INR)',
      description: 'Original/new-bike price shown struck through beside our price on the Buy Bikes page.',
      type: 'number',
      validation: (rule) =>
        rule.integer().min(0).custom((value, context) => {
          if (value == null) return true
          const sellingPrice = context.document?.price
          return typeof sellingPrice === 'number' && value <= sellingPrice
            ? 'New bike price should be higher than our selling price'
            : true
        }),
    }),
    defineField({
      name: 'price',
      title: 'Price (INR)',
      type: 'number',
      validation: (rule) => rule.required().integer().min(0),
    }),
    defineField({
      name: 'image',
      title: 'Main image',
      type: 'image',
      description: 'Upload the main product photo. Editors can drag, drop, or paste an image here.',
      options: {
        hotspot: true,
        metadata: ['image', 'lqip', 'palette'],
      },
      validation: (rule) => rule.required().assetRequired(),
    }),
    defineField({
      name: 'alt',
      title: 'Main image description',
      type: 'string',
      validation: (rule) => rule.required().max(160),
    }),
    defineField({
      name: 'gallery',
      title: 'Gallery images',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'image',
          title: 'Image',
          options: {
            hotspot: true,
            metadata: ['image', 'lqip', 'palette'],
          },
        }),
      ],
      validation: (rule) =>
        rule
          .required()
          .min(1)
          .max(12)
          .custom((gallery) => {
            const entries = (gallery ?? []) as {asset?: {_ref?: string}}[]
            const assetIds = entries.map((entry) => entry.asset?._ref)
            if (assetIds.some((id) => !id)) return 'Every gallery image must be an uploaded asset'
            if (new Set(assetIds).size !== assetIds.length) {
              return 'Each gallery image can only be used once'
            }
            return true
          }),
    }),
    defineField({
      name: 'specList',
      title: 'Spec list',
      description:
        'Every bike detail, shown as a bullet list in the spec section: Size, Weight, Frame, Groupset, Wheels, and so on. Add only the specs that apply to this bike.',
      type: 'array',
      of: [defineArrayMember({ type: 'bicycleSpec' })],
      validation: (rule) =>
        rule.max(24).custom((items) => {
          const labels = ((items ?? []) as {label?: string}[])
            .map((item) => item.label?.trim().toLowerCase())
            .filter(Boolean)
          return new Set(labels).size === labels.length || 'Each spec name can only be used once'
        }),
    }),
    defineField({
      name: 'description',
      title: 'Product description',
      type: 'text',
      rows: 4,
      validation: (rule) => rule.required().max(600),
    }),
    defineField({
      name: 'available',
      title: 'Available for sale',
      description: 'Only available bikes appear in the public inventory.',
      type: 'boolean',
      initialValue: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'isRentable',
      title: 'Available for rent',
      description: 'Only rentable bikes appear in the public rental fleet.',
      type: 'boolean',
      initialValue: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'inspectionScores',
      title: 'Inspection scores',
      description:
        'Record one score for every area in the inspection standard. Maximums: Frame & fork 25, Wheels & tyres 20, Drivetrain 20, Braking 15, Cockpit & fit 10, Ride test & records 10. The total can be below 100.',
      type: 'array',
      of: [defineArrayMember({ type: 'inspectionScore' })],
      validation: (rule) =>
        rule.required().min(1).custom(async (scores, context) => {
          const client = context.getClient({ apiVersion })
          const standard = await client.fetch(
            '*[_type == "inspectionStandard" && _id == "inspectionStandard"][0]{areas[]{maxPoints, "areaId": area._ref, "title": area->title}}',
          )
          const areas = (standard?.areas ?? []) as {areaId: string; maxPoints: number; title?: string}[]
          if (areas.length === 0) return 'Set up the inspection standard before scoring bikes'

          const maximumTotal = areas.reduce((sum, area) => sum + (area.maxPoints ?? 0), 0)
          if (maximumTotal !== 100) return `Inspection area maximums must total 100; currently ${maximumTotal}`

          const entries = (scores ?? []) as {area: {_ref: string}; points: number}[]
          const ids = entries.map((entry) => entry.area?._ref).filter(Boolean)
          if (ids.length !== entries.length) return 'Every score must reference an inspection area'
          if (new Set(ids).size !== ids.length) return 'Each inspection area can only be scored once'
          if (areas.some((area) => !ids.includes(area.areaId)) || ids.some((id) => !areas.some((area) => area.areaId === id))) {
            return 'Score every configured inspection area exactly once'
          }

          const maximumById = new Map<string, number>(
            areas.map((area) => [area.areaId, area.maxPoints]),
          )
          const labelById = new Map<string, string>(
            areas.map((area) => [area.areaId, area.title ?? 'This area']),
          )
          for (const entry of entries) {
            const maximum = maximumById.get(entry.area._ref)
            if (maximum === undefined) return 'Score every configured inspection area exactly once'
            if (!Number.isInteger(entry.points) || entry.points < 0) {
              return 'Points must be whole numbers of zero or more'
            }
            if (entry.points > maximum) {
              return `“${labelById.get(entry.area._ref)}” can earn at most ${maximum} points`
            }
          }

          const total = entries.reduce((sum, entry) => sum + entry.points, 0)
          return total <= 100 || `Earned points cannot exceed 100; currently ${total}`
        }),
    }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'year', media: 'image' },
  },
})