import studio from '@sanity/eslint-config-studio'

export default [
  ...studio,
  {
    files: ['*.mjs'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
      },
    },
  },
]
