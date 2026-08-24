import { DEFAULT_ELWARD_PALLET_RULES } from './config'
import {
  PalletCandidate,
  PalletizationRuleSet,
  PalletWarning,
  StackHeightCalculationResult,
} from './types'
import { normalizeMaterialFamily } from './normalize'

export function calculatePanelStackHeight(
  panel: Partial<PalletCandidate>,
  rules: PalletizationRuleSet = DEFAULT_ELWARD_PALLET_RULES,
): {
  stackHeight: StackHeightCalculationResult
  warnings: PalletWarning[]
} {
  const warnings: PalletWarning[] = []

  // 1. Authoritative stack thickness if provided
  if (
    panel.stackThicknessInches !== undefined &&
    panel.stackThicknessInches !== null &&
    panel.stackThicknessInches > 0
  ) {
    return {
      stackHeight: {
        valueInches: Number(panel.stackThicknessInches.toFixed(3)),
        method: 'SOURCE',
        confidence: 1.0,
      },
      warnings,
    }
  }

  const { rule, canonicalName } = normalizeMaterialFamily(
    panel.materialFamily,
    rules,
  )

  const thickness =
    panel.thicknessInches && panel.thicknessInches > 0
      ? panel.thicknessInches
      : rule?.defaultThicknessInches || 0.157

  // If stackAllowance is defined, stack height = thickness + stackAllowance
  if (rule?.stackAllowanceInches !== undefined) {
    const totalStack = thickness + rule.stackAllowanceInches
    return {
      stackHeight: {
        valueInches: Number(totalStack.toFixed(3)),
        method: 'CALCULATED',
        confidence: 0.9,
      },
      warnings,
    }
  }

  // Fallback: 0.75" for cassette systems, 0.35" for flat boards
  const isFlatBoard =
    canonicalName === 'SWISSPEARL' || canonicalName === 'TRESPA'
  const fallbackHeight = isFlatBoard ? thickness + 0.05 : 0.75

  warnings.push({
    code: 'HEIGHT_ESTIMATED',
    severity: 'INFO',
    message: `Stack height estimated at ${fallbackHeight.toFixed(2)}" for ${canonicalName}.`,
    entityId: panel.panelMarkId,
  })

  return {
    stackHeight: {
      valueInches: Number(fallbackHeight.toFixed(3)),
      method: 'FALLBACK',
      confidence: 0.7,
    },
    warnings,
  }
}
