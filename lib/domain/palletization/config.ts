import { PalletizationRuleSet } from './types'

export const DEFAULT_ELWARD_PALLET_RULES: PalletizationRuleSet = {
  version: '1.0.0',
  maxWeightLbs: 3500,
  targetHeightInches: 60.0,
  maxHeightLimitInches: 72.0,
  defaultBorderInches: 4.0,
  borderByMaterial: {
    SWISSPEARL: 1.5,
    TRESPA: 1.5,
    SRS: 2.0,
    DRY: 4.0,
    WET: 4.0,
    PER: 4.0,
    ACM: 4.0,
    PLATE: 3.0,
  },
  materialRules: {
    SWISSPEARL: {
      canonicalName: 'SWISSPEARL',
      aliases: [
        'SWISSPEARL',
        'SWISS PEARL',
        'SP',
        'FIBER CEMENT',
        'FIBERCEMENT',
        'CEMBRIT',
        'EQUIONE',
      ],
      borderInches: 1.5,
      unitWeightLbsPerSqFt: 3.2,
      defaultThicknessInches: 0.315, // 8mm
      stackAllowanceInches: 0.05, // protective sheets
      compatibleWith: ['SWISSPEARL', 'FIBER_CEMENT'],
      requiresReview: false,
    },
    TRESPA: {
      canonicalName: 'TRESPA',
      aliases: [
        'TRESPA',
        'TRESPA METEON',
        'METEON',
        'HPL',
        'HIGH PRESSURE LAMINATE',
        'PURCELL',
        'FUNDERMAX',
      ],
      borderInches: 1.5,
      unitWeightLbsPerSqFt: 2.9,
      defaultThicknessInches: 0.315, // 8mm
      stackAllowanceInches: 0.05,
      compatibleWith: ['TRESPA', 'HPL'],
      requiresReview: false,
    },
    SRS: {
      canonicalName: 'SRS',
      aliases: ['SRS', 'RAINSCREEN', 'SRS SYSTEM', 'SRS_SYSTEM', 'RAIN SCREEN'],
      borderInches: 2.0,
      unitWeightLbsPerSqFt: 1.6,
      defaultThicknessInches: 0.157, // 4mm
      stackAllowanceInches: 0.6, // formed return flanges / clips
      compatibleWith: ['SRS', 'DRY', 'WET', 'PER', 'ACM'],
      requiresReview: false,
    },
    DRY: {
      canonicalName: 'DRY',
      aliases: [
        'DRY',
        'DRY SYSTEM',
        'DRY_SYSTEM',
        'DRY SEAL',
        'DRY_SEAL',
        'D-SYSTEM',
        'ACM DRY',
      ],
      borderInches: 4.0,
      unitWeightLbsPerSqFt: 1.5,
      defaultThicknessInches: 0.157, // 4mm ACM
      stackAllowanceInches: 0.75, // route and return fabricated flange profile
      compatibleWith: ['DRY', 'SRS', 'WET', 'PER', 'ACM'],
      requiresReview: false,
    },
    WET: {
      canonicalName: 'WET',
      aliases: [
        'WET',
        'WET SYSTEM',
        'WET_SYSTEM',
        'WET SEAL',
        'WET_SEAL',
        'W-SYSTEM',
        'ACM WET',
        'CAULK JOINT',
      ],
      borderInches: 4.0,
      unitWeightLbsPerSqFt: 1.5,
      defaultThicknessInches: 0.157, // 4mm ACM
      stackAllowanceInches: 0.75,
      compatibleWith: ['WET', 'DRY', 'SRS', 'PER', 'ACM'],
      requiresReview: false,
    },
    PER: {
      canonicalName: 'PER',
      aliases: [
        'PER',
        'PER SYSTEM',
        'PER_SYSTEM',
        'PRESSURE EQUALIZED',
        'PRESSURE EQUALIZED RAINSCREEN',
        'PER-SYSTEM',
      ],
      borderInches: 4.0,
      unitWeightLbsPerSqFt: 1.55,
      defaultThicknessInches: 0.157,
      stackAllowanceInches: 0.75,
      compatibleWith: ['PER', 'DRY', 'WET', 'SRS', 'ACM'],
      requiresReview: false,
    },
    ACM: {
      canonicalName: 'ACM',
      aliases: [
        'ACM',
        'ALUMINUM COMPOSITE',
        'ALUMINIUM COMPOSITE',
        'ALUCOBOND',
        'REYNOBOND',
        'ALPOLIC',
        'LARSON',
      ],
      borderInches: 4.0,
      unitWeightLbsPerSqFt: 1.45,
      defaultThicknessInches: 0.157, // 4mm
      stackAllowanceInches: 0.75,
      compatibleWith: ['ACM', 'DRY', 'WET', 'PER', 'SRS'],
      requiresReview: false,
    },
    PLATE: {
      canonicalName: 'PLATE',
      aliases: [
        'PLATE',
        'SOLID ALUMINUM',
        'SOLID_ALUMINUM',
        'ALUMINUM PLATE',
        '1/8 PLATE',
        '.125 PLATE',
      ],
      borderInches: 3.0,
      unitWeightLbsPerSqFt: 1.8,
      defaultThicknessInches: 0.125,
      stackAllowanceInches: 0.5,
      compatibleWith: ['PLATE'],
      requiresReview: false,
    },
  },
  allowMaterialMixing: false, // by default prefer keeping material families grouped
  elevationGroupingPreference: true,
}
