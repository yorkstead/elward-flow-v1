import { DEFAULT_ELWARD_PALLET_RULES } from './config'
import {
  PalletCandidate,
  PalletGeometry,
  PalletOrientation,
  PalletizationRuleSet,
  PlannedPalletItem,
} from './types'
import { normalizeMaterialFamily } from './normalize'

export interface PanelDimensionItem {
  widthInches: number
  lengthInches: number
  materialFamily: string
}

export function calculateRequiredBorder(
  items: (PanelDimensionItem | PalletCandidate | PlannedPalletItem)[],
  rules: PalletizationRuleSet = DEFAULT_ELWARD_PALLET_RULES,
): number {
  if (items.length === 0) return rules.defaultBorderInches

  let maxBorder = 0
  for (const item of items) {
    const { borderInches } = normalizeMaterialFamily(item.materialFamily, rules)
    if (borderInches > maxBorder) {
      maxBorder = borderInches
    }
  }

  return maxBorder > 0 ? maxBorder : rules.defaultBorderInches
}

export function calculatePalletGeometry(
  items: (PanelDimensionItem | PalletCandidate | PlannedPalletItem)[],
  rules: PalletizationRuleSet = DEFAULT_ELWARD_PALLET_RULES,
  currentHeightInches = 0,
  currentWeightLbs = 0,
): PalletGeometry {
  if (items.length === 0) {
    return {
      widthInches: 0,
      lengthInches: 0,
      heightInches: Number(currentHeightInches.toFixed(2)),
      weightLbs: Number(currentWeightLbs.toFixed(2)),
      borderInches: rules.defaultBorderInches,
      orientation: 'STANDARD',
    }
  }

  const border = calculateRequiredBorder(items, rules)

  // Standard orientation: keep each panel aligned with max dimension as length
  let maxWidthStandard = 0
  let maxLengthStandard = 0

  for (const it of items) {
    const w = Math.min(it.widthInches || 0, it.lengthInches || 0)
    const l = Math.max(it.widthInches || 0, it.lengthInches || 0)
    if (w > maxWidthStandard) maxWidthStandard = w
    if (l > maxLengthStandard) maxLengthStandard = l
  }

  const standardWidth = maxWidthStandard + border * 2
  const standardLength = maxLengthStandard + border * 2

  const orientation: PalletOrientation = 'STANDARD'

  return {
    widthInches: Number(standardWidth.toFixed(2)),
    lengthInches: Number(standardLength.toFixed(2)),
    heightInches: Number(currentHeightInches.toFixed(2)),
    weightLbs: Number(currentWeightLbs.toFixed(2)),
    borderInches: Number(border.toFixed(2)),
    orientation,
  }
}
