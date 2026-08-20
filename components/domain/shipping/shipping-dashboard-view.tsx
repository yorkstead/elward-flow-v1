'use client'

import React, { useState } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Truck,
  Plus,
  CheckCircle,
  FileSpreadsheet,
  Boxes,
  Weight,
  AlertTriangle,
  Send,
} from 'lucide-react'
import { ShipmentSummary } from '@/lib/services/shipping'
import { PalletSummary } from '@/lib/services/pallet'

interface ShippingDashboardProps {
  initialShipments: ShipmentSummary[]
  stagedPallets: PalletSummary[]
  canManage: boolean
}

export function ShippingDashboardView({
  initialShipments,
  stagedPallets,
  canManage,
}: ShippingDashboardProps) {
  const [shipmentsList, setShipmentsList] =
    useState<ShipmentSummary[]>(initialShipments)
  const [selectedShipment, setSelectedShipment] =
    useState<ShipmentSummary | null>(shipmentsList[0] || null)
  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isLoadPalletOpen, setIsLoadPalletOpen] = useState(false)
  const [isDispatchOpen, setIsDispatchOpen] = useState(false)

  // Form states
  const [newCarrier, setNewCarrier] = useState('Flatbed Freight Express')
  const [newTrailer, setNewTrailer] = useState('FB-5309')
  const [newDriver, setNewDriver] = useState('David Martinez')
  const [newDriverPhone] = useState('303-555-0192')
  const [newDestination, setNewDestination] = useState(
    'Tempe Gateway Commercial Center - 4500 Gateway Blvd, Tempe, AZ',
  )
  const [selectedPalletId, setSelectedPalletId] = useState(
    stagedPallets[0]?.id || '',
  )
  const [truckPosition, setTruckPosition] = useState(1)
  const [bolNumberInput, setBolNumberInput] = useState('')
  const [dispatchNotes, setDispatchNotes] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Metrics
  const totalShipments = shipmentsList.length
  const loadingShipments = shipmentsList.filter(
    (s) => s.status === 'Loading' || s.status === 'Draft',
  ).length
  const dispatchedShipments = shipmentsList.filter(
    (s) => s.status === 'Dispatched',
  ).length
  const totalShippedWeight = shipmentsList.reduce(
    (acc, s) => acc + s.totalWeightLbs,
    0,
  )
  const totalPalletsLoaded = shipmentsList.reduce(
    (acc, s) => acc + s.totalPallets,
    0,
  )

  const filteredShipments = shipmentsList.filter((s) => {
    const matchesSearch =
      s.shipmentNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.carrier.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (s.bolNumber &&
        s.bolNumber.toLowerCase().includes(searchFilter.toLowerCase()))
    const matchesStatus =
      statusFilter === 'ALL' || s.status.toUpperCase() === statusFilter
    return matchesSearch && matchesStatus
  })

  const refreshShipmentDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/shipping/${id}`)
      if (res.ok) {
        const data = (await res.json()) as { shipment: ShipmentSummary }
        setSelectedShipment(data.shipment)
        setShipmentsList((prev) =>
          prev.map((s) => (s.id === id ? data.shipment : s)),
        )
      }
    } catch {
      // ignore
    }
  }

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrier: newCarrier,
          trailerNumber: newTrailer,
          driverName: newDriver,
          driverPhone: newDriverPhone,
          destinationAddress: newDestination,
        }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || 'Failed to create shipment')
      }

      const data = (await res.json()) as { shipment: ShipmentSummary }
      setShipmentsList([data.shipment, ...shipmentsList])
      setSelectedShipment(data.shipment)
      setIsCreateOpen(false)
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error creating shipment',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLoadPallet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShipment) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch(`/api/shipping/${selectedShipment.id}/pallets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          palletId: selectedPalletId,
          truckPosition: Number(truckPosition),
        }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || 'Failed to load pallet')
      }

      const data = (await res.json()) as { shipment: ShipmentSummary }
      setSelectedShipment(data.shipment)
      setShipmentsList((prev) =>
        prev.map((s) => (s.id === selectedShipment.id ? data.shipment : s)),
      )
      setIsLoadPalletOpen(false)
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error loading pallet',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShipment) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch(`/api/shipping/${selectedShipment.id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bolNumber: bolNumberInput || undefined,
          notes: dispatchNotes || undefined,
        }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || 'Failed to dispatch shipment')
      }

      const data = (await res.json()) as { shipment: ShipmentSummary }
      setSelectedShipment(data.shipment)
      setShipmentsList((prev) =>
        prev.map((s) => (s.id === selectedShipment.id ? data.shipment : s)),
      )
      setIsDispatchOpen(false)
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error dispatching shipment',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Shipping &amp; Logistics Command Center
          </h1>
          <p className="text-xs text-slate-500">
            Flatbed trailer load planning, axle weight limits, and Bill of
            Lading (BOL) dispatch
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button
              onClick={() => {
                setErrorMessage(null)
                setIsCreateOpen(true)
              }}
              size="sm"
              className="bg-blue-600 text-xs font-semibold hover:bg-blue-700"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Plan New Shipment
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card className="border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Truck className="h-4 w-4 text-blue-500" />
            Total Loads
          </div>
          <div className="mt-2 text-xl font-black text-slate-900">
            {totalShipments}
          </div>
        </Card>
        <Card className="border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-600">
            <Boxes className="h-4 w-4 text-amber-500" />
            Loading/Staging
          </div>
          <div className="mt-2 text-xl font-black text-amber-700">
            {loadingShipments}
          </div>
        </Card>
        <Card className="border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            Dispatched
          </div>
          <div className="mt-2 text-xl font-black text-emerald-700">
            {dispatchedShipments}
          </div>
        </Card>
        <Card className="border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-purple-600">
            <Weight className="h-4 w-4 text-purple-500" />
            Total Weight
          </div>
          <div className="mt-2 text-xl font-black text-purple-700">
            {totalShippedWeight.toLocaleString()} lbs
          </div>
        </Card>
        <Card className="border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-600">
            <Boxes className="h-4 w-4 text-blue-500" />
            Pallets Loaded
          </div>
          <div className="mt-2 text-xl font-black text-blue-700">
            {totalPalletsLoaded}
          </div>
        </Card>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Shipment List (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search shipment #, carrier, BOL..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-8 max-w-xs text-xs"
            />
            <div className="flex items-center gap-1">
              {(['ALL', 'DRAFT', 'LOADING', 'DISPATCHED'] as const).map(
                (st) => (
                  <Button
                    key={st}
                    variant={statusFilter === st ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter(st)}
                    className="h-8 text-[10px] font-bold uppercase"
                  >
                    {st}
                  </Button>
                ),
              )}
            </div>
          </div>

          <div className="space-y-3">
            {filteredShipments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                No shipments found matching your criteria.
              </div>
            ) : (
              filteredShipments.map((s) => {
                const isSelected = selectedShipment?.id === s.id
                const weightPercent = Math.min(
                  100,
                  (s.totalWeightLbs / 45000) * 100,
                )

                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedShipment(s)
                      refreshShipmentDetail(s.id)
                    }}
                    className={`cursor-pointer rounded-lg border p-4 transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {s.shipmentNumber}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold uppercase ${
                              s.status === 'Dispatched'
                                ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                                : s.status === 'Loading'
                                  ? 'border-amber-200 bg-amber-100 text-amber-800'
                                  : 'border-slate-200 bg-slate-100 text-slate-800'
                            }`}
                          >
                            {s.status}
                          </Badge>
                          {s.bolNumber && (
                            <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-blue-700">
                              {s.bolNumber}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {s.carrier} • Trailer{' '}
                          <span className="font-semibold text-slate-700">
                            {s.trailerNumber || 'N/A'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-slate-900">
                          {s.totalPallets} Pallets
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {s.totalWeightLbs.toLocaleString()} / 45,000 lbs
                        </div>
                      </div>
                    </div>

                    {/* Weight Capacity Progress Bar */}
                    <div className="mt-3 border-t border-slate-100 pt-2">
                      <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                        <span>
                          Flatbed Capacity ({s.totalPallets}/26 Pallets)
                        </span>
                        <span>{weightPercent.toFixed(0)}% Legal Limit</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full ${weightPercent > 90 ? 'bg-red-500' : 'bg-blue-600'}`}
                          style={{ width: `${weightPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Shipment Inspector (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          {selectedShipment ? (
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      {selectedShipment.shipmentNumber}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {selectedShipment.carrier} •{' '}
                      {selectedShipment.destinationAddress}
                    </CardDescription>
                  </div>
                  <a
                    href={`/api/shipping/${selectedShipment.id}/export`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <FileSpreadsheet className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                      BOL CSV
                    </Button>
                  </a>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <div className="text-slate-500">Driver &amp; Contact</div>
                    <div className="mt-1 font-bold text-slate-900">
                      {selectedShipment.driverName || 'Unassigned'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {selectedShipment.driverPhone || ''}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <div className="text-slate-500">Total Weight Loaded</div>
                    <div className="mt-1 font-bold text-slate-900">
                      {selectedShipment.totalWeightLbs.toLocaleString()} lbs
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {selectedShipment.totalPanels} total panels
                    </div>
                  </div>
                </div>

                {/* Flatbed Trailer Positions Table */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Trailer Bed Manifest (
                      {selectedShipment.pallets?.length || 0} pallets)
                    </span>
                    {canManage && selectedShipment.status !== 'Dispatched' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setErrorMessage(null)
                          setIsLoadPalletOpen(true)
                        }}
                        className="h-6 text-[11px]"
                      >
                        <Plus className="mr-1 h-3 w-3" /> Load Pallet
                      </Button>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                        <tr>
                          <th className="p-2">Pos</th>
                          <th className="p-2">Pallet #</th>
                          <th className="p-2">Release</th>
                          <th className="p-2 text-right">Panels</th>
                          <th className="p-2 text-right">Weight</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {!selectedShipment.pallets ||
                        selectedShipment.pallets.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="p-4 text-center text-slate-400"
                            >
                              No pallets loaded onto this trailer yet.
                            </td>
                          </tr>
                        ) : (
                          selectedShipment.pallets.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50/50">
                              <td className="p-2 font-mono text-[10px] text-slate-400">
                                #{p.truckPosition || '-'}
                              </td>
                              <td className="p-2 font-bold text-slate-800">
                                {p.palletNumber}
                              </td>
                              <td className="p-2 text-slate-500">
                                {p.releaseKey}
                              </td>
                              <td className="p-2 text-right font-semibold text-slate-700">
                                {p.panelCount}
                              </td>
                              <td className="p-2 text-right font-black text-slate-900">
                                {p.weightLbs} lbs
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Dispatch Action */}
                {canManage && selectedShipment.status !== 'Dispatched' && (
                  <Button
                    onClick={() => {
                      setErrorMessage(null)
                      setIsDispatchOpen(true)
                    }}
                    disabled={
                      isSubmitting || selectedShipment.totalPallets === 0
                    }
                    className="w-full bg-emerald-600 text-xs font-bold hover:bg-emerald-700"
                  >
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Authorize &amp; Dispatch Shipment (BOL)
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
              Select a shipment to inspect trailer loading manifest and dispatch
              status.
            </div>
          )}
        </div>
      </div>

      {/* Plan Shipment Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateShipment}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Plan New Shipment Load
              </DialogTitle>
              <DialogDescription className="text-xs">
                Schedule a carrier flatbed and staging load.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-3 py-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Carrier</label>
                <input
                  type="text"
                  value={newCarrier}
                  onChange={(e) => setNewCarrier(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">
                    Trailer #
                  </label>
                  <input
                    type="text"
                    value={newTrailer}
                    onChange={(e) => setNewTrailer(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">
                    Driver Name
                  </label>
                  <input
                    type="text"
                    value={newDriver}
                    onChange={(e) => setNewDriver(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-700">
                  Destination Address
                </label>
                <input
                  type="text"
                  value={newDestination}
                  onChange={(e) => setNewDestination(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
                className="bg-blue-600 text-xs font-semibold hover:bg-blue-700"
              >
                {isSubmitting ? 'Creating...' : 'Initialize Load'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Load Pallet Modal */}
      <Dialog open={isLoadPalletOpen} onOpenChange={setIsLoadPalletOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleLoadPallet}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Load Staged Pallet onto {selectedShipment?.shipmentNumber}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Select completed and staged pallets ready for flatbed loading.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-3 py-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700">
                  Staged Pallet
                </label>
                <select
                  value={selectedPalletId}
                  onChange={(e) => setSelectedPalletId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 text-xs"
                >
                  {stagedPallets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.palletNumber} ({p.releaseKey} • {p.panelCount} panels •{' '}
                      {p.currentWeightLbs} lbs)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  Truck Position (1 - 26)
                </label>
                <input
                  type="number"
                  min={1}
                  max={26}
                  value={truckPosition}
                  onChange={(e) =>
                    setTruckPosition(parseInt(e.target.value) || 1)
                  }
                  className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsLoadPalletOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
                className="bg-blue-600 text-xs font-semibold hover:bg-blue-700"
              >
                {isSubmitting ? 'Loading...' : 'Confirm Load'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dispatch Modal */}
      <Dialog open={isDispatchOpen} onOpenChange={setIsDispatchOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleDispatch}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Authorize &amp; Dispatch Shipment
              </DialogTitle>
              <DialogDescription className="text-xs">
                Generates final Bill of Lading (BOL) and updates release &amp;
                pallet shipment status.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-3 py-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700">
                  BOL Number (Optional Override)
                </label>
                <input
                  type="text"
                  placeholder="Auto-generated if empty"
                  value={bolNumberInput}
                  onChange={(e) => setBolNumberInput(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">
                  Dispatch Notes / Gate Release
                </label>
                <textarea
                  rows={3}
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                  placeholder="e.g. Tarps secured, driver signed BOL at gate."
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDispatchOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
                className="bg-emerald-600 text-xs font-semibold hover:bg-emerald-700"
              >
                {isSubmitting ? 'Dispatching...' : 'Dispatch &amp; Print BOL'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
