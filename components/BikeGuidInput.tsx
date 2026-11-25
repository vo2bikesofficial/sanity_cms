import { useEffect, useRef, useState } from 'react'
import { PatchEvent, set, useClient, useFormValue, type StringInputProps } from 'sanity'
import {
  BIKE_GUID_API_VERSION,
  generateBikeGuid,
  isBikeGuidForModel,
  normalizeBikeModel,
} from '../lib/bikeGuid.mjs'

/**
 * The Bike GUID cannot be resolved by a field `initialValue`, because the bike
 * name does not exist yet when a new document is created. Fill it as soon as an
 * editor enters (or changes) the name, using the shared per-model counter.
 */
export function BikeGuidInput(props: StringInputProps) {
  const { value, onChange, renderDefault } = props
  const name = useFormValue(['name'])
  const client = useClient({ apiVersion: BIKE_GUID_API_VERSION })
  const model = normalizeBikeModel(name)
  const modelKey = model.toLowerCase()
  const [error, setError] = useState<string | null>(null)
  const generatedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!modelKey) return

    if (typeof value === 'string' && isBikeGuidForModel(value, model)) {
      generatedFor.current = modelKey
      setError(null)
      return
    }

    if (generatedFor.current === modelKey) return

    generatedFor.current = modelKey
    let cancelled = false
    setError(null)

    generateBikeGuid(model, client)
      .then((guid) => {
        if (!cancelled) onChange(PatchEvent.from(set(guid)))
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        generatedFor.current = null
        setError(cause instanceof Error ? cause.message : 'Could not generate a Bike GUID')
      })

    return () => {
      cancelled = true
    }
  }, [client, model, modelKey, onChange, value])

  return (
    <>
      {renderDefault(props)}
      {error ? (
        <p style={{ color: 'var(--card-badge-critical-fg)', fontSize: 12, marginBottom: 0 }}>
          {error}
        </p>
      ) : null}
    </>
  )
}
