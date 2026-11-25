/**
 * Shared Bike GUID helpers, used by both the Studio (TypeScript) and the Node
 * seed/migration scripts (.mjs).
 *
 * A Bike GUID is `<url-friendly bike name>-<counter>`, e.g. `Aeroform_R9-1`.
 * Spaces and special characters in the model become underscores; the counter
 * is appended after a `-`. The counter is kept in a separate `bikeGuidCounter`
 * document keyed by the normalized bike name, so the bicycle document
 * attributes stay exactly as they were.
 *
 * The client is deliberately left untyped: the Studio's `useClient` and the
 * standalone `@sanity/client` expose nominally different SanityClient types.
 */

export const BIKE_GUID_API_VERSION = '2025-02-19'
export const BIKE_GUID_COUNTER_TYPE = 'bikeGuidCounter'

/** @param {unknown} name */
export function normalizeBikeModel(name) {
  return typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : ''
}

/**
 * URL-friendly model portion of the GUID. Every run of spaces or special
 * characters becomes a single underscore; letters and digits are preserved.
 * @param {unknown} name
 */
export function urlFriendlyBikeModel(name) {
  return normalizeBikeModel(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Deterministic document ID so every bike name has exactly one counter.
 * @param {unknown} name
 */
export function bikeGuidCounterId(name) {
  const suffix =
    normalizeBikeModel(name)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100) || 'unknown'

  return `${BIKE_GUID_COUNTER_TYPE}.${suffix}`
}

/**
 * @param {unknown} value
 * @param {unknown} name
 */
export function isBikeGuidForModel(value, name) {
  const expectedModel = urlFriendlyBikeModel(name)
  if (!expectedModel || typeof value !== 'string') return false

  const match = /^(.+)-([1-9]\d*)$/.exec(value)
  if (!match) return false

  return match[1].toLowerCase() === expectedModel.toLowerCase()
}

/**
 * Increments the counter for a bike name and returns the new GUID.
 * `inc` is atomic on the server, so concurrent creations cannot share a GUID.
 *
 * @param {unknown} name
 * @param {any} client
 * @returns {Promise<string>}
 */
export async function generateBikeGuid(name, client) {
  const model = normalizeBikeModel(name)
  const urlModel = urlFriendlyBikeModel(model)
  if (!urlModel) throw new Error('A bike name with letters or numbers is required to generate a Bike GUID')

  const counterId = bikeGuidCounterId(model)

  await client.createIfNotExists({
    _id: counterId,
    _type: BIKE_GUID_COUNTER_TYPE,
    model,
    counter: 0,
  })

  const updated = await client
    .patch(counterId)
    .inc({ counter: 1 })
    .commit({ returnFirst: true, returnDocuments: true, visibility: 'sync' })

  const counter = Number(updated?.counter)
  if (!Number.isInteger(counter) || counter < 1) {
    throw new Error(`Bike GUID counter for “${model}” is invalid: ${String(updated?.counter)}`)
  }

  return `${urlModel}-${counter}`
}
