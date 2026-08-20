import { describe, it, expect, vi } from 'vitest'
import { ShippingService, ShipmentSummary } from '@/lib/services/shipping'

describe('Shipping & Trailer Load Logic', () => {
  const mockUserContext = {
    userId: '22222222-2222-2222-2222-222222222222',
    email: 'shipping@elward.test',
    roles: ['shipping lead', 'manager'],
    isAdmin: false,
    organizationId: '00000000-0000-0000-0000-000000000001',
  }

  it('exports Bill of Lading (BOL) manifest CSV with carrier and position details', async () => {
    const sampleShipment: ShipmentSummary = {
      id: 'ship-001',
      shipmentNumber: 'SHP-2026-0001',
      carrier: 'Flatbed Freight Express',
      trailerNumber: 'FB-5309',
      driverName: 'David Martinez',
      driverPhone: '303-555-0192',
      bolNumber: 'BOL-54120-001',
      status: 'Dispatched',
      scheduledDeparture: '2026-08-20T08:00:00.000Z',
      actualDeparture: '2026-08-20T08:15:00.000Z',
      originAddress: 'Elward Systems Corp Plant 1, Loveland, CO',
      destinationAddress:
        'Tempe Gateway Commercial Center - 4500 Gateway Blvd, Tempe, AZ',
      totalWeightLbs: 444,
      totalPallets: 1,
      totalPanels: 24,
      dispatchedByName: 'David Martinez',
      notes: null,
      createdAt: '2026-08-20T00:00:00.000Z',
      pallets: [
        {
          id: 'sp-1',
          shipmentId: 'ship-001',
          palletId: 'pal-001',
          palletNumber: 'PAL-54120-R1-001',
          releaseKey: '54120-R1',
          jobNumber: '54120',
          jobName: 'Tempe Gateway',
          elevation: 'North Elevation',
          panelCount: 24,
          weightLbs: 444,
          truckPosition: 1,
          loadedAt: '2026-08-20T00:00:00.000Z',
        },
      ],
    }

    vi.spyOn(ShippingService, 'getShipmentById').mockResolvedValue(
      sampleShipment,
    )

    const csv = await ShippingService.exportBolCsv(mockUserContext, 'ship-001')

    expect(csv).toContain('Shipment Number,BOL Number,Carrier')
    expect(csv).toContain('"SHP-2026-0001"')
    expect(csv).toContain('"BOL-54120-001"')
    expect(csv).toContain('"Flatbed Freight Express"')
    expect(csv).toContain('444')
  })
})
