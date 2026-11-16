/**
 * Canonical weights for the vo2bikes 100-point inspection.
 *
 *   Frame & fork ........ 25
 *   Wheels & tyres ...... 20
 *   Drivetrain .......... 20
 *   Braking ............. 15
 *   Cockpit & fit ....... 10
 *   Ride test & records . 10
 *
 * Keys match the `key` field on inspectionArea documents and the entries in
 * data/inspection-areas.json. Keep them in sync when the standard changes.
 */
export const inspectionMaxPoints = {
  'frame-fork': 25,
  'wheels-tyres': 20,
  drivetrain: 20,
  braking: 15,
  'cockpit-fit': 10,
  'ride-test-records': 10,
} as const

export type InspectionAreaKey = keyof typeof inspectionMaxPoints

/** Maximum points an area can earn, or undefined when the key is unknown. */
export const inspectionMaxPointsFor = (key: string | undefined | null): number | undefined =>
  key && key in inspectionMaxPoints ? inspectionMaxPoints[key as InspectionAreaKey] : undefined

/** The rules only add up to a valid 100-point inspection when this is 100. */
export const inspectionTotalPoints = Object.values(inspectionMaxPoints).reduce(
  (sum, points) => sum + points,
  0,
)
