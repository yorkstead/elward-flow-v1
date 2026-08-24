import { DEFAULT_ELWARD_PALLET_RULES } from './config'
import {
  MaterialPalletRule,
  PalletizationRuleSet,
  PalletWarning,
} from './types'

export function normalizeMaterialFamily(
  rawName: string | undefined | null,
  rules: PalletizationRuleSet = DEFAULT_ELWARD_PALLET_RULES,
): {
  canonicalName: string
  rule: MaterialPalletRule | null
  borderInches: number
  warnings: PalletWarning[]
} {
  const warnings: PalletWarning[] = []
  if (!rawName || !rawName.trim()) {
    warnings.push({
      code: 'UNKNOWN_MATERIAL',
      severity: 'WARNING',
      message:
        'Material family is missing or empty. Defaulting to standard 4.0" border with review required.',
      originalValue: rawName,
      suggestedValue: 'ACM',
    })
    return {
      canonicalName: 'UNKNOWN',
      rule: null,
      borderInches: rules.defaultBorderInches,
      warnings,
    }
  }

  const cleaned = rawName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s_-]/g, '')
    .replace(/[\s_-]+/g, ' ')

  // Look up direct canonical match
  if (rules.materialRules[cleaned]) {
    const r = rules.materialRules[cleaned]
    return {
      canonicalName: r.canonicalName,
      rule: r,
      borderInches: r.borderInches,
      warnings,
    }
  }

  // Look up aliases
  for (const [key, rule] of Object.entries(rules.materialRules)) {
    if (
      key === cleaned ||
      rule.aliases.some((alias) => {
        const normAlias = alias
          .toUpperCase()
          .replace(/[^A-Z0-9\s_-]/g, '')
          .replace(/[\s_-]+/g, ' ')
        return (
          cleaned === normAlias ||
          cleaned.startsWith(normAlias + ' ') ||
          cleaned.endsWith(' ' + normAlias) ||
          cleaned.includes(normAlias)
        )
      })
    ) {
      return {
        canonicalName: rule.canonicalName,
        rule,
        borderInches: rule.borderInches,
        warnings,
      }
    }
  }

  // Check borderByMaterial lookup
  if (rules.borderByMaterial[cleaned]) {
    return {
      canonicalName: cleaned,
      rule: null,
      borderInches: rules.borderByMaterial[cleaned],
      warnings,
    }
  }

  warnings.push({
    code: 'UNKNOWN_MATERIAL',
    severity: 'WARNING',
    message: `Unknown material family '${rawName}'. Border set to default ${rules.defaultBorderInches}" and review required.`,
    originalValue: rawName,
    suggestedValue: 'ACM',
  })

  return {
    canonicalName: rawName.trim(),
    rule: null,
    borderInches: rules.defaultBorderInches,
    warnings,
  }
}

export function normalizeElevationName(rawElevation?: string | null): string {
  if (!rawElevation || !rawElevation.trim()) {
    return 'General / Unspecified'
  }
  return rawElevation
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bElev\b/gi, 'Elevation')
    .replace(/\bN\.\s*Elev\b/gi, 'North Elevation')
    .replace(/\bS\.\s*Elev\b/gi, 'South Elevation')
    .replace(/\bE\.\s*Elev\b/gi, 'East Elevation')
    .replace(/\bW\.\s*Elev\b/gi, 'West Elevation')
}
