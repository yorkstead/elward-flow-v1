'use client'

import * as React from 'react'
import {
  Package,
  Search,
  AlertTriangle,
  Sliders,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { InventoryItemStockSummary } from '@/lib/services/inventory'

interface LocationOption {
  id: string
  code: string
  name: string
  zone: string
}

interface InventoryStockTableProps {
  initialItems: InventoryItemStockSummary[]
  locations: LocationOption[]
  canViewValuation?: boolean
  onItemUpdated?: () => void
}

export function InventoryStockTable({
  initialItems,
  locations,
  canViewValuation,
  onItemUpdated,
}: InventoryStockTableProps) {
  const [items, setItemState] =
    React.useState<InventoryItemStockSummary[]>(initialItems)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [familyFilter, setFamilyFilter] = React.useState('all')
  const [reorderFilter, setReorderFilter] = React.useState(false)

  // Adjust Modal
  const [adjustModalOpen, setAdjustModalOpen] = React.useState(false)
  const [selectedItem, setSelectedItem] =
    React.useState<InventoryItemStockSummary | null>(null)
  const [adjustType, setAdjustType] = React.useState<'adjust' | 'scrap'>(
    'adjust',
  )
  const [locationId, setLocationId] = React.useState(locations[0]?.id || '')
  const [quantity, setQuantity] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [submittingAdjust, setSubmittingAdjust] = React.useState(false)

  const filteredItems = items.filter((item) => {
    if (familyFilter !== 'all') {
      if (item.materialFamily.toLowerCase() !== familyFilter.toLowerCase()) {
        return false
      }
    }
    if (reorderFilter && !item.reorderAlert) {
      return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matches =
        item.itemNumber.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.materialFamily.toLowerCase().includes(q) ||
        (item.color ? item.color.toLowerCase().includes(q) : false)
      if (!matches) return false
    }
    return true
  })

  const handleSaveAdjustment = async () => {
    if (!selectedItem || !quantity || !reason.trim()) return

    setSubmittingAdjust(true)
    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: adjustType,
          inventoryItemId: selectedItem.id,
          locationId: locationId || locations[0]?.id,
          quantity: parseFloat(quantity),
          reason: reason.trim(),
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to adjust stock')
      }

      const qDelta = parseFloat(quantity)
      setItemState((prev) =>
        prev.map((i) => {
          if (i.id !== selectedItem.id) return i
          const newOnHand =
            adjustType === 'scrap'
              ? Math.max(0, i.onHandQuantity - qDelta)
              : Math.max(0, i.onHandQuantity + qDelta)
          const newAvailable = Math.max(0, newOnHand - i.allocatedQuantity)
          return {
            ...i,
            onHandQuantity: newOnHand,
            availableQuantity: newAvailable,
            reorderAlert: newOnHand <= i.reorderPoint,
            totalValuation: i.unitCost !== null ? newOnHand * i.unitCost : null,
          }
        }),
      )

      setAdjustModalOpen(false)
      setQuantity('')
      setReason('')
      setNotes('')
      onItemUpdated?.()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmittingAdjust(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Raw Material & Stock Ledger
            </h2>
            <p className="text-xs text-slate-500">
              On-hand, allocated, available, and reorder levels derived from
              immutable ledger
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48 sm:w-60">
            <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search item, color, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <Select
            value={familyFilter}
            onValueChange={(val) => {
              if (val) setFamilyFilter(val)
            }}
          >
            <SelectTrigger
              aria-label="Filter Material Family"
              className="h-8 w-32 text-xs font-semibold"
            >
              <SelectValue placeholder="Family" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Families</SelectItem>
              <SelectItem value="ACM">ACM Panels</SelectItem>
              <SelectItem value="Plate">Plate Stock</SelectItem>
              <SelectItem value="Extrusion">Extrusions</SelectItem>
              <SelectItem value="Fastener">Fasteners</SelectItem>
              <SelectItem value="Gasket">Gaskets</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant={reorderFilter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setReorderFilter((prev) => !prev)}
            className={`h-8 text-xs font-semibold ${
              reorderFilter ? 'bg-amber-600 text-white' : 'text-slate-700'
            }`}
          >
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
            Reorder Alerts Only
          </Button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
          No inventory items matching selected filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="font-bold">Item Number & Specs</TableHead>
                <TableHead className="font-bold">Family / Color</TableHead>
                <TableHead className="text-center font-bold">On Hand</TableHead>
                <TableHead className="text-center font-bold">
                  Allocated
                </TableHead>
                <TableHead className="text-center font-bold">
                  Available
                </TableHead>
                <TableHead className="text-center font-bold">
                  Expected (PO)
                </TableHead>
                {canViewValuation && (
                  <TableHead className="text-right font-bold">
                    Valuation
                  </TableHead>
                )}
                <TableHead className="text-right font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id} className="text-xs">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-950">
                        {item.itemNumber}
                      </span>
                      {item.reorderAlert && (
                        <Badge className="border-amber-200 bg-amber-100 text-[10px] font-bold text-amber-800">
                          Reorder
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-600">
                      {item.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-900">
                      {item.materialFamily}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {item.color || item.finish || 'Standard'} •{' '}
                      {item.dimensions || item.thickness || 'Stock'}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono font-bold text-slate-950">
                    {item.onHandQuantity}{' '}
                    <span className="text-[10px] font-normal text-slate-500">
                      {item.unit}
                    </span>
                    {item.damagedQuantity > 0 && (
                      <div className="text-[10px] text-red-600">
                        +{item.damagedQuantity} damaged
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-mono font-semibold text-amber-800">
                    {item.allocatedQuantity}{' '}
                    <span className="text-[10px] font-normal text-slate-500">
                      {item.unit}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-mono font-bold text-emerald-700">
                    {item.availableQuantity}{' '}
                    <span className="text-[10px] font-normal text-slate-500">
                      {item.unit}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-mono text-slate-600">
                    {item.expectedQuantity > 0 ? (
                      <span className="font-semibold text-blue-700">
                        +{item.expectedQuantity} {item.unit}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  {canViewValuation && (
                    <TableCell className="text-right font-mono font-semibold text-slate-900">
                      {item.totalValuation !== null
                        ? `$${item.totalValuation.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : '—'}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedItem(item)
                        setAdjustType('adjust')
                        setAdjustModalOpen(true)
                      }}
                      className="h-7 px-2.5 text-xs font-semibold text-slate-800"
                    >
                      <Sliders className="mr-1 h-3 w-3 text-slate-500" />
                      Adjust / Scrap
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Adjust / Scrap Stock Modal */}
      <Dialog open={adjustModalOpen} onOpenChange={setAdjustModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-950">
              Adjust Physical Inventory — {selectedItem?.itemNumber}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Record an approved physical inventory adjustment or scrap
              write-off with compensating ledger record.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Action Type *
                </label>
                <Select
                  value={adjustType}
                  onValueChange={(val) => {
                    if (val) setAdjustType(val as 'adjust' | 'scrap')
                  }}
                >
                  <SelectTrigger
                    aria-label="Action Type"
                    className="mt-1 h-9 text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adjust">
                      Stock Adjustment (+/-)
                    </SelectItem>
                    <SelectItem value="scrap">Scrap Non-Conforming</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">
                  Warehouse Location *
                </label>
                <Select
                  value={locationId}
                  onValueChange={(val) => {
                    if (val) setLocationId(val)
                  }}
                >
                  <SelectTrigger
                    aria-label="Location"
                    className="mt-1 h-9 text-xs"
                  >
                    <SelectValue placeholder="Select location..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name} ({l.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                Quantity ({selectedItem?.unit}) *
              </label>
              <Input
                aria-label="Quantity"
                type="number"
                step="any"
                placeholder={
                  adjustType === 'scrap' ? 'e.g. 2' : 'e.g. +5 or -3'
                }
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1 h-9 font-mono text-xs font-bold"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                Mandatory Approval / Defect Reason *
              </label>
              <Input
                placeholder="e.g. Physical count reconciliation approved by supervisor"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 h-9 text-xs"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">
                Additional Notes (Optional)
              </label>
              <Input
                placeholder="e.g. Found extra bundle on top shelf"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAdjustModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submittingAdjust || !quantity || !reason.trim()}
              onClick={handleSaveAdjustment}
              className={`${
                adjustType === 'scrap'
                  ? 'bg-red-700 hover:bg-red-800'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-xs font-bold text-white shadow-xs`}
            >
              {submittingAdjust ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Confirm {adjustType === 'scrap' ? 'Scrap' : 'Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
