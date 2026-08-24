export const PALLET_PLANNER_VERSION = '1.0.0'

export type PalletWarningCode =
  | 'UNKNOWN_MATERIAL'
  | 'WEIGHT_ESTIMATED'
  | 'HEIGHT_ESTIMATED'
  | 'HEIGHT_TARGET_EXCEEDED'
  | 'WEIGHT_TARGET_EXCEEDED'
  | 'MATERIAL_COMPATIBILITY_UNKNOWN'
  | 'MATERIAL_INCOMPATIBLE'
  | 'MISSING_DIMENSIONS'
  | 'MISSING_ELEVATION'
  | 'LOW_EXTRACTION_CONFIDENCE'
  | 'REVISION_SUPERSEDED'
  | 'DUPLICATE_PANEL_ASSIGNMENT'
  | 'UNASSIGNED_PANEL'
  | 'QUANTITY_EXCEEDED'
  | 'MANUAL_OVERRIDE_REQUIRED'

export type PalletWarningSeverity = 'INFO' | 'WARNING' | 'BLOCKING'

export interface PalletWarning {
  code: PalletWarningCode
  severity: PalletWarningSeverity
  message: string
  entityId?: string
  field?: string
  originalValue?: unknown
  suggestedValue?: unknown
}

export interface PalletWarningOverride {
  warningCode: PalletWarningCode
  entityId?: string
  overriddenBy: string
  overriddenAt: string
  reason: string
  originalValue?: unknown
  resultingValue?: unknown
}

export type WeightMethod =
  'SOURCE' | 'DIMENSION_CALCULATION' | 'MATERIAL_RULE' | 'FALLBACK'

export interface WeightCalculationResult {
  valueLbs: number
  method: WeightMethod
  confidence: number
}

export interface StackHeightCalculationResult {
  valueInches: number
  method: 'SOURCE' | 'CALCULATED' | 'FALLBACK'
  confidence: number
}

export type PalletOrientation = 'STANDARD' | 'ROTATED'

export interface PalletGeometry {
  widthInches: number
  lengthInches: number
  heightInches: number
  weightLbs: number
  borderInches: number
  orientation: PalletOrientation
}

export interface MaterialPalletRule {
  canonicalName: string
  aliases: string[]
  borderInches: number
  densityLbsPerCubicInch?: number
  unitWeightLbsPerSqFt?: number
  defaultThicknessInches?: number
  stackAllowanceInches?: number
  compatibleWith?: string[]
  requiresReview?: boolean
}

export interface PalletizationRuleSet {
  version: string
  maxWeightLbs: number
  targetHeightInches: number
  maxHeightLimitInches: number
  defaultBorderInches: number
  borderByMaterial: Record<string, number>
  materialRules: Record<string, MaterialPalletRule>
  allowMaterialMixing: boolean
  elevationGroupingPreference: boolean
}

export interface DocumentSourceProvenance {
  documentId?: string
  documentName?: string
  documentType?:
    | 'SHOP_DRAWING'
    | 'ELEVATION_MATRIX'
    | 'TAKEOFF'
    | 'CUT_DRAWING'
    | 'ASSEMBLY_DRAWING'
    | 'OTHER'
  page?: number
  confidence?: number
  extractedAt?: string
  rawText?: string
}

export interface PalletCandidate {
  panelMarkId: string
  mark: string
  description?: string
  elevationIds?: string[]
  elevationNames?: string[]
  primaryElevation?: string
  materialFamily: string
  materialVariant?: string
  color?: string
  widthInches: number
  lengthInches: number
  thicknessInches?: number
  quantity: number
  availableQuantity: number
  unitWeightLbs?: number
  stackThicknessInches?: number
  sourceProvenance?: DocumentSourceProvenance
  warnings?: PalletWarning[]
}

export interface PlannedPalletItem {
  id?: string
  panelMarkId: string
  mark: string
  quantity: number
  sequence: number
  elevation: string
  widthInches: number
  lengthInches: number
  thicknessInches: number
  unitWeightLbs: number
  totalWeightLbs: number
  stackHeightInches: number
  materialFamily: string
  color?: string
  sourceProvenance?: DocumentSourceProvenance
  warnings: PalletWarning[]
}

export interface PlannedPallet {
  id?: string
  sequence: number
  plannedPalletNumber: string
  geometry: PalletGeometry
  elevations: string[]
  materialFamilies: string[]
  panelCount: number
  items: PlannedPalletItem[]
  warnings: PalletWarning[]
  overrides?: PalletWarningOverride[]
  notes?: string
  utilizationPercent: number
  weightCapacityPercent: number
  heightCapacityPercent: number
}

export interface UnassignedPanel {
  panelMarkId: string
  mark: string
  requestedQuantity: number
  unassignedQuantity: number
  reason: string
  warnings: PalletWarning[]
}

export interface PalletPlanStatistics {
  totalPanels: number
  palletCount: number
  totalWeightLbs: number
  maxPalletWeightLbs: number
  averageUtilizationPercent: number
  elevationsRepresented: string[]
  materialFamiliesRepresented: string[]
}

export interface PalletPlanResult {
  algorithmVersion: string
  pallets: PlannedPallet[]
  unassigned: UnassignedPanel[]
  warnings: PalletWarning[]
  statistics: PalletPlanStatistics
}

export type CompatibilityResult =
  { compatible: true; reason?: string } | { compatible: false; reason: string }
