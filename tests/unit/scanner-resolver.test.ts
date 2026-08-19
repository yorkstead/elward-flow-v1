import { describe, it, expect } from 'vitest'
import { BarcodeEngine } from '@/lib/services/scanner'
import { OfflineScanQueue } from '@/lib/scanner/offline-queue'

describe('BarcodeEngine & Scanner Resolution (Prompt 05)', () => {
  describe('Canonical Prefix Parsing', () => {
    it('correctly parses standard EF:MARK prefix with compound job-release context', () => {
      const parsed = BarcodeEngine.parse('EF:MARK:54120-1:P-101')
      expect(parsed.type).toBe('panel_mark')
      expect(parsed.identifier).toBe('P-101')
      expect(parsed.jobContext).toBe('54120')
      expect(parsed.releaseContext).toBe('1')
      expect(parsed.markContext).toBe('P-101')
    })

    it('correctly parses standard EF:REL release prefix', () => {
      const parsed = BarcodeEngine.parse('EF:REL:54120-1')
      expect(parsed.type).toBe('release')
      expect(parsed.identifier).toBe('54120-1')
      expect(parsed.jobContext).toBe('54120')
      expect(parsed.releaseContext).toBe('1')
    })

    it('correctly parses EF:PALLET prefix', () => {
      const parsed = BarcodeEngine.parse('EF:PALLET:PAL-54120-1-01')
      expect(parsed.type).toBe('pallet')
      expect(parsed.identifier).toBe('PAL-54120-1-01')
    })

    it('correctly parses EF:STATION workstation prefix', () => {
      const parsed = BarcodeEngine.parse('EF:STATION:CNC-01')
      expect(parsed.type).toBe('workstation')
      expect(parsed.identifier).toBe('CNC-01')
    })

    it('correctly parses EF:ITEM inventory prefix', () => {
      const parsed = BarcodeEngine.parse('EF:ITEM:ALUM-4MM-FR')
      expect(parsed.type).toBe('inventory_item')
      expect(parsed.identifier).toBe('ALUM-4MM-FR')
    })

    it('correctly parses EF:EMP employee badge prefix', () => {
      const parsed = BarcodeEngine.parse('EF:EMP:EMP-42')
      expect(parsed.type).toBe('badge')
      expect(parsed.identifier).toBe('EMP-42')
    })
  })

  describe('Fallback Heuristic Pattern Matching', () => {
    it('infers release type from raw compound key 54125-2', () => {
      const parsed = BarcodeEngine.parse('54125-2')
      expect(parsed.type).toBe('release')
      expect(parsed.jobContext).toBe('54125')
      expect(parsed.releaseContext).toBe('2')
    })

    it('infers 5-digit job number from raw 54125', () => {
      const parsed = BarcodeEngine.parse('54125')
      expect(parsed.type).toBe('job')
      expect(parsed.identifier).toBe('54125')
    })

    it('infers panel mark from standard alphanumeric code P-102', () => {
      const parsed = BarcodeEngine.parse('P-102')
      expect(parsed.type).toBe('panel_mark')
      expect(parsed.identifier).toBe('P-102')
    })
  })

  describe('Offline Queue Functionality', () => {
    it('handles queue operations safely in node/mock environment', () => {
      const items = OfflineScanQueue.getQueue()
      expect(Array.isArray(items)).toBe(true)
    })
  })
})
