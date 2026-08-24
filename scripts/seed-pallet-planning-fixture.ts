import { PalletCandidate } from '@/lib/domain/palletization'

/**
 * Realistic synthetic release fixture for intelligent pallet planning.
 * Contains 150 total panels across 5 distinct elevations, 4 material families,
 * multi-pallet elevations, and multi-elevation grouping scenarios.
 */
export function createSyntheticReleaseFixture(): PalletCandidate[] {
  return [
    // 1. North Elevation — Swisspearl (Heavy fiber cement, requires 2+ pallets)
    {
      panelMarkId: 'pm-n-01',
      mark: 'N-101',
      primaryElevation: 'North Elevation',
      elevationNames: ['North Elevation'],
      materialFamily: 'Swisspearl',
      color: 'Reflex Autumn',
      widthInches: 48,
      lengthInches: 120,
      thicknessInches: 0.315, // 8mm
      quantity: 24,
      availableQuantity: 24,
      unitWeightLbs: 128, // 24 * 128 = 3,072 lbs
      stackThicknessInches: 0.365,
      sourceProvenance: {
        documentName: '25036_R1_Shop_Drawings.pdf',
        documentType: 'SHOP_DRAWING',
        page: 12,
        confidence: 0.98,
      },
    },
    {
      panelMarkId: 'pm-n-02',
      mark: 'N-102',
      primaryElevation: 'North Elevation',
      elevationNames: ['North Elevation'],
      materialFamily: 'Swisspearl',
      color: 'Reflex Autumn',
      widthInches: 48,
      lengthInches: 96,
      thicknessInches: 0.315,
      quantity: 16,
      availableQuantity: 16,
      unitWeightLbs: 102, // 16 * 102 = 1,632 lbs -> Forces North Elev into Pallet 2
      stackThicknessInches: 0.365,
      sourceProvenance: {
        documentName: '25036_R1_Shop_Drawings.pdf',
        documentType: 'SHOP_DRAWING',
        page: 13,
        confidence: 0.97,
      },
    },

    // 2. East Canopy — ACM Dry System (Small quantities, mixes with Courtyard on 1 pallet)
    {
      panelMarkId: 'pm-ec-01',
      mark: 'EC-01',
      primaryElevation: 'East Canopy',
      elevationNames: ['East Canopy'],
      materialFamily: 'DRY',
      color: 'Bone White',
      widthInches: 36,
      lengthInches: 72,
      thicknessInches: 0.157,
      quantity: 8,
      availableQuantity: 8,
      unitWeightLbs: 27,
      stackThicknessInches: 0.75,
      sourceProvenance: {
        documentName: '25036_R1_Elevation_Matrix.pdf',
        documentType: 'ELEVATION_MATRIX',
        page: 4,
        confidence: 0.95,
      },
    },
    {
      panelMarkId: 'pm-ec-02',
      mark: 'EC-02',
      primaryElevation: 'East Canopy',
      elevationNames: ['East Canopy'],
      materialFamily: 'DRY',
      color: 'Bone White',
      widthInches: 36,
      lengthInches: 72,
      thicknessInches: 0.157,
      quantity: 6,
      availableQuantity: 6,
      unitWeightLbs: 27,
      stackThicknessInches: 0.75,
      sourceProvenance: {
        documentName: '25036_R1_Elevation_Matrix.pdf',
        documentType: 'ELEVATION_MATRIX',
        page: 4,
        confidence: 0.94,
      },
    },

    // 3. West Courtyard — ACM Dry System (Mixes with East Canopy)
    {
      panelMarkId: 'pm-wc-01',
      mark: 'WC-10',
      primaryElevation: 'West Courtyard',
      elevationNames: ['West Courtyard'],
      materialFamily: 'DRY',
      color: 'Bone White',
      widthInches: 36,
      lengthInches: 72,
      thicknessInches: 0.157,
      quantity: 10,
      availableQuantity: 10,
      unitWeightLbs: 27,
      stackThicknessInches: 0.75,
      sourceProvenance: {
        documentName: '25036_R1_Shop_Drawings.pdf',
        documentType: 'SHOP_DRAWING',
        page: 22,
        confidence: 0.96,
      },
    },

    // 4. South Elevation — Trespa Meteon (HPL Rainscreen)
    {
      panelMarkId: 'pm-s-01',
      mark: 'S-201',
      primaryElevation: 'South Elevation',
      elevationNames: ['South Elevation'],
      materialFamily: 'TRESPA',
      color: 'Anthracite Grey',
      widthInches: 50,
      lengthInches: 120,
      thicknessInches: 0.315,
      quantity: 20,
      availableQuantity: 20,
      unitWeightLbs: 120, // 2,400 lbs
      stackThicknessInches: 0.365,
      sourceProvenance: {
        documentName: '25036_R1_Shop_Drawings.pdf',
        documentType: 'SHOP_DRAWING',
        page: 30,
        confidence: 0.99,
      },
    },
    {
      panelMarkId: 'pm-s-02',
      mark: 'S-202',
      primaryElevation: 'South Elevation',
      elevationNames: ['South Elevation'],
      materialFamily: 'TRESPA',
      color: 'Anthracite Grey',
      widthInches: 50,
      lengthInches: 96,
      thicknessInches: 0.315,
      quantity: 16,
      availableQuantity: 16,
      unitWeightLbs: 96, // 1,536 lbs
      stackThicknessInches: 0.365,
      sourceProvenance: {
        documentName: '25036_R1_Shop_Drawings.pdf',
        documentType: 'SHOP_DRAWING',
        page: 31,
        confidence: 0.98,
      },
    },

    // 5. Tower Level 5 — SRS Pressure Equalized (50 panels)
    {
      panelMarkId: 'pm-t5-01',
      mark: 'T5-01',
      primaryElevation: 'Tower Level 5',
      elevationNames: ['Tower Level 5'],
      materialFamily: 'SRS',
      color: 'Mica Platinum',
      widthInches: 48,
      lengthInches: 96,
      thicknessInches: 0.157,
      quantity: 30,
      availableQuantity: 30,
      unitWeightLbs: 51,
      stackThicknessInches: 0.65,
      sourceProvenance: {
        documentName: '25036_R1_Elevation_Matrix.pdf',
        documentType: 'ELEVATION_MATRIX',
        page: 8,
        confidence: 0.95,
      },
    },
    {
      panelMarkId: 'pm-t5-02',
      mark: 'T5-02',
      primaryElevation: 'Tower Level 5',
      elevationNames: ['Tower Level 5'],
      materialFamily: 'SRS',
      color: 'Mica Platinum',
      widthInches: 48,
      lengthInches: 96,
      thicknessInches: 0.157,
      quantity: 20,
      availableQuantity: 20,
      unitWeightLbs: 51,
      stackThicknessInches: 0.65,
      sourceProvenance: {
        documentName: '25036_R1_Elevation_Matrix.pdf',
        documentType: 'ELEVATION_MATRIX',
        page: 9,
        confidence: 0.95,
      },
    },
  ]
}
