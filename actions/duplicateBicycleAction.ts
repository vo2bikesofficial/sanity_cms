import {CopyIcon} from '@sanity/icons'
import {useEffect, useRef, useState} from 'react'
import {
  useClient,
  useDocumentOperation,
  useDocumentOperationEvent,
  type DocumentActionComponent,
} from 'sanity'
import {useRouter} from 'sanity/router'
import {BIKE_GUID_API_VERSION, generateBikeGuid, normalizeBikeModel} from '../lib/bikeGuid.mjs'

/**
 * Duplicate action that gives the copy a fresh Bike GUID.
 *
 * Studio's built-in duplicate action copies every field verbatim, including the
 * locked, unique `slug` (Bike GUID). The copy then fails GUID validation and can
 * never be published. Generating the next counter value for the same bike name
 * keeps the copy publishable and leaves the original untouched.
 */
export const DuplicateBicycleAction: DocumentActionComponent = (props) => {
  const {id, type, draft, published} = props
  const {duplicate} = useDocumentOperation(id, type)
  const {navigateIntent} = useRouter()
  const client = useClient({apiVersion: BIKE_GUID_API_VERSION})
  const operationEvent = useDocumentOperationEvent(id, type)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const eventBeforeDuplicate = useRef(operationEvent)

  const model = normalizeBikeModel((draft ?? published)?.name)

  useEffect(() => {
    // Only react to an event emitted after our duplicate request started; the
    // hook also replays the previous operation event for this document.
    if (!pendingId || !operationEvent || operationEvent === eventBeforeDuplicate.current) return
    if (operationEvent.op !== 'duplicate') return

    setPendingId(null)
    if (operationEvent.type === 'success') {
      navigateIntent('edit', {id: pendingId, type})
    } else {
      console.error('Failed to duplicate bicycle', operationEvent.error)
      setError('Sanity could not duplicate this bicycle. Please try again.')
    }
  }, [navigateIntent, operationEvent, pendingId, type])

  return {
    icon: CopyIcon,
    label: pendingId ? 'Duplicating…' : 'Duplicate',
    disabled: Boolean(duplicate.disabled) || !model || pendingId !== null,
    onHandle: () => {
      if (duplicate.disabled || !model || pendingId) return

      const newId = crypto.randomUUID()
      eventBeforeDuplicate.current = operationEvent
      setPendingId(newId)
      setError(null)

      generateBikeGuid(model, client)
        .then((slug) => {
          duplicate.execute(newId, {
            mapDocument: (document) => ({...document, slug}),
          })
        })
        .catch((cause: unknown) => {
          setPendingId(null)
          setError(cause instanceof Error ? cause.message : 'Could not generate a Bike GUID')
        })
    },
    dialog: error
      ? {
          type: 'confirm',
          tone: 'critical',
          message: error,
          confirmButtonText: 'OK',
          cancelButtonText: 'Close',
          onConfirm: () => setError(null),
          onCancel: () => setError(null),
        }
      : null,
  }
}

DuplicateBicycleAction.action = 'duplicate'
DuplicateBicycleAction.displayName = 'DuplicateBicycleAction'
