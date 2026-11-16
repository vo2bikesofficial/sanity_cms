import { defineField, defineType } from 'sanity'
import { inspectionMaxPointsFor } from './inspectionMaxPoints'

const apiVersion = '2025-02-19'

export const inspectionScore = defineType({
  name: 'inspectionScore',
  title: 'Inspection score',
  type: 'object',
  fields: [
    defineField({
      name: 'area',
      title: 'Inspection area',
      type: 'reference',
      to: [{ type: 'inspectionArea' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'points',
      title: 'Points earned',
      description:
        'Whole points only. Each area has a fixed ceiling: Frame & fork 25, Wheels & tyres 20, Drivetrain 20, Braking 15, Cockpit & fit 10, Ride test & records 10.',
      type: 'number',
      validation: (rule) =>
        rule
          .required()
          .integer()
          .min(0)
          .custom(async (points, context) => {
            if (points === undefined || points === null) return true

            const areaRef = (context.parent as {area?: {_ref?: string}} | undefined)?.area?._ref
            if (!areaRef) return true

            const area = (await context.getClient({ apiVersion }).fetch(
              '*[_type == "inspectionArea" && _id == $id][0]{key, title}',
              { id: areaRef },
            )) as {key?: string; title?: string} | null

            const maximum = inspectionMaxPointsFor(area?.key)
            if (maximum === undefined) {
              return `“${area?.title ?? 'This inspection area'}” is not part of the 100-point inspection`
            }

            return points <= maximum || `“${area?.title ?? 'This inspection area'}” can earn at most ${maximum} points`
          }),
    }),
    defineField({
      name: 'notes',
      title: 'Bike-specific findings',
      type: 'text',
      rows: 3,
    }),
  ],
  preview: {
    select: { title: 'area.title', subtitle: 'points' },
    prepare({ title, subtitle }) {
      return { title: title ?? 'Inspection area', subtitle: `${subtitle ?? 0} points` }
    },
  },
})
