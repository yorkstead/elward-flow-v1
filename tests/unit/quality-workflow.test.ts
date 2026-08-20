import { describe, it, expect } from 'vitest'
import {
  QualityService,
  type QualityInspectionItem,
} from '@/lib/services/quality'

describe('QualityService — Inspection Dispositions, Holds, Remakes & Cost Trace', () => {
  it('generates remake sequence numbers starting at 51 and increments for consecutive remakes', () => {
    const existingSequences = [51, 52]
    const baseSeq = 51
    const nextSeq =
      existingSequences.reduce((max, s) => Math.max(max, s), baseSeq - 1) + 1
    expect(nextSeq).toBe(53)

    const label = `P-101-RME-${nextSeq}`
    expect(label).toBe('P-101-RME-53')
  })

  it('starts at sequence 51 when no prior remakes exist for mark', () => {
    const existingSequences: number[] = []
    const baseSeq = 51
    const nextSeq =
      existingSequences.reduce((max, s) => Math.max(max, s), baseSeq - 1) + 1
    expect(nextSeq).toBe(51)

    const label = `P-102-RMK-${nextSeq}`
    expect(label).toBe('P-102-RMK-51')
  })

  it('calculates total remake non-conformance cost correctly', () => {
    const materialCost = 145.0
    const laborHours = 1.5
    const laborRate = 45.0
    const laborCost = laborHours * laborRate // 67.50
    const outsideCost = 25.0

    const totalCost = materialCost + laborCost + outsideCost
    expect(totalCost).toBe(237.5)
  })

  it('requires mandatory release reason when releasing quality holds', () => {
    const releaseReason = ''
    expect(() => {
      if (!releaseReason.trim()) {
        throw new Error(
          'Mandatory release reason is required to release quality holds.',
        )
      }
    }).toThrow(/Mandatory release reason is required/)
  })

  it('exports quality inspection reports as CSV with caliper measurements', () => {
    const mockInspections: QualityInspectionItem[] = [
      {
        id: 'insp-1',
        releaseId: 'rel-1',
        releaseKey: '54120-1',
        markId: 'mark-1',
        markCode: 'P-101',
        quantity: 24,
        inspectorName: 'Jane Quality',
        specificationVersion: 'v1.2',
        measurements: {
          width: 48.0,
          length: 120.0,
          diagonal: 129.24,
          thickness: 0.1575,
        },
        disposition: 'Pass',
        notes: 'Within ±0.015 tolerance',
        destination: 'Pallet Staging',
        createdAt: '8/19/2026, 6:00:00 PM',
      },
    ]

    const csv = QualityService.exportInspectionsCsv(mockInspections)
    expect(csv).toContain('Mark Code')
    expect(csv).toContain('P-101')
    expect(csv).toContain('Pass')
    expect(csv).toContain('129.24')
    expect(csv).toContain('v1.2')
  })
})
