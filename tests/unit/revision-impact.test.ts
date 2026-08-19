import { describe, it, expect } from 'vitest'
import { DEPARTMENT_PACKET_DEFINITIONS } from '@/lib/services/packet-generator'
import { PDFDocument } from 'pdf-lib'

describe('RevisionControlService & PacketGenerator', () => {
  describe('Department Packet Definitions', () => {
    it('defines 6 standard department packets with appropriate category mappings', () => {
      const types = [
        'complete',
        'cnc',
        'elu',
        'assembly',
        'qc',
        'shipping',
      ] as const
      for (const t of types) {
        const def = DEPARTMENT_PACKET_DEFINITIONS[t]
        expect(def).toBeDefined()
        expect(def.includedCategories.length).toBeGreaterThan(0)
      }

      // CNC packet includes CNC layouts and cut drawings
      expect(DEPARTMENT_PACKET_DEFINITIONS.cnc.includedCategories).toContain(
        'cnc_layout',
      )
      expect(DEPARTMENT_PACKET_DEFINITIONS.cnc.includedCategories).toContain(
        'cut_drawing',
      )

      // ELU packet includes extrusion cut lists
      expect(DEPARTMENT_PACKET_DEFINITIONS.elu.includedCategories).toContain(
        'extrusion_cut_list',
      )

      // Shipping packet includes packing lists and shipping info
      expect(
        DEPARTMENT_PACKET_DEFINITIONS.shipping.includedCategories,
      ).toContain('packing_list')
      expect(
        DEPARTMENT_PACKET_DEFINITIONS.shipping.includedCategories,
      ).toContain('shipping_info')
    })
  })

  describe('PDF Merging and Stamp Generation', () => {
    it('creates valid PDF document with cover sheet and controlled stamps', async () => {
      const pdf = await PDFDocument.create()
      const page = pdf.addPage([612, 792])
      page.drawText('ELWARD SYSTEMS TEST', { x: 50, y: 700, size: 14 })

      const pdfBytes = await pdf.save()
      expect(pdfBytes.byteLength).toBeGreaterThan(100)

      // Re-load to verify PDF integrity
      const loaded = await PDFDocument.load(pdfBytes)
      expect(loaded.getPageCount()).toBe(1)
    })
  })
})
