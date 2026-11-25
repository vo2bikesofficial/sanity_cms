import { CogIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'
import { inspectionMaxPointsFor, inspectionTotalPoints } from './inspectionMaxPoints'

const apiVersion = '2025-02-19'

export const inspectionStandard = defineType({
  name: 'inspectionStandard',
  title: 'Inspection standard',
  type: 'document',
  icon: CogIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Standard name',
      type: 'string',
      initialValue: 'vo2bikes 100-point inspection',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'areas',
      title: 'Inspection areas',
      description: `Fixed weights: Frame & fork 25, Wheels & tyres 20, Drivetrain 20, Braking 15, Cockpit & fit 10, Ride test & records 10 — ${inspectionTotalPoints} points in total.`,
      type: 'array',
      of: [{ type: 'inspectionAreaWeight' }],
      validation: (rule) =>
        rule.required().min(1).custom(async (weights, context) => {
          const entries = (weights ?? []) as {area?: {_ref?: string}; maxPoints?: number}[]
          const ids = entries.map((weight) => weight.area?._ref).filter(Boolean)
          if (ids.length !== entries.length) return 'Every inspection area must be selected'
          if (new Set(ids).size !== ids.length) return 'Each inspection area can only be added once'

          const client = context.getClient({ apiVersion })
          const areaDocuments = (await client.fetch(
            '*[_type == "inspectionArea" && _id in $ids]{_id, key, title}',
            { ids },
          )) as {_id: string; key?: string; title?: string}[]
          if (areaDocuments.length !== ids.length) return 'One or more selected inspection areas no longer exist'

          const areasById = new Map(areaDocuments.map((area) => [area._id, area]))
          for (const entry of entries) {
            const area = areasById.get(entry.area?._ref ?? '')
            const maximum = inspectionMaxPointsFor(area?.key)
            if (maximum === undefined) {
              return `“${area?.title ?? 'This inspection area'}” is not part of the 100-point inspection`
            }
            if (entry.maxPoints !== maximum) {
              return `“${area?.title ?? 'This inspection area'}” must be worth exactly ${maximum} points`
            }
          }

          const total = entries.reduce((sum, weight) => sum + (weight.maxPoints ?? 0), 0)
          return total === 100 || `Inspection area maximums must total 100; currently ${total}`
        }),
    }),
  ],
  preview: {
    select: { title: 'title' },
  },
})
