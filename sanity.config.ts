import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {DuplicateBicycleAction} from './actions/duplicateBicycleAction'
import {schemaTypes} from './schemaTypes'

export default defineConfig({
  name: 'default',
  title: 'productscms',

  projectId: 'lkeuttht',
  dataset: 'trial',

  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Content')
          .items([
            S.listItem()
              .title('Inspection standard')
              .id('inspectionStandard')
              .child(
                S.document()
                  .schemaType('inspectionStandard')
                  .documentId('inspectionStandard'),
              ),
            ...S.documentTypeListItems().filter((item) => item.getId() !== 'inspectionStandard'),
          ]),
    }),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
  },

  document: {
    actions: (previousActions, {schemaType}) =>
      schemaType === 'bicycle'
        ? previousActions.map((action) =>
            action.action === 'duplicate' ? DuplicateBicycleAction : action,
          )
        : previousActions,
  },
})
