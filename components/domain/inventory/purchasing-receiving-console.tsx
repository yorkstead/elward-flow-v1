'use client'

import * as React from 'react'
import {
  Truck,
  Search,
  CheckCircle2,
  AlertOctagon,
  Barcode,
  Calendar,
  Layers,
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

export interface PoLineItem {
  id: string
  purchaseOrderId: string
  poNumber: string
  vendorName: string
  lineNumber: number
  itemNumber: string
  materialFamily: string
  description: string
  orderedQuantity: number
  receivedQuantity: number
  remainingQuantity: number
  unit: string
  status: string
  expectedDate: string | null
}

interface LocationOption {
  id: string
  code: string
  name: string
  zone: string
}

interface PurchasingReceivingConsoleProps {
  initialPoLines: PoLineItem[]
  locations: LocationOption[]
  onReceived?: () => void
}

export function PurchasingReceivingConsole({
  initialPoLines,
  locations,
  onReceived,
}: PurchasingReceivingConsoleProps) {
  const [poLines, setPoLines] = React.useState<PoLineItem[]>(initialPoLines)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('all')

  // Receiving Modal State
  const [receiveModalOpen, setReceiveModalOpen] = React.useState(false)
  const [selectedLine, setSelectedLine] = React.useState<PoLineItem | null>(
    null,
  )
  const [locationId, setLocationId] = React.useState(locations[0]?.id || '')
  const [goodQty, setGoodQty] = React.useState('')
  const [damagedQty, setDamagedQty] = React.useState('0')
  const [lotNumber, setLotNumber] = React.useState('')
  const [heatNumber, setHeatNumber] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [submittingReceive, setSubmittingReceive] = React.useState(false)

  const filteredLines = poLines.filter((line) => {
    if (
      statusFilter !== 'all' &&
      line.status.toLowerCase() !== statusFilter.toLowerCase()
    ) {
      return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matches =
        line.poNumber.toLowerCase().includes(q) ||
        line.vendorName.toLowerCase().includes(q) ||
        line.itemNumber.toLowerCase().includes(q) ||
        line.description.toLowerCase().includes(q)
      if (!matches) return false
    }
    return true
  })

  const openReceiveDialog = (line: PoLineItem) => {
    setSelectedLine(line)
    setGoodQty(
      line.remainingQuantity > 0 ? String(line.remainingQuantity) : '1',
    )
    setDamagedQty('0')
    setLotNumber(`LOT-${new Date().toISOString().split('T')[0]}`)
    setHeatNumber('')
    setNotes('')
    setReceiveModalOpen(true)
  }

  const handleExecuteReceiving = async () => {
    if (!selectedLine || !goodQty) return

    const gQty = parseFloat(goodQty) || 0
    const dQty = parseFloat(damagedQty) || 0

    if (gQty <= 0 && dQty <= 0) return

    setSubmittingReceive(true)
    try {
      const res = await fetch('/api/inventory/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseOrderLineId: selectedLine.id,
          receivedQuantity: gQty,
          damagedQuantity: dQty,
          locationId: locationId || locations[0]?.id,
          lotNumber: lotNumber.trim() || undefined,
          heatNumber: heatNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to receive material')
      }

      // Update local state
      const totalNewlyReceived = gQty + dQty
      setPoLines((prev) =>
        prev.map((l) => {
          if (l.id !== selectedLine.id) return l
          const newReceived = l.receivedQuantity + totalNewlyReceived
          const newRemaining = Math.max(0, l.orderedQuantity - newReceived)
          const newStatus =
            newReceived >= l.orderedQuantity
              ? 'Completed'
              : 'Partially Received'
          return {
            ...l,
            receivedQuantity: newReceived,
            remainingQuantity: newRemaining,
            status: newStatus,
          }
        }),
      )

      setReceiveModalOpen(false)
      onReceived?.()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmittingReceive(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Purchasing & Receiving Dock
            </h2>
            <p className="text-xs text-slate-500">
              Receive shipments, log condition/lots, and quarantine damaged
              goods with immutable ledger events
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48 sm:w-60">
            <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Scan/Search PO, vendor, item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 font-mono text-xs"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(val) => {
              if (val) setStatusFilter(val)
            }}
          >
            <SelectTrigger
              aria-label="Filter Receiving Status"
              className="h-8 w-36 text-xs font-semibold"
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open / Unreceived</SelectItem>
              <SelectItem value="partially received">
                Partially Received
              </SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredLines.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
          No purchase order lines matching filter.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="font-bold">PO Number & Vendor</TableHead>
                <TableHead className="font-bold">Line Item & Spec</TableHead>
                <TableHead className="text-center font-bold">Ordered</TableHead>
                <TableHead className="text-center font-bold">
                  Received
                </TableHead>
                <TableHead className="text-center font-bold">
                  Remaining
                </TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="text-right font-bold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLines.map((line) => (
                <TableRow key={line.id} className="text-xs">
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Barcode className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-mono font-bold text-slate-950">
                        {line.poNumber}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-600">
                      {line.vendorName}
                    </div>
                    {line.expectedDate && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Calendar className="h-2.5 w-2.5" />
                        Exp: {line.expectedDate}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-mono font-bold text-blue-900">
                      {line.itemNumber}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {line.description}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono font-semibold text-slate-800">
                    {line.orderedQuantity} {line.unit}
                  </TableCell>
                  <TableCell className="text-center font-mono font-bold text-emerald-700">
                    {line.receivedQuantity} {line.unit}
                  </TableCell>
                  <TableCell className="text-center font-mono font-semibold text-amber-800">
                    {line.remainingQuantity} {line.unit}
                  </TableCell>
                  <TableCell>
                    {line.status === 'Completed' ? (
                      <Badge className="bg-emerald-100 text-[10px] font-bold text-emerald-800">
                        Received
                      </Badge>
                    ) : line.status === 'Partially Received' ? (
                      <Badge className="bg-amber-100 text-[10px] font-bold text-amber-800">
                        Partial
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-100 text-[10px] font-bold text-blue-800">
                        Open
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openReceiveDialog(line)}
                      disabled={line.status === 'Completed'}
                      className="h-7 bg-blue-600 px-3 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Layers className="mr-1 h-3 w-3" />
                      Receive
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Receiving Dock Dialog */}
      <Dialog open={receiveModalOpen} onOpenChange={setReceiveModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-950">
              Receive Material — {selectedLine?.poNumber} Line #
              {selectedLine?.lineNumber}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Inspect physical incoming stock, log condition/lots, and store
              into warehouse staging location.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="font-semibold text-slate-900">
                {selectedLine?.itemNumber} — {selectedLine?.description}
              </div>
              <div className="mt-1 flex items-center justify-between text-slate-600">
                <span>
                  Ordered: {selectedLine?.orderedQuantity} {selectedLine?.unit}
                </span>
                <span>
                  Previously Received: {selectedLine?.receivedQuantity}{' '}
                  {selectedLine?.unit}
                </span>
                <span className="font-bold text-amber-800">
                  Remaining: {selectedLine?.remainingQuantity}{' '}
                  {selectedLine?.unit}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Good / Usable Quantity ({selectedLine?.unit}) *
                </label>
                <Input
                  aria-label="Good Quantity"
                  type="number"
                  step="any"
                  value={goodQty}
                  onChange={(e) => setGoodQty(e.target.value)}
                  className="mt-1 h-9 font-mono text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="flex items-center gap-1 text-xs font-bold text-red-700">
                  <AlertOctagon className="h-3 w-3" />
                  Damaged Quantity ({selectedLine?.unit})
                </label>
                <Input
                  aria-label="Damaged Quantity"
                  type="number"
                  step="any"
                  value={damagedQty}
                  onChange={(e) => setDamagedQty(e.target.value)}
                  className="mt-1 h-9 border-red-200 bg-red-50 font-mono text-xs font-bold text-red-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Target Warehouse Location *
                </label>
                <Select
                  value={locationId}
                  onValueChange={(val) => {
                    if (val) setLocationId(val)
                  }}
                >
                  <SelectTrigger
                    aria-label="Target Location"
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
                <label className="text-xs font-bold text-slate-700">
                  Lot / Heat Number
                </label>
                <Input
                  placeholder="e.g. LOT-2026-0819"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  className="mt-1 h-9 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">
                Receiving Notes / Damage Details (Optional)
              </label>
              <Input
                placeholder="e.g. 1 damaged sheet with deep scratch from shipping pallet band"
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
              onClick={() => setReceiveModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submittingReceive || (!goodQty && !damagedQty)}
              onClick={handleExecuteReceiving}
              className="bg-blue-600 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
            >
              {submittingReceive ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Confirm Receiving & Update Ledger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
