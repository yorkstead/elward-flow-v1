import { DEFAULT_ELWARD_PALLET_RULES } from './config'
import {
  PalletCandidate,
  PalletizationRuleSet,
  PalletWarning,
  WeightCalculationResult,
} from './types'
import { normalizeMaterialFamily } from './normalize'

export function calculatePanelWeight(
  panel: Partial<PalletCandidate>,
  rules: PalletizationRuleSet = DEFAULT_ELWARD_PALLET_RULES,
): {
  unitWeight: WeightCalculationResult
  warnings: PalletWarning[]
} {
  const warnings: PalletWarning[] = []

  // 1. Authoritative imported panel weight
  if (
    panel.unitWeightLbs !== undefined &&
    panel.unitWeightLbs !== null &&
    panel.unitWeightLbs > 0
  ) {
    return {
      unitWeight: {
        valueLbs: Number(panel.unitWeightLbs.toFixed(2)),
        method: 'SOURCE',
        confidence: 1.0,
      },
      warnings,
    }
  }

  const width = panel.widthInches || 0
  const length = panel.lengthInches || 0
  const thickness = panel.thicknessInches || 0.157 // default 4mm if missing

  if (width <= 0 || length <= 0) {
    warnings.push({
      code: 'MISSING_DIMENSIONS',
      severity: 'WARNING',
      message: `Panel '${panel.mark || 'UNKNOWN'}' has missing or non-positive dimensions (${width}" × ${length}").`,
      entityId: panel.panelMarkId,
    })
    return {
      unitWeight: {
        valueLbs: 18.5,
        method: 'FALLBACK',
        confidence: 0.3,
      },
      warnings,
    }
  }

  const areaSqFt = (width * length) / 144

  const { rule, canonicalName } = normalizeMaterialFamily(
    panel.materialFamily,
    rules,
  )

  // 2. Material density + 3D dimensions
  if (rule?.densityLbsPerCubicInch && thickness > 0) {
    const volumeCuIn = width * length * thickness
    const weight = volumeCuIn * rule.densityLbsPerCubicInch
    warnings.push({
      code: 'WEIGHT_ESTIMATED',
      severity: 'INFO',
      message: `Weight estimated via 3D volumetric density for ${canonicalName}.`,
      entityId: panel.panelMarkId,
    })
    return {
      unitWeight: {
        valueLbs: Number(weight.toFixed(2)),
        method: 'DIMENSION_CALCULATION',
        confidence: 0.95,
      },
      warnings,
    }
  }

  // 3. Configured material unit weight per sq ft
  if (rule?.unitWeightLbsPerSqFt) {
    const weight = areaSqFt * rule.unitWeightLbsPerSqFt
    return {
      unitWeight: {
        valueLbs: Number(weight.toFixed(2)),
        method: 'MATERIAL_RULE',
        confidence: 0.9,
      },
      warnings,
    }
  }

  // 4. Fallback estimation based on 1.5 lb/sqft
  const fallbackWeight = Math.max(5, areaSqFt * 1.5)
  warnings.push({
    code: 'WEIGHT_ESTIMATED',
    severity: 'WARNING',
    message: `Panel weight estimated via fallback (1.5 lb/sq ft) for unknown material '${panel.materialFamily || 'UNKNOWN'}'.`,
    entityId: panel.panelMarkId,
  })

  return {
    unitWeight: {
      valueLbs: Number(fallbackWeight.toFixed(2)),
      method: 'FALLBACK',
      confidence: 0.5,
    },
    warnings,
  }
}
