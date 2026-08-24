import { DEFAULT_ELWARD_PALLET_RULES } from './config'
import { CompatibilityResult, PalletizationRuleSet } from './types'
import { normalizeMaterialFamily } from './normalize'

export function areMaterialsCompatible(
  materialA: string,
  materialB: string,
  rules: PalletizationRuleSet = DEFAULT_ELWARD_PALLET_RULES,
): CompatibilityResult {
  const normA = normalizeMaterialFamily(materialA, rules)
  const normB = normalizeMaterialFamily(materialB, rules)

  if (normA.canonicalName === normB.canonicalName) {
    return { compatible: true }
  }

  // If one of the materials is unknown, flag warning
  if (normA.canonicalName === 'UNKNOWN' || normB.canonicalName === 'UNKNOWN') {
    return {
      compatible: false,
      reason: `Unknown material family detected ('${materialA}' / '${materialB}'). Combining requires manual review.`,
    }
  }

  // Check compatibility lists
  const listA = normA.rule?.compatibleWith || []
  const listB = normB.rule?.compatibleWith || []

  const aAcceptsB =
    listA.includes(normB.canonicalName) ||
    listA.some((alias) =>
      normB.rule?.aliases
        .map((a) => a.toUpperCase())
        .includes(alias.toUpperCase()),
    )
  const bAcceptsA =
    listB.includes(normA.canonicalName) ||
    listB.some((alias) =>
      normA.rule?.aliases
        .map((a) => a.toUpperCase())
        .includes(alias.toUpperCase()),
    )

  if (aAcceptsB && bAcceptsA) {
    return { compatible: true }
  }

  return {
    compatible: false,
    reason: `Material '${normA.canonicalName}' is not compatible for shared pallet stacking with '${normB.canonicalName}'.`,
  }
}

export function canAddMaterialToPallet(
  existingMaterials: string[],
  newMaterial: string,
  rules: PalletizationRuleSet = DEFAULT_ELWARD_PALLET_RULES,
): CompatibilityResult {
  if (existingMaterials.length === 0) return { compatible: true }

  for (const existing of existingMaterials) {
    const res = areMaterialsCompatible(existing, newMaterial, rules)
    if (!res.compatible) {
      return res
    }
  }

  return { compatible: true }
}
