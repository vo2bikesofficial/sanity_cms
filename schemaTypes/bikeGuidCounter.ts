import { HashIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'

/**
 * One document per bike name/model. `counter` holds the last Bike GUID number
 * handed out for that model; the bicycle documents themselves are unchanged.
 */
export const bikeGuidCounter = defineType({
  name: 'bikeGuidCounter',
  title: 'Bike GUID counter',
  type: 'document',
  icon: HashIcon,
  fields: [
    defineField({
      name: 'model',
      title: 'Bike model / name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'counter',
      title: 'Last generated number',
      type: 'number',
      description: 'The next bike of this model gets model name + counter + 1.',
      validation: (rule) => rule.required().integer().min(1),
    }),
  ],
  preview: {
    select: { title: 'model', subtitle: 'counter' },
    prepare: ({ title, subtitle }: { title?: string; subtitle?: number }) => ({
      title: title ?? 'Unnamed model',
      subtitle: subtitle === undefined ? undefined : `Last GUID: ${title} - ${subtitle}`,
    }),
  },
})
