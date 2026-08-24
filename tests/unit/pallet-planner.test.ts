import { describe, it, expect } from 'vitest'
import {
  buildPalletPlan,
  DEFAULT_ELWARD_PALLET_RULES,
  calculatePalletGeometry,
  normalizeMaterialFamily,
  validateDuplicateAssignments,
  validatePalletForStaging,
  PalletCandidate,
} from '@/lib/domain/palletization'

describe('Intelligent Pallet Planner Domain Unit Tests', () => {
  // Test 1: One elevation fits one pallet
  it('Test 1: One elevation fits one pallet within standard limits', () => {
    const candidates: PalletCandidate[] = [
      {
        panelMarkId: 'p-1',
        mark: 'N-101',
        primaryElevation: 'North Elevation',
        materialFamily: 'ACM',
        widthInches: 48,
        lengthInches: 96,
        quantity: 10,
        availableQuantity: 10,
        unitWeightLbs: 30, // 300 lbs total
        stackThicknessInches: 0.75, // 7.5" height total
      },
    ]

    const result = buildPalletPlan(candidates, DEFAULT_ELWARD_PALLET_RULES, {
      releaseKey: '54120-R1',
    })

    expect(result.pallets.length).toBe(1)
    expect(result.pallets[0].panelCount).toBe(10)
    expect(result.pallets[0].elevations).toEqual(['North Elevation'])
    expect(result.pallets[0].geometry.weightLbs).toBe(300)
    expect(result.pallets[0].geometry.heightInches).toBe(7.5)
  })

  // Test 2: One elevation exceeds 3,500 lb and splits into two pallets
  it('Test 2: One elevation exceeds 3,500 lb and automatically splits into multiple pallets', () => {
    const candidates: PalletCandidate[] = [
      {
        panelMarkId: 'p-heavy',
        mark: 'E-201',
        primaryElevation: 'East Elevation',
        materialFamily: 'SWISSPEARL',
        widthInches: 48,
        lengthInches: 120,
        quantity: 40,
        availableQuantity: 40,
        unitWeightLbs: 100, // 4,000 lbs total > 3,500 max limit
        stackThicknessInches: 0.35,
      },
    ]

    const result = buildPalletPlan(candidates, DEFAULT_ELWARD_PALLET_RULES)

    expect(result.pallets.length).toBe(2)
    // Pallet 1 should have 35 panels (3,500 lbs max)
    expect(result.pallets[0].panelCount).toBe(35)
    expect(result.pallets[0].geometry.weightLbs).toBe(3500)
    // Pallet 2 should have remaining 5 panels (500 lbs)
    expect(result.pallets[1].panelCount).toBe(5)
    expect(result.pallets[1].geometry.weightLbs).toBe(500)
    expect(result.statistics.totalWeightLbs).toBe(4000)
  })

  // Test 3: Multiple elevations fit one pallet
  it('Test 3: Multiple elevations fit onto a single pallet', () => {
    const candidates: PalletCandidate[] = [
      {
        panelMarkId: 'p-n1',
        mark: 'N-01',
        primaryElevation: 'North Elevation',
        materialFamily: 'DRY',
        widthInches: 36,
        lengthInches: 72,
        quantity: 5,
        availableQuantity: 5,
        unitWeightLbs: 25,
        stackThicknessInches: 0.75,
      },
      {
        panelMarkId: 'p-e1',
        mark: 'EC-01',
        primaryElevation: 'East Canopy',
        materialFamily: 'DRY',
        widthInches: 36,
        lengthInches: 72,
        quantity: 5,
        availableQuantity: 5,
        unitWeightLbs: 25,
        stackThicknessInches: 0.75,
      },
    ]

    const result = buildPalletPlan(candidates, DEFAULT_ELWARD_PALLET_RULES)

    expect(result.pallets.length).toBe(1)
    expect(result.pallets[0].panelCount).toBe(10)
    expect(result.pallets[0].elevations).toContain('North Elevation')
    expect(result.pallets[0].elevations).toContain('East Canopy')
  })

  // Test 4: One elevation spans multiple pallets
  it('Test 4: One elevation spans multiple pallets when panel count/weight requires it', () => {
    const candidates: PalletCandidate[] = [
      {
        panelMarkId: 'p-s1',
        mark: 'S-101',
        primaryElevation: 'South Elevation',
        materialFamily: 'TRESPA',
        widthInches: 48,
        lengthInches: 120,
        quantity: 60,
        availableQuantity: 60,
        unitWeightLbs: 70, // 4,200 lbs total
        stackThicknessInches: 0.35,
      },
    ]

    const result = buildPalletPlan(candidates, DEFAULT_ELWARD_PALLET_RULES)

    expect(result.pallets.length).toBeGreaterThan(1)
    for (const p of result.pallets) {
      expect(p.elevations).toContain('South Elevation')
    }
  })

  // Test 5: Swisspearl applies 1.5" border
  it('Test 5: Swisspearl applies 1.5" border allowance', () => {
    const norm = normalizeMaterialFamily('Swisspearl')
    expect(norm.borderInches).toBe(1.5)

    const geo = calculatePalletGeometry([
      { widthInches: 48, lengthInches: 120, materialFamily: 'Swisspearl' },
    ])
    // 48 + 2*1.5 = 51", 120 + 2*1.5 = 123"
    expect(geo.borderInches).toBe(1.5)
    expect(geo.widthInches).toBe(51)
    expect(geo.lengthInches).toBe(123)
  })

  // Test 6: Trespa applies 1.5" border
  it('Test 6: Trespa applies 1.5" border allowance', () => {
    const norm = normalizeMaterialFamily('TRESPA METEON')
    expect(norm.borderInches).toBe(1.5)

    const geo = calculatePalletGeometry([
      { widthInches: 50, lengthInches: 100, materialFamily: 'Trespa' },
    ])
    expect(geo.borderInches).toBe(1.5)
    expect(geo.widthInches).toBe(53)
    expect(geo.lengthInches).toBe(103)
  })

  // Test 7: SRS applies 2" border
  it('Test 7: SRS applies 2" border allowance', () => {
    const norm = normalizeMaterialFamily('SRS_SYSTEM')
    expect(norm.borderInches).toBe(2.0)

    const geo = calculatePalletGeometry([
      { widthInches: 40, lengthInches: 80, materialFamily: 'SRS' },
    ])
    expect(geo.borderInches).toBe(2.0)
    expect(geo.widthInches).toBe(44)
    expect(geo.lengthInches).toBe(84)
  })

  // Test 8: Dry/Wet/PER applies 4" border
  it('Test 8: Dry / Wet / PER systems apply 4" border allowance', () => {
    expect(normalizeMaterialFamily('DRY').borderInches).toBe(4.0)
    expect(normalizeMaterialFamily('WET_SYSTEM').borderInches).toBe(4.0)
    expect(normalizeMaterialFamily('PER SYSTEM').borderInches).toBe(4.0)

    const geo = calculatePalletGeometry([
      { widthInches: 48, lengthInches: 96, materialFamily: 'Dry System' },
    ])
    expect(geo.borderInches).toBe(4.0)
    expect(geo.widthInches).toBe(56) // 48 + 8
    expect(geo.lengthInches).toBe(104) // 96 + 8
  })

  // Test 9: Unknown material generates review warning
  it('Test 9: Unknown material generates review warning without crashing', () => {
    const norm = normalizeMaterialFamily('Exotic Composite X99')
    expect(norm.warnings.length).toBeGreaterThan(0)
    expect(norm.warnings[0].code).toBe('UNKNOWN_MATERIAL')
    expect(norm.borderInches).toBe(
      DEFAULT_ELWARD_PALLET_RULES.defaultBorderInches,
    )

    const candidates: PalletCandidate[] = [
      {
        panelMarkId: 'p-unk',
        mark: 'UNK-1',
        primaryElevation: 'West Elevation',
        materialFamily: 'Exotic Composite X99',
        widthInches: 30,
        lengthInches: 60,
        quantity: 4,
        availableQuantity: 4,
      },
    ]

    const result = buildPalletPlan(candidates)
    expect(
      result.pallets[0].warnings.some((w) => w.code === 'UNKNOWN_MATERIAL'),
    ).toBe(true)
  })

  // Test 10: Duplicate assignment is rejected
  it('Test 10: Duplicate panel assignment exceeding available quantity is flagged and rejected', () => {
    const candidates: PalletCandidate[] = [
      {
        panelMarkId: 'p-dup',
        mark: 'DUP-100',
        materialFamily: 'ACM',
        widthInches: 48,
        lengthInches: 96,
        quantity: 10,
        availableQuantity: 10,
      },
    ]

    // Construct invalid planned pallets with 15 assigned total
    const plan = buildPalletPlan(candidates)
    plan.pallets[0].items[0].quantity = 15 // manually mutated to exceed

    const val = validateDuplicateAssignments(plan.pallets, candidates)
    expect(val.isValid).toBe(false)
    expect(val.errors.length).toBeGreaterThan(0)
    expect(val.errors[0]).toContain('Duplicate Assignment Violation')
  })

  // Test 11: Panel quantity can be split across pallets
  it('Test 11: Single panel mark quantity can be split across multiple pallets', () => {
    const candidates: PalletCandidate[] = [
      {
        panelMarkId: 'p-split',
        mark: 'E-104',
        primaryElevation: 'East Elevation',
        materialFamily: 'ACM',
        widthInches: 48,
        lengthInches: 120,
        quantity: 18,
        availableQuantity: 18,
        unitWeightLbs: 250, // 18 * 250 = 4,500 lbs total
        stackThicknessInches: 0.75,
      },
    ]

    const result = buildPalletPlan(candidates, DEFAULT_ELWARD_PALLET_RULES)

    expect(result.pallets.length).toBe(2)
    // Pallet 1 gets 14 (3500 lbs)
    expect(result.pallets[0].items[0].mark).toBe('E-104')
    expect(result.pallets[0].items[0].quantity).toBe(14)
    // Pallet 2 gets 4 (1000 lbs)
    expect(result.pallets[1].items[0].mark).toBe('E-104')
    expect(result.pallets[1].items[0].quantity).toBe(4)
    expect(
      result.pallets[0].items[0].quantity + result.pallets[1].items[0].quantity,
    ).toBe(18)
  })

  // Test 12: 60" target height generates proper warning/split behavior
  it('Test 12: 60" target height triggers split or warning without silent failure', () => {
    const candidates: PalletCandidate[] = [
      {
        panelMarkId: 'p-tall',
        mark: 'T-101',
        materialFamily: 'DRY',
        widthInches: 48,
        lengthInches: 96,
        quantity: 100, // 100 * 0.75" = 75" > 60"
        availableQuantity: 100,
        unitWeightLbs: 10, // 1,000 lbs total (fits weight, height bound)
        stackThicknessInches: 0.75,
      },
    ]

    const result = buildPalletPlan(candidates, DEFAULT_ELWARD_PALLET_RULES)

    expect(result.pallets.length).toBe(2)
    // 60" / 0.75" = 80 panels on pallet 1, 20 on pallet 2
    expect(result.pallets[0].panelCount).toBe(80)
    expect(result.pallets[0].geometry.heightInches).toBe(60)
    expect(result.pallets[1].panelCount).toBe(20)
    expect(result.pallets[1].geometry.heightInches).toBe(15)
  })

  // Test 13: 3,500 lb is never silently exceeded
  it('Test 13: 3,500 lb target maximum is strictly enforced by bin packing', () => {
    const candidates: PalletCandidate[] = Array.from(
      { length: 50 },
      (_, i) => ({
        panelMarkId: `pm-${i}`,
        mark: `PM-${i + 1}`,
        materialFamily: 'ACM',
        widthInches: 48,
        lengthInches: 96,
        quantity: 2,
        availableQuantity: 2,
        unitWeightLbs: 45, // 50 * 2 * 45 = 4,500 lbs total
        stackThicknessInches: 0.5,
      }),
    )

    const result = buildPalletPlan(candidates, DEFAULT_ELWARD_PALLET_RULES)

    for (const p of result.pallets) {
      expect(p.geometry.weightLbs).toBeLessThanOrEqual(3500)
    }
  })

  // Test 14: Planner output is deterministic
  it('Test 14: Planner output is completely deterministic across repeated executions', () => {
    const candidates: PalletCandidate[] = [
      {
        panelMarkId: 'p-1',
        mark: 'N-01',
        primaryElevation: 'North',
        materialFamily: 'ACM',
        widthInches: 48,
        lengthInches: 96,
        quantity: 12,
        availableQuantity: 12,
        unitWeightLbs: 35,
      },
      {
        panelMarkId: 'p-2',
        mark: 'E-01',
        primaryElevation: 'East',
        materialFamily: 'ACM',
        widthInches: 36,
        lengthInches: 72,
        quantity: 8,
        availableQuantity: 8,
        unitWeightLbs: 20,
      },
      {
        panelMarkId: 'p-3',
        mark: 'S-01',
        primaryElevation: 'South',
        materialFamily: 'ACM',
        widthInches: 48,
        lengthInches: 120,
        quantity: 15,
        availableQuantity: 15,
        unitWeightLbs: 40,
      },
    ]

    const run1 = buildPalletPlan(candidates, DEFAULT_ELWARD_PALLET_RULES)
    const run2 = buildPalletPlan(candidates, DEFAULT_ELWARD_PALLET_RULES)
    const run3 = buildPalletPlan(candidates, DEFAULT_ELWARD_PALLET_RULES)

    expect(JSON.stringify(run1)).toEqual(JSON.stringify(run2))
    expect(JSON.stringify(run2)).toEqual(JSON.stringify(run3))
  })

  // Test 15: Staging validation blocks invalid / superseded states
  it('Test 15: Staging validation blocks staging on superseded revision or QC hold', () => {
    const validPallet = {
      id: 'pal-1',
      palletNumber: 'PAL-54120-R1-001',
      status: 'Building',
      panelCount: 10,
      currentWeightLbs: 500,
      maxWeightLbs: 3500,
      currentHeightInches: 20,
      maxHeightInches: 60,
    }

    const resValid = validatePalletForStaging(validPallet, {
      isCurrentRevision: true,
      hasActiveQCHold: false,
    })
    expect(resValid.canStage).toBe(true)

    const resSuperseded = validatePalletForStaging(validPallet, {
      isCurrentRevision: false,
      hasActiveQCHold: false,
    })
    expect(resSuperseded.canStage).toBe(false)
    expect(resSuperseded.errors[0]).toContain('superseded')

    const resQCHold = validatePalletForStaging(validPallet, {
      isCurrentRevision: true,
      hasActiveQCHold: true,
    })
    expect(resQCHold.canStage).toBe(false)
    expect(resQCHold.errors[0]).toContain('QC Hold')
  })

  // Synthetic Release Fixture Test
  it('Synthetic Release Fixture: Successfully processes 150-panel multi-elevation multi-material release', async () => {
    const { createSyntheticReleaseFixture } =
      await import('@/scripts/seed-pallet-planning-fixture')
    const fixture = createSyntheticReleaseFixture()
    expect(fixture.reduce((sum, p) => sum + p.quantity, 0)).toBe(150)

    const result = buildPalletPlan(fixture, DEFAULT_ELWARD_PALLET_RULES, {
      releaseKey: '25036-R1',
    })

    expect(result.statistics.totalPanels).toBe(150)
    expect(result.pallets.length).toBeGreaterThan(3)

    // Verify North Elevation is split into at least 2 pallets
    const northPallets = result.pallets.filter((p) =>
      p.elevations.includes('North Elevation'),
    )
    expect(northPallets.length).toBeGreaterThanOrEqual(2)

    // Verify multi-elevation pallet exists (e.g. East Canopy and West Courtyard)
    const multiElevPallet = result.pallets.find((p) => p.elevations.length > 1)
    expect(multiElevPallet).toBeDefined()
    expect(multiElevPallet!.elevations).toContain('East Canopy')
    expect(multiElevPallet!.elevations).toContain('West Courtyard')

    // Verify no pallet silently exceeds 3,500 lb
    for (const p of result.pallets) {
      expect(p.geometry.weightLbs).toBeLessThanOrEqual(3500)
    }
  })
})
