import {
  PalletWarning,
  PalletWarningCode,
  PalletWarningOverride,
  PlannedPallet,
} from './types'

export function hasBlockingWarnings(warnings: PalletWarning[]): boolean {
  return warnings.some((w) => w.severity === 'BLOCKING')
}

export function isWarningOverridden(
  warning: PalletWarning,
  overrides?: PalletWarningOverride[],
): boolean {
  if (!overrides || overrides.length === 0) return false
  return overrides.some(
    (o) =>
      o.warningCode === warning.code &&
      (!warning.entityId || !o.entityId || o.entityId === warning.entityId),
  )
}

export function canApprovePalletPlan(
  pallets: PlannedPallet[],
  planWarnings: PalletWarning[] = [],
): {
  canApprove: boolean
  blockingReasons: string[]
} {
  const blockingReasons: string[] = []

  // Check top-level plan warnings
  for (const w of planWarnings) {
    if (w.severity === 'BLOCKING') {
      blockingReasons.push(`Plan Warning: ${w.message}`)
    }
  }

  // Check pallet-level warnings
  for (const p of pallets) {
    const unhandledBlocking = p.warnings.filter(
      (w) => w.severity === 'BLOCKING' && !isWarningOverridden(w, p.overrides),
    )
    for (const w of unhandledBlocking) {
      blockingReasons.push(`Pallet ${p.plannedPalletNumber}: ${w.message}`)
    }

    for (const item of p.items) {
      const itemBlocking = item.warnings.filter(
        (w) =>
          w.severity === 'BLOCKING' && !isWarningOverridden(w, p.overrides),
      )
      for (const w of itemBlocking) {
        blockingReasons.push(
          `Pallet ${p.plannedPalletNumber} (Item ${item.mark}): ${w.message}`,
        )
      }
    }
  }

  return {
    canApprove: blockingReasons.length === 0,
    blockingReasons,
  }
}

export function createWarning(
  code: PalletWarningCode,
  message: string,
  severity: 'INFO' | 'WARNING' | 'BLOCKING' = 'WARNING',
  meta?: {
    entityId?: string
    field?: string
    originalValue?: unknown
    suggestedValue?: unknown
  },
): PalletWarning {
  return {
    code,
    severity,
    message,
    entityId: meta?.entityId,
    field: meta?.field,
    originalValue: meta?.originalValue,
    suggestedValue: meta?.suggestedValue,
  }
}
