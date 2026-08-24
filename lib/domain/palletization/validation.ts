import { PalletCandidate, PalletWarning, PlannedPallet } from './types'

export interface DuplicateValidationResult {
  isValid: boolean
  errors: string[]
  assignedByMark: Record<
    string,
    {
      mark: string
      totalAssigned: number
      available: number
      excess: number
    }
  >
}

export function validateDuplicateAssignments(
  pallets: PlannedPallet[],
  candidates: PalletCandidate[],
): DuplicateValidationResult {
  const errors: string[] = []
  const availableMap = new Map<string, { mark: string; available: number }>()

  for (const c of candidates) {
    const avail =
      c.availableQuantity !== undefined ? c.availableQuantity : c.quantity
    availableMap.set(c.panelMarkId, { mark: c.mark, available: avail })
  }

  const assignedMap: Record<
    string,
    { mark: string; totalAssigned: number; available: number; excess: number }
  > = {}

  for (const p of pallets) {
    for (const item of p.items) {
      const markInfo = availableMap.get(item.panelMarkId) || {
        mark: item.mark,
        available: 0,
      }
      if (!assignedMap[item.panelMarkId]) {
        assignedMap[item.panelMarkId] = {
          mark: item.mark,
          totalAssigned: 0,
          available: markInfo.available,
          excess: 0,
        }
      }
      assignedMap[item.panelMarkId].totalAssigned += item.quantity
    }
  }

  for (const data of Object.values(assignedMap)) {
    if (data.totalAssigned > data.available) {
      data.excess = data.totalAssigned - data.available
      errors.push(
        `Duplicate Assignment Violation: Panel mark '${data.mark}' has ${data.totalAssigned} assigned units across planned pallets, exceeding available unpalletized quantity of ${data.available} (excess: ${data.excess}).`,
      )
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    assignedByMark: assignedMap,
  }
}

export interface StagingValidationResult {
  canStage: boolean
  errors: string[]
}

export function validatePalletForStaging(
  pallet:
    | PlannedPallet
    | {
        id: string
        palletNumber: string
        status: string
        panelCount: number
        currentWeightLbs: number
        maxWeightLbs: number
        currentHeightInches: number
        maxHeightInches: number
        warnings?: PalletWarning[]
      },
  options?: {
    isCurrentRevision?: boolean
    hasActiveQCHold?: boolean
  },
): StagingValidationResult {
  const errors: string[] = []

  if (options?.isCurrentRevision === false) {
    errors.push(
      'Blocking Error: Cannot stage pallet built against a superseded or cancelled release revision.',
    )
  }

  if (options?.hasActiveQCHold === true) {
    errors.push(
      'Blocking Error: Pallet contains panels under an active QC Hold investigation.',
    )
  }

  const panelCount =
    'panelCount' in pallet
      ? pallet.panelCount
      : (pallet as PlannedPallet).items.reduce((s, i) => s + i.quantity, 0)

  if (panelCount <= 0) {
    errors.push('Blocking Error: Cannot stage an empty pallet (0 panels).')
  }

  const weight =
    'geometry' in pallet ? pallet.geometry.weightLbs : pallet.currentWeightLbs
  const maxWeight = 'geometry' in pallet ? 3500 : pallet.maxWeightLbs

  if (weight > maxWeight) {
    errors.push(
      `Blocking Error: Pallet weight (${weight} lbs) exceeds maximum allowable limit (${maxWeight} lbs).`,
    )
  }

  return {
    canStage: errors.length === 0,
    errors,
  }
}
