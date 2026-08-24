import { DEFAULT_ELWARD_PALLET_RULES } from './config'
import {
  PALLET_PLANNER_VERSION,
  PalletCandidate,
  PalletizationRuleSet,
  PalletPlanResult,
  PalletWarning,
  PlannedPallet,
  PlannedPalletItem,
  UnassignedPanel,
} from './types'
import { normalizeElevationName, normalizeMaterialFamily } from './normalize'
import { calculatePanelWeight } from './weight'
import { calculatePanelStackHeight } from './stack-height'
import { calculatePalletGeometry } from './geometry'
import { canAddMaterialToPallet } from './compatibility'

export interface BuildPalletPlanOptions {
  releaseKey?: string
  startSequence?: number
}

export function buildPalletPlan(
  candidates: PalletCandidate[],
  rules: PalletizationRuleSet = DEFAULT_ELWARD_PALLET_RULES,
  options?: BuildPalletPlanOptions,
): PalletPlanResult {
  const planWarnings: PalletWarning[] = []
  const releaseKey = options?.releaseKey || 'REL'
  let sequenceCounter = options?.startSequence || 1

  // 1. Prepare and normalize candidates
  const normalizedCandidates = candidates.map((candidate) => {
    const normMat = normalizeMaterialFamily(candidate.materialFamily, rules)
    const primaryElevation = normalizeElevationName(
      candidate.primaryElevation ||
        candidate.elevationNames?.[0] ||
        'General Elevation',
    )
    const { unitWeight, warnings: weightWarnings } = calculatePanelWeight(
      candidate,
      rules,
    )
    const { stackHeight, warnings: heightWarnings } = calculatePanelStackHeight(
      candidate,
      rules,
    )

    const allWarnings: PalletWarning[] = [
      ...(candidate.warnings || []),
      ...normMat.warnings,
      ...weightWarnings,
      ...heightWarnings,
    ]

    if (
      candidate.sourceProvenance?.confidence !== undefined &&
      candidate.sourceProvenance.confidence < 0.7
    ) {
      allWarnings.push({
        code: 'LOW_EXTRACTION_CONFIDENCE',
        severity: 'INFO',
        message: `Panel '${candidate.mark}' extraction confidence is ${(
          candidate.sourceProvenance.confidence * 100
        ).toFixed(0)}%. Review recommended.`,
        entityId: candidate.panelMarkId,
      })
    }

    const availableQty =
      candidate.availableQuantity !== undefined
        ? candidate.availableQuantity
        : candidate.quantity

    return {
      ...candidate,
      canonicalMaterial: normMat.canonicalName,
      primaryElevation,
      unitWeightLbs: unitWeight.valueLbs,
      stackHeightInches: stackHeight.valueInches,
      availableQuantity: Math.max(0, availableQty),
      warnings: allWarnings,
    }
  })

  // 2. Deterministic sort of candidate panels
  // Criteria:
  // 1. Elevation natural sort
  // 2. Material family
  // 3. Footprint (Area) descending (largest base panels stacked first)
  // 4. Unit weight descending
  // 5. Mark natural sort
  const sortedCandidates = [...normalizedCandidates].sort((a, b) => {
    // 1. Elevation
    const elevCmp = a.primaryElevation.localeCompare(
      b.primaryElevation,
      undefined,
      {
        numeric: true,
        sensitivity: 'base',
      },
    )
    if (elevCmp !== 0) return elevCmp

    // 2. Material
    const matCmp = a.canonicalMaterial.localeCompare(b.canonicalMaterial)
    if (matCmp !== 0) return matCmp

    // 3. Footprint (Area) Descending
    const areaA = (a.widthInches || 0) * (a.lengthInches || 0)
    const areaB = (b.widthInches || 0) * (b.lengthInches || 0)
    if (areaB !== areaA) return areaB - areaA

    // 4. Weight Descending
    if (b.unitWeightLbs !== a.unitWeightLbs) {
      return b.unitWeightLbs - a.unitWeightLbs
    }

    // 5. Mark natural sort
    return a.mark.localeCompare(b.mark, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  })

  const pallets: PlannedPallet[] = []
  const unassigned: UnassignedPanel[] = []

  function createNewPallet(seq: number): PlannedPallet {
    const palletNumber = `PAL-${releaseKey}-${String(seq).padStart(3, '0')}`
    return {
      sequence: seq,
      plannedPalletNumber: palletNumber,
      geometry: calculatePalletGeometry([], rules),
      elevations: [],
      materialFamilies: [],
      panelCount: 0,
      items: [],
      warnings: [],
      utilizationPercent: 0,
      weightCapacityPercent: 0,
      heightCapacityPercent: 0,
    }
  }

  // 3. Pack items into pallets
  for (const candidate of sortedCandidates) {
    let remainingQuantity = candidate.availableQuantity

    if (remainingQuantity <= 0) {
      continue
    }

    if (
      (candidate.widthInches <= 0 || candidate.lengthInches <= 0) &&
      candidate.availableQuantity > 0
    ) {
      unassigned.push({
        panelMarkId: candidate.panelMarkId,
        mark: candidate.mark,
        requestedQuantity: candidate.quantity,
        unassignedQuantity: remainingQuantity,
        reason: 'Missing valid panel width or length dimensions.',
        warnings: candidate.warnings,
      })
      continue
    }

    // Try assigning to existing open pallets
    for (const pallet of pallets) {
      if (remainingQuantity <= 0) break

      // Check material compatibility
      const compat = canAddMaterialToPallet(
        pallet.materialFamilies,
        candidate.canonicalMaterial,
        rules,
      )
      if (!compat.compatible) continue

      // Calculate how many units fit by weight and height
      const currentWeight = pallet.geometry.weightLbs
      const currentHeight = pallet.geometry.heightInches

      const availableWeight = Math.max(0, rules.maxWeightLbs - currentWeight)
      const availableHeight = Math.max(
        0,
        rules.targetHeightInches - currentHeight,
      )

      const maxUnitsByWeight =
        candidate.unitWeightLbs > 0
          ? Math.floor(availableWeight / candidate.unitWeightLbs)
          : remainingQuantity
      const maxUnitsByHeight =
        candidate.stackHeightInches > 0
          ? Math.floor(availableHeight / candidate.stackHeightInches)
          : remainingQuantity

      const fitQty = Math.min(
        remainingQuantity,
        maxUnitsByWeight,
        maxUnitsByHeight,
      )

      if (fitQty > 0) {
        // Add items to this pallet
        const itemSeq = pallet.items.length + 1
        const totalItemWeight = Number(
          (fitQty * candidate.unitWeightLbs).toFixed(2),
        )
        const totalItemHeight = Number(
          (fitQty * candidate.stackHeightInches).toFixed(3),
        )

        const plannedItem: PlannedPalletItem = {
          panelMarkId: candidate.panelMarkId,
          mark: candidate.mark,
          quantity: fitQty,
          sequence: itemSeq,
          elevation: candidate.primaryElevation,
          widthInches: candidate.widthInches,
          lengthInches: candidate.lengthInches,
          thicknessInches: candidate.thicknessInches || 0.157,
          unitWeightLbs: candidate.unitWeightLbs,
          totalWeightLbs: totalItemWeight,
          stackHeightInches: totalItemHeight,
          materialFamily: candidate.materialFamily,
          color: candidate.color,
          sourceProvenance: candidate.sourceProvenance,
          warnings: candidate.warnings,
        }

        pallet.items.push(plannedItem)
        pallet.panelCount += fitQty
        if (!pallet.elevations.includes(candidate.primaryElevation)) {
          pallet.elevations.push(candidate.primaryElevation)
        }
        if (!pallet.materialFamilies.includes(candidate.canonicalMaterial)) {
          pallet.materialFamilies.push(candidate.canonicalMaterial)
        }

        const newHeight = currentHeight + totalItemHeight
        const newWeight = currentWeight + totalItemWeight
        pallet.geometry = calculatePalletGeometry(
          pallet.items,
          rules,
          newHeight,
          newWeight,
        )

        remainingQuantity -= fitQty
      }
    }

    // While there is remaining quantity, open new pallets
    while (remainingQuantity > 0) {
      const pallet = createNewPallet(sequenceCounter++)
      pallets.push(pallet)

      // Calculate how many fit on an empty pallet
      const maxUnitsByWeight =
        candidate.unitWeightLbs > 0
          ? Math.floor(rules.maxWeightLbs / candidate.unitWeightLbs)
          : remainingQuantity
      const maxUnitsByHeight =
        candidate.stackHeightInches > 0
          ? Math.floor(rules.targetHeightInches / candidate.stackHeightInches)
          : remainingQuantity

      let fitQty = Math.min(
        remainingQuantity,
        maxUnitsByWeight,
        maxUnitsByHeight,
      )

      // If an individual unit is heavier than max weight or taller than target height, allow 1 unit but create warning
      if (fitQty <= 0) {
        fitQty = 1
      }

      const totalItemWeight = Number(
        (fitQty * candidate.unitWeightLbs).toFixed(2),
      )
      const totalItemHeight = Number(
        (fitQty * candidate.stackHeightInches).toFixed(3),
      )

      const plannedItem: PlannedPalletItem = {
        panelMarkId: candidate.panelMarkId,
        mark: candidate.mark,
        quantity: fitQty,
        sequence: 1,
        elevation: candidate.primaryElevation,
        widthInches: candidate.widthInches,
        lengthInches: candidate.lengthInches,
        thicknessInches: candidate.thicknessInches || 0.157,
        unitWeightLbs: candidate.unitWeightLbs,
        totalWeightLbs: totalItemWeight,
        stackHeightInches: totalItemHeight,
        materialFamily: candidate.materialFamily,
        color: candidate.color,
        sourceProvenance: candidate.sourceProvenance,
        warnings: candidate.warnings,
      }

      pallet.items.push(plannedItem)
      pallet.panelCount = fitQty
      pallet.elevations.push(candidate.primaryElevation)
      pallet.materialFamilies.push(candidate.canonicalMaterial)
      pallet.geometry = calculatePalletGeometry(
        pallet.items,
        rules,
        totalItemHeight,
        totalItemWeight,
      )

      remainingQuantity -= fitQty
    }
  }

  // 4. Finalize pallet warnings, capacities, and statistics
  let totalPanelsCount = 0
  let totalPlanWeight = 0
  let maxPalletWeight = 0
  let sumUtilization = 0
  const allElevations = new Set<string>()
  const allMaterials = new Set<string>()

  for (const pallet of pallets) {
    totalPanelsCount += pallet.panelCount
    totalPlanWeight += pallet.geometry.weightLbs
    if (pallet.geometry.weightLbs > maxPalletWeight) {
      maxPalletWeight = pallet.geometry.weightLbs
    }

    const weightPercent = Number(
      ((pallet.geometry.weightLbs / rules.maxWeightLbs) * 100).toFixed(1),
    )
    const heightPercent = Number(
      ((pallet.geometry.heightInches / rules.targetHeightInches) * 100).toFixed(
        1,
      ),
    )

    pallet.weightCapacityPercent = weightPercent
    pallet.heightCapacityPercent = heightPercent
    pallet.utilizationPercent = Math.max(weightPercent, heightPercent)
    sumUtilization += pallet.utilizationPercent

    for (const e of pallet.elevations) allElevations.add(e)
    for (const m of pallet.materialFamilies) allMaterials.add(m)

    // Check weight warnings
    if (pallet.geometry.weightLbs > rules.maxWeightLbs) {
      pallet.warnings.push({
        code: 'WEIGHT_TARGET_EXCEEDED',
        severity: 'BLOCKING',
        message: `Pallet exceeds maximum target weight (${pallet.geometry.weightLbs} lbs > ${rules.maxWeightLbs} lbs). Split or supervisor override required.`,
        originalValue: pallet.geometry.weightLbs,
        suggestedValue: rules.maxWeightLbs,
      })
    }

    // Check height warnings
    if (pallet.geometry.heightInches > rules.targetHeightInches) {
      const isOverLimit =
        pallet.geometry.heightInches > rules.maxHeightLimitInches
      pallet.warnings.push({
        code: 'HEIGHT_TARGET_EXCEEDED',
        severity: isOverLimit ? 'BLOCKING' : 'WARNING',
        message: `Pallet height (${pallet.geometry.heightInches.toFixed(1)}") exceeds standard target (${rules.targetHeightInches}"). Exception review required.`,
        originalValue: pallet.geometry.heightInches,
        suggestedValue: rules.targetHeightInches,
      })
    }

    // Collect item warnings on pallet
    for (const item of pallet.items) {
      for (const w of item.warnings) {
        if (
          !pallet.warnings.some(
            (pw) => pw.code === w.code && pw.message === w.message,
          )
        ) {
          pallet.warnings.push(w)
        }
      }
    }
  }

  const averageUtilization =
    pallets.length > 0
      ? Number((sumUtilization / pallets.length).toFixed(1))
      : 0

  return {
    algorithmVersion: PALLET_PLANNER_VERSION,
    pallets,
    unassigned,
    warnings: planWarnings,
    statistics: {
      totalPanels: totalPanelsCount,
      palletCount: pallets.length,
      totalWeightLbs: Number(totalPlanWeight.toFixed(2)),
      maxPalletWeightLbs: Number(maxPalletWeight.toFixed(2)),
      averageUtilizationPercent: averageUtilization,
      elevationsRepresented: Array.from(allElevations),
      materialFamiliesRepresented: Array.from(allMaterials),
    },
  }
}
