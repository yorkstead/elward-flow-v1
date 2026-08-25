'use client'

import * as React from 'react'
import {
  Layers,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  RefreshCw,
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
import type {
  ReleaseDemandItem,
  InventoryItemStockSummary,
} from '@/lib/services/inventory'

interface LocationOption {
  id: string
  code: string
  name: string
  zone: string
}

interface ReleaseDemandBoardProps {
  releaseKey: string
  releaseId: string
  initialDemand: ReleaseDemandItem[]
  stockItems: InventoryItemStockSummary[]
  locations: LocationOption[]
  onDemandUpdated?: () => void
}

export function ReleaseDemandBoard({
  releaseKey,
  releaseId,
  initialDemand,
  stockItems,
  locations,
  onDemandUpdated,
}: ReleaseDemandBoardProps) {
  const [demand, setDemand] = React.useState<ReleaseDemandItem[]>(initialDemand)

  // Allocate Modal
  const [allocateModalOpen, setAllocateModalOpen] = React.useState(false)
  const [selectedDemand, setSelectedDemand] =
    React.useState<ReleaseDemandItem | null>(null)
  const [selectedStockId, setSelectedStockId] = React.useState('')
  const [allocateQty, setAllocateQty] = React.useState('')
  const [isSubstituted, setIsSubstituted] = React.useState(false)
  const [substitutionReason, setSubstitutionReason] = React.useState('')
  const [allocating, setAllocating] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState('')

  // Issue / Return Modal
  const [movementModalOpen, setMovementModalOpen] = React.useState(false)
  const [movementType, setMovementType] = React.useState<'issue' | 'return'>(
    'issue',
  )
  const [movementQty, setMovementQty] = React.useState('1')
  const [locationId, setLocationId] = React.useState(locations[0]?.id || '')
  const [movementReason, setMovementReason] = React.useState('')
  const [moving, setMoving] = React.useState(false)

  const openAllocateDialog = (item: ReleaseDemandItem) => {
    setSelectedDemand(item)
    setSelectedStockId(item.inventoryItemId || stockItems[0]?.id || '')
    setAllocateQty(
      item.shortageQuantity > 0 ? String(item.shortageQuantity) : '1',
    )
    setIsSubstituted(false)
    setSubstitutionReason('')
    setErrorMsg('')
    setAllocateModalOpen(true)
  }

  const openMovementDialog = (
    item: ReleaseDemandItem,
    type: 'issue' | 'return',
  ) => {
    setSelectedDemand(item)
    setMovementType(type)
    setMovementQty('1')
    setMovementReason(
      type === 'return' ? 'Unused sheet returned from CNC table' : '',
    )
    setErrorMsg('')
    setMovementModalOpen(true)
  }

  const handleExecuteAllocation = async () => {
    if (!selectedDemand || !selectedStockId || !allocateQty) return

    const qty = parseFloat(allocateQty)
    if (qty <= 0) return

    const stock = stockItems.find((s) => s.id === selectedStockId)
    if (stock && qty > stock.availableQuantity) {
      setErrorMsg(
        `Over-allocation blocked: Requested ${qty} ${stock.unit}, but only ${stock.availableQuantity} ${stock.unit} available in stock.`,
      )
      return
    }

    if (isSubstituted && !substitutionReason.trim()) {
      setErrorMsg('Mandatory substitution reason required.')
      return
    }

    setAllocating(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/inventory/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryItemId: selectedStockId,
          releaseId,
          quantity: qty,
          isSubstituted,
          originalItemId: selectedDemand.inventoryItemId,
          substitutionReason: isSubstituted
            ? substitutionReason.trim()
            : undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to allocate material')
      }

      setDemand((prev) =>
        prev.map((d) => {
          if (d.id !== selectedDemand.id) return d
          const newAllocated = d.allocatedQuantity + qty
          const newShortage = Math.max(0, d.requiredQuantity - newAllocated)
          return {
            ...d,
            allocatedQuantity: newAllocated,
            shortageQuantity: newShortage,
            isSubstituted: isSubstituted || d.isSubstituted,
            substitutionReason: isSubstituted
              ? substitutionReason.trim()
              : d.substitutionReason,
          }
        }),
      )

      setAllocateModalOpen(false)
      onDemandUpdated?.()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setAllocating(false)
    }
  }

  const handleAutoAllocateAll = async () => {
    setAllocating(true)
    setErrorMsg('')
    try {
      for (const d of demand) {
        if (d.shortageQuantity > 0 && d.inventoryItemId) {
          const qtyToAllocate = Math.min(
            d.shortageQuantity,
            d.availableStockQuantity,
          )
          if (qtyToAllocate > 0) {
            await fetch('/api/inventory/allocate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                inventoryItemId: d.inventoryItemId,
                releaseId,
                quantity: qtyToAllocate,
              }),
            })
          }
        }
      }

      setDemand((prev) =>
        prev.map((d) => {
          const add = Math.min(d.shortageQuantity, d.availableStockQuantity)
          const newAlloc = d.allocatedQuantity + add
          return {
            ...d,
            allocatedQuantity: newAlloc,
            shortageQuantity: Math.max(0, d.requiredQuantity - newAlloc),
          }
        }),
      )
      onDemandUpdated?.()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to auto-allocate')
    } finally {
      setAllocating(false)
    }
  }

  const handleExecuteMovement = async () => {
    if (!selectedDemand || !movementQty) return

    setMoving(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/inventory/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: movementType,
          allocationId: selectedDemand.id,
          quantity: parseFloat(movementQty),
          locationId: locationId || locations[0]?.id,
          reason: movementReason.trim() || undefined,
        }),
      })

      if (!res.ok) {
        console.warn('Issue route response', res.status)
      }

      const q = parseFloat(movementQty)
      setDemand((prev) =>
        prev.map((d) => {
          if (d.id !== selectedDemand.id) return d
          if (movementType === 'issue') {
            return {
              ...d,
              issuedQuantity: d.issuedQuantity + q,
            }
          } else {
            return {
              ...d,
              issuedQuantity: Math.max(0, d.issuedQuantity - q),
            }
          }
        }),
      )

      setMovementModalOpen(false)
      onDemandUpdated?.()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setMoving(false)
    }
  }

  const totalShortage = demand.reduce((sum, d) => sum + d.shortageQuantity, 0)

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Release Material Demand &amp; Allocations — {releaseKey}
            </h2>
            <p className="text-xs text-slate-500">
              Allocated at the release level across all constituent panel marks
              with over-allocation blocking.
            </p>
          </div>
        </div>

        {totalShortage > 0 && (
          <Button
            type="button"
            size="sm"
            disabled={allocating}
            onClick={handleAutoAllocateAll}
            className="bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Auto-Allocate All for Release
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="font-bold">Material / Scope</TableHead>
              <TableHead className="font-bold">Color / Dimensions</TableHead>
              <TableHead className="text-center font-bold">
                Required Sheets
              </TableHead>
              <TableHead className="text-center font-bold">In Stock</TableHead>
              <TableHead className="text-center font-bold">
                Allocated to Release
              </TableHead>
              <TableHead className="text-center font-bold">
                Issued to Shop
              </TableHead>
              <TableHead className="text-center font-bold">Shortage</TableHead>
              <TableHead className="text-right font-bold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {demand.map((item) => (
              <TableRow key={item.id} className="text-xs">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-950">
                      {item.materialFamily}
                    </span>
                    {item.isSubstituted && (
                      <Badge className="border-purple-200 bg-purple-100 text-[10px] font-bold text-purple-800">
                        Substituted
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Release Scope: {item.totalPanelCount || 0} Panels
                    {item.markList && item.markList.length > 0 && (
                      <span className="ml-1 text-slate-400">
                        ({item.markList.slice(0, 4).join(', ')}
                        {item.markList.length > 4 ? '...' : ''})
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-semibold text-slate-900">
                    {item.color || 'Standard Finish'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {item.dimensions || 'Standard spec'}
                  </div>
                </TableCell>
                <TableCell className="text-center font-mono font-bold text-slate-900">
                  {item.requiredQuantity} {item.unit}
                </TableCell>
                <TableCell className="text-center font-mono text-slate-700">
                  {item.availableStockQuantity} {item.unit}
                </TableCell>
                <TableCell className="text-center font-mono font-bold text-emerald-700">
                  {item.allocatedQuantity} {item.unit}
                </TableCell>
                <TableCell className="text-center font-mono font-semibold text-blue-700">
                  {item.issuedQuantity} {item.unit}
                </TableCell>
                <TableCell className="text-center font-mono">
                  {item.shortageQuantity > 0 ? (
                    <Badge className="bg-red-100 text-[10px] font-bold text-red-800">
                      -{item.shortageQuantity} Short
                    </Badge>
                  ) : (
                    <span className="text-[11px] font-semibold text-emerald-700">
                      Fully Allocated
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openAllocateDialog(item)}
                      className="h-7 bg-blue-600 px-2.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-700"
                    >
                      <ArrowRightLeft className="mr-1 h-3 w-3" />
                      Allocate
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={item.allocatedQuantity <= 0}
                      onClick={() => openMovementDialog(item, 'issue')}
                      className="h-7 px-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
                    >
                      <Play className="mr-1 h-3 w-3 text-emerald-600" />
                      Issue
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={item.issuedQuantity <= 0}
                      onClick={() => openMovementDialog(item, 'return')}
                      className="h-7 px-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
                    >
                      <RotateCcw className="mr-1 h-3 w-3 text-amber-600" />
                      Return
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Allocate Material Dialog */}
      <Dialog open={allocateModalOpen} onOpenChange={setAllocateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-950">
              Allocate Material to Release {releaseKey}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Reserve warehouse stock for {selectedDemand?.materialFamily}{' '}
              {selectedDemand?.color ? `(${selectedDemand.color})` : ''} across
              all {selectedDemand?.totalPanelCount || 0} panels in this release.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700">
                Select Warehouse Stock Item *
              </label>
              <Select
                value={selectedStockId}
                onValueChange={(val) => {
                  if (val) {
                    setSelectedStockId(val)
                    const stock = stockItems.find((s) => s.id === val)
                    if (
                      stock &&
                      selectedDemand &&
                      stock.materialFamily.toLowerCase() !==
                        selectedDemand.materialFamily.toLowerCase()
                    ) {
                      setIsSubstituted(true)
                    }
                  }
                }}
              >
                <SelectTrigger
                  aria-label="Stock Item"
                  className="mt-1 h-9 text-xs"
                >
                  <SelectValue placeholder="Select stock item..." />
                </SelectTrigger>
                <SelectContent>
                  {stockItems.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.itemNumber} — {s.materialFamily} ({s.availableQuantity}{' '}
                      {s.unit} available)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                Quantity to Allocate *
              </label>
              <Input
                aria-label="Allocate Quantity"
                type="number"
                step="any"
                value={allocateQty}
                onChange={(e) => setAllocateQty(e.target.value)}
                className="mt-1 h-9 font-mono text-xs font-bold"
                required
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800">
                  Authorized Material Substitution?
                </label>
                <input
                  type="checkbox"
                  checked={isSubstituted}
                  onChange={(e) => setIsSubstituted(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </div>

              {isSubstituted && (
                <div className="mt-2 space-y-1">
                  <label className="font-medium text-slate-600">
                    Mandatory Substitution Reason *
                  </label>
                  <Input
                    placeholder="e.g. Approved engineering change: using 4mm Bone White in place of standard"
                    value={substitutionReason}
                    onChange={(e) => setSubstitutionReason(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAllocateModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={allocating || !allocateQty}
              onClick={handleExecuteAllocation}
              className="bg-blue-600 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
            >
              {allocating ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Confirm Allocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue / Return Movement Dialog */}
      <Dialog open={movementModalOpen} onOpenChange={setMovementModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-950">
              {movementType === 'issue'
                ? 'Issue to CNC Staging'
                : 'Return Unused Material'}{' '}
              — Mark {selectedDemand?.markCode}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {movementType === 'issue'
                ? 'Issue allocated material to shop floor staging station.'
                : 'Return unused sheets from shop floor back to warehouse inventory.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700">
                Quantity ({selectedDemand?.unit}) *
              </label>
              <Input
                aria-label="Movement Quantity"
                type="number"
                step="any"
                value={movementQty}
                onChange={(e) => setMovementQty(e.target.value)}
                className="mt-1 h-9 font-mono text-xs font-bold"
                required
              />
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

            <div>
              <label className="text-xs font-medium text-slate-600">
                {movementType === 'return'
                  ? 'Mandatory Return Reason *'
                  : 'Notes (Optional)'}
              </label>
              <Input
                placeholder={
                  movementType === 'return'
                    ? 'e.g. Uncut sheet returned from CNC table'
                    : 'e.g. Staged at CNC Infeed Bay'
                }
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                className="mt-1 h-9 text-xs"
                required={movementType === 'return'}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMovementModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={moving || !movementQty}
              onClick={handleExecuteMovement}
              className={`${
                movementType === 'return'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              } text-xs font-bold text-white shadow-xs`}
            >
              {moving ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Confirm {movementType === 'return' ? 'Return' : 'Issue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
