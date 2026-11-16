import { defineField, defineType } from 'sanity'

export const inspectionAreaWeight = defineType({
  name: 'inspectionAreaWeight',
  title: 'Weighted inspection area',
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
      name: 'maxPoints',
      title: 'Maximum points',
      description:
        'Fixed by the 100-point standard: Frame & fork 25, Wheels & tyres 20, Drivetrain 20, Braking 15, Cockpit & fit 10, Ride test & records 10.',
      type: 'number',
      validation: (rule) => rule.required().integer().min(0).max(100),
    }),
  ],
  preview: {
    select: { title: 'area.title', subtitle: 'maxPoints' },
    prepare({ title, subtitle }) {
      return { title: title ?? 'Inspection area', subtitle: `${subtitle ?? 0} points maximum` }
    },
  },
})
