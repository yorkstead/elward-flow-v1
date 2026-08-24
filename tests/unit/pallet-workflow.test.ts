import { describe, it, expect, vi } from 'vitest'
import { PalletService, PalletSummary } from '@/lib/services/pallet'

describe('Pallet Workflow & Stacking Logic', () => {
  const mockUserContext = {
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'packager@elward.test',
    roles: ['pallet builder/packager', 'operator'],
    isAdmin: false,
    organizationId: '00000000-0000-0000-0000-000000000001',
  }

  it('exports packing slip CSV with correct headers and data formatting', async () => {
    // Mock getPalletById
    const samplePallet: PalletSummary = {
      id: 'pallet-001',
      palletNumber: 'PAL-54120-R1-001',
      releaseId: 'rel-001',
      releaseKey: '54120-R1',
      jobNumber: '54120',
      jobName: 'Tempe Gateway',
      status: 'Staged',
      elevation: 'North Elevation',
      elevations: ['North Elevation'],
      widthInches: 56,
      lengthInches: 128,
      borderInches: 4,
      maxHeightInches: 60,
      currentHeightInches: 18,
      maxWeightLbs: 3500,
      currentWeightLbs: 444,
      panelCount: 24,
      builderName: 'Maria Gonzalez',
      completedAt: '2026-08-20T00:00:00.000Z',
      notes: 'Strapped',
      createdAt: '2026-08-20T00:00:00.000Z',
      items: [
        {
          id: 'item-1',
          palletId: 'pallet-001',
          panelMarkId: 'mark-101',
          markCode: 'P-101',
          materialFamily: 'Reynobond 4mm ACM',
          color: 'Bone White',
          dimensions: '48 x 120',
          elevation: 'North Elevation',
          unitWeightLbs: 18.5,
          totalWeightLbs: 444,
          quantity: 24,
          sequence: 1,
          stagedAt: '2026-08-20T00:00:00.000Z',
        },
      ],
    }

    vi.spyOn(PalletService, 'getPalletById').mockResolvedValue(samplePallet)

    const csv = await PalletService.exportPackingSlipCsv(
      mockUserContext,
      'pallet-001',
    )

    expect(csv).toContain('Pallet Number,Release Key,Job Number')
    expect(csv).toContain('"PAL-54120-R1-001"')
    expect(csv).toContain('"P-101"')
    expect(csv).toContain('"Reynobond 4mm ACM"')
    expect(csv).toContain('24')
  })
})
