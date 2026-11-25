import { UlistIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'

export const bicycleSpec = defineType({
  name: 'bicycleSpec',
  title: 'Spec list item',
  type: 'object',
  icon: UlistIcon,
  fields: [
    defineField({
      name: 'label',
      title: 'Spec name',
      description: 'Shown before the colon, e.g. Groupset.',
      type: 'string',
      validation: (rule) => rule.required().max(40),
    }),
    defineField({
      name: 'value',
      title: 'Spec value',
      description: 'Shown after the colon, e.g. Shimano 105 · 12 speed.',
      type: 'string',
      validation: (rule) => rule.required().max(120),
    }),
  ],
  preview: {
    select: { title: 'label', subtitle: 'value' },
    prepare({ title, subtitle }) {
      return { title: title ?? 'Spec', subtitle }
    },
  },
})
