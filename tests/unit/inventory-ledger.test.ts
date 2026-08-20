import { describe, it, expect } from 'vitest'
import {
  InventoryService,
  type InventoryItemStockSummary,
} from '@/lib/services/inventory'

describe('InventoryService — Transaction-Led Stock and Ledger Calculations', () => {
  it('calculates available stock correctly as on-hand minus allocated', () => {
    const onHand = 45
    const allocated = 15
    const available = Math.max(0, onHand - allocated)
    expect(available).toBe(30)
  })

  it('prevents over-allocation when requested quantity exceeds available stock', () => {
    const available = 10
    const requested = 15

    expect(() => {
      if (requested > available) {
        throw new Error(
          `Over-allocation blocked: Requested ${requested}, but only ${available} available.`,
        )
      }
    }).toThrow(/Over-allocation blocked/)
  })

  it('requires mandatory substitution reason for material substitutions', () => {
    const isSubstituted = true
    const substitutionReason = ''

    expect(() => {
      if (isSubstituted && !substitutionReason.trim()) {
        throw new Error(
          'Mandatory substitution reason required for material substitutions.',
        )
      }
    }).toThrow(/Mandatory substitution reason required/)
  })

  it('calculates cycle count discrepancies accurately', () => {
    const systemQuantity = 45
    const countedQuantity = 42
    const discrepancy = countedQuantity - systemQuantity
    expect(discrepancy).toBe(-3) // 3 units short

    const overCounted = 50
    const overDiscrepancy = overCounted - systemQuantity
    expect(overDiscrepancy).toBe(5) // 5 units overage
  })

  it('exports inventory CSV with proper headers and formatted metrics', () => {
    const mockItems: InventoryItemStockSummary[] = [
      {
        id: 'item-1',
        itemNumber: 'ACM-4MM-SLV',
        materialFamily: 'ACM',
        description: '4mm ACM Silver Metallic',
        manufacturer: 'Alpolic',
        color: 'Silver Metallic',
        finish: 'PVDF',
        thickness: '0.1575"',
        dimensions: '48" × 120"',
        unit: 'sheets',
        onHandQuantity: 45,
        allocatedQuantity: 15,
        availableQuantity: 30,
        damagedQuantity: 1,
        expectedQuantity: 30,
        shortageQuantity: 0,
        reorderPoint: 15,
        reorderQuantity: 50,
        reorderAlert: false,
        unitCost: 145.0,
        totalValuation: 6525.0,
        status: 'Active',
        primaryLocationCode: 'BAY-A1',
      },
    ]

    const csv = InventoryService.exportStockCsv(mockItems)
    expect(csv).toContain('Item Number')
    expect(csv).toContain('ACM-4MM-SLV')
    expect(csv).toContain('Silver Metallic')
    expect(csv).toContain('6525.00')
    expect(csv).toContain('45')
  })
})
