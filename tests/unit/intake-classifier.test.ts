import { describe, it, expect } from 'vitest'
import {
  DocumentClassifier,
  type DocumentCategoryCode,
} from '@/lib/services/classifier'
import JSZip from 'jszip'

describe('DocumentClassifier & Safe ZIP Extraction', () => {
  describe('Deterministic Classification', () => {
    it('classifies CNC layouts and G-code router files', () => {
      const result1 = DocumentClassifier.classify(
        '54120-1_Table_Layout_Sheet1.pdf',
      )
      expect(result1.category).toBe('cnc_layout')
      expect(result1.isUncertain).toBe(false)

      const result2 = DocumentClassifier.classify('Job54120_Nest.nc')
      expect(result2.category).toBe('cnc_layout')

      const result3 = DocumentClassifier.classify('Panel_A1.tap')
      expect(result3.category).toBe('cnc_layout')
    })

    it('classifies extrusion cut lists and ELU saw schedules', () => {
      const result = DocumentClassifier.classify(
        '54120-1_Extrusion_Cut_List.pdf',
      )
      expect(result.category).toBe('extrusion_cut_list')
      expect(result.defaultDepartment).toBe('ELU')
    })

    it('classifies assembly drawings and joint details', () => {
      const result = DocumentClassifier.classify(
        '54120-1_Assembly_Detail_D01.pdf',
      )
      expect(result.category).toBe('assembly_drawing')
      expect(result.defaultDepartment).toBe('Assembly')
    })

    it('classifies packing lists and shipping guides', () => {
      const result = DocumentClassifier.classify('54120-1_Packing_List.pdf')
      expect(result.category).toBe('packing_list')
      expect(result.defaultDepartment).toBe('Shipping')
    })

    it('classifies takeoff spreadsheets', () => {
      const result = DocumentClassifier.classify(
        '54120-1_Panel_Takeoff_Schedule.csv',
      )
      expect(result.category).toBe('takeoff')
    })

    it('does not classify generated error logs as takeoff schedules', () => {
      const result = DocumentClassifier.classify(
        'ErrorLog - Panel Schedule (JADE)CLEAN_csv.csv',
      )
      expect(result.category).toBe('other')
      expect(result.isUncertain).toBe(true)
    })
  })

  describe('Material Family Expected Categories', () => {
    it('requires CNC layouts, cut drawings, and extrusion lists for ACM packages', () => {
      const expected =
        DocumentClassifier.getExpectedCategoriesForMaterial('ACM')
      expect(expected).toContain('cnc_layout')
      expect(expected).toContain('cut_drawing')
      expect(expected).toContain('extrusion_cut_list')
      expect(expected).toContain('assembly_drawing')
    })

    it('requires only cut drawings for standard Swisspearl packages', () => {
      const expected =
        DocumentClassifier.getExpectedCategoriesForMaterial('Swisspearl')
      expect(expected).toEqual(['cut_drawing'])
    })

    it('detects missing extrusion cut list in ACM release', () => {
      const present: DocumentCategoryCode[] = [
        'cnc_layout',
        'cut_drawing',
        'assembly_drawing',
      ]
      const missing = DocumentClassifier.checkMissingExpectedCategories(
        'ACM',
        present,
      )
      expect(missing.map((m) => m.code)).toContain('extrusion_cut_list')
    })
  })

  describe('Safe ZIP Extraction & Security Invariants', () => {
    it('safely extracts legitimate release archives', async () => {
      const zip = new JSZip()
      zip.file(
        'CNC/54120-1_Table_Layout.pdf',
        Buffer.from('PDF Mock Content 1'),
      )
      zip.file('ELU/54120-1_Extrusions.pdf', Buffer.from('PDF Mock Content 2'))
      zip.file(
        'Takeoff/Schedule.csv',
        Buffer.from('Mark,Description,Quantity\nP-101,Panel A,10'),
      )

      const buffer = await zip.generateAsync({ type: 'nodebuffer' })
      const extracted = await DocumentClassifier.safeExtractZip(buffer)

      expect(extracted.length).toBe(3)
      expect(
        extracted.some((f) => f.filename === '54120-1_Table_Layout.pdf'),
      ).toBe(true)
    })

    it('does not treat traversal-like bytes in file contents as a path', async () => {
      const zip = new JSZip()
      zip.file(
        '54120-1_Drawing.dwg',
        Buffer.from('legitimate drawing bytes ../ embedded in content'),
      )
      const buffer = await zip.generateAsync({ type: 'nodebuffer' })

      const extracted = await DocumentClassifier.safeExtractZip(buffer)

      expect(extracted).toHaveLength(1)
      expect(extracted[0]?.filename).toBe('54120-1_Drawing.dwg')
    })

    it('blocks directory traversal attacks in ZIP archives', async () => {
      const zip = new JSZip()
      zip.file('../../../etc/passwd', Buffer.from('malicious'))
      const buffer = await zip.generateAsync({ type: 'nodebuffer' })

      await expect(DocumentClassifier.safeExtractZip(buffer)).rejects.toThrow(
        /illegal path traversal/i,
      )
    })

    it('blocks dangerous executable files in ZIP archives', async () => {
      const zip = new JSZip()
      zip.file('payload.exe', Buffer.from('binary'))
      const buffer = await zip.generateAsync({ type: 'nodebuffer' })

      await expect(DocumentClassifier.safeExtractZip(buffer)).rejects.toThrow(
        /prohibited executable file/i,
      )
    })

    it('enforces total uncompressed size limit for decompression bomb prevention', async () => {
      const zip = new JSZip()
      zip.file('large.txt', Buffer.alloc(2000, 'A'))
      const buffer = await zip.generateAsync({ type: 'nodebuffer' })

      await expect(
        DocumentClassifier.safeExtractZip(buffer, { maxTotalBytes: 1000 }),
      ).rejects.toThrow(/decompression bomb protection/i)
    })
  })
})
