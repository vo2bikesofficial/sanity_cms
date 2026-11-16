import { DocumentTextIcon } from '@sanity/icons/DocumentText'
import { defineField, defineType } from 'sanity'

export const inspectionArea = defineType({
  name: 'inspectionArea',
  title: 'Inspection area',
  type: 'document',
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: 'key',
      title: 'System key',
      type: 'string',
      initialValue: () => crypto.randomUUID(),
      readOnly: true,
      validation: (rule) =>
        rule.required().custom((value) =>
          typeof value === 'string' && /^[a-z0-9-]{3,80}$/i.test(value)
            ? true
            : 'Use lowercase letters, numbers, and hyphens for the system key',
        ),
    }),
    defineField({
      name: 'title',
      title: 'Area name',
      type: 'string',
      validation: (rule) => rule.required().min(2).max(80),
    }),
    defineField({
      name: 'description',
      title: 'What this area covers',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'criteria',
      title: 'Checklist items',
      type: 'array',
      of: [{ type: 'string' }],
      validation: (rule) => rule.min(1),
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'description' },
  },
})