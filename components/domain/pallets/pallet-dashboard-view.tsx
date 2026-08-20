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
  Boxes,
  Plus,
  CheckCircle,
  FileSpreadsheet,
  Package,
  Layers,
  Truck,
  Weight,
  Ruler,
  AlertTriangle,
} from 'lucide-react'
import { PalletSummary } from '@/lib/services/pallet'

interface PalletDashboardProps {
  initialPallets: PalletSummary[]
  availableReleases: { id: string; releaseKey: string; jobNumber: string }[]
  availableMarks: {
    id: string
    releaseId: string
    mark: string
    materialFamily: string
    color: string | null
    dimensions: string | null
    quantity: number
  }[]
  canManage: boolean
}

export function PalletDashboardView({
  initialPallets,
  availableReleases,
  availableMarks,
  canManage,
}: PalletDashboardProps) {
  const [palletsList, setPalletsList] =
    useState<PalletSummary[]>(initialPallets)
  const [selectedPallet, setSelectedPallet] = useState<PalletSummary | null>(
    palletsList[0] || null,
  )
  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [selectedReleaseId, setSelectedReleaseId] = useState(
    availableReleases[0]?.id || '',
  )
  const [newElevation, setNewElevation] = useState('North Elevation')
  const [selectedMarkId, setSelectedMarkId] = useState(
    availableMarks[0]?.id || '',
  )
  const [addItemQty, setAddItemQty] = useState(1)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Metrics
  const totalPallets = palletsList.length
  const buildingPallets = palletsList.filter(
    (p) => p.status === 'Building',
  ).length
  const stagedPallets = palletsList.filter((p) => p.status === 'Staged').length
  const shippedPallets = palletsList.filter(
    (p) => p.status === 'Shipped',
  ).length
  const totalPanels = palletsList.reduce((acc, p) => acc + p.panelCount, 0)

  const filteredPallets = palletsList.filter((p) => {
    const matchesSearch =
      p.palletNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.releaseKey.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (p.elevation &&
        p.elevation.toLowerCase().includes(searchFilter.toLowerCase()))
    const matchesStatus =
      statusFilter === 'ALL' || p.status.toUpperCase() === statusFilter
    return matchesSearch && matchesStatus
  })

  const refreshPalletDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/pallets/${id}`)
      if (res.ok) {
        const data = (await res.json()) as { pallet: PalletSummary }
        setSelectedPallet(data.pallet)
        setPalletsList((prev) =>
          prev.map((p) => (p.id === id ? data.pallet : p)),
        )
      }
    } catch {
      // ignore
    }
  }

  const handleCreatePallet = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/pallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: selectedReleaseId,
          elevation: newElevation,
          maxHeightInches: 60,
          maxWeightLbs: 2500,
        }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || 'Failed to create pallet')
      }

      const data = (await res.json()) as { pallet: PalletSummary }
      setPalletsList([data.pallet, ...palletsList])
      setSelectedPallet(data.pallet)
      setIsCreateOpen(false)
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to create pallet',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPallet) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch(`/api/pallets/${selectedPallet.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panelMarkId: selectedMarkId,
          quantity: Number(addItemQty),
        }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || 'Failed to add panel to pallet')
      }

      const data = (await res.json()) as { pallet: PalletSummary }
      setSelectedPallet(data.pallet)
      setPalletsList((prev) =>
        prev.map((p) => (p.id === selectedPallet.id ? data.pallet : p)),
      )
      setIsAddItemOpen(false)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to add item')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCompletePallet = async (palletId: string) => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/pallets/${palletId}/complete`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || 'Failed to complete pallet')
      }
      const data = (await res.json()) as { pallet: PalletSummary }
      setSelectedPallet(data.pallet)
      setPalletsList((prev) =>
        prev.map((p) => (p.id === palletId ? data.pallet : p)),
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to complete pallet')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Palletizing &amp; Staging Command Center
          </h1>
          <p className="text-xs text-slate-500">
            Stack sequence verification, height/weight constraint limits, and
            packing slips
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
              Build New Pallet
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card className="border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Boxes className="h-4 w-4 text-blue-500" />
            Total Pallets
          </div>
          <div className="mt-2 text-xl font-black text-slate-900">
            {totalPallets}
          </div>
        </Card>
        <Card className="border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-600">
            <Layers className="h-4 w-4 text-amber-500" />
            Building
          </div>
          <div className="mt-2 text-xl font-black text-amber-700">
            {buildingPallets}
          </div>
        </Card>
        <Card className="border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            Staged for Ship
          </div>
          <div className="mt-2 text-xl font-black text-emerald-700">
            {stagedPallets}
          </div>
        </Card>
        <Card className="border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-600">
            <Truck className="h-4 w-4 text-blue-500" />
            Shipped
          </div>
          <div className="mt-2 text-xl font-black text-blue-700">
            {shippedPallets}
          </div>
        </Card>
        <Card className="border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-purple-600">
            <Package className="h-4 w-4 text-purple-500" />
            Panels Staged
          </div>
          <div className="mt-2 text-xl font-black text-purple-700">
            {totalPanels}
          </div>
        </Card>
      </div>

      {/* Main Split Layout: Pallet Grid & Selected Detail */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Pallet List & Filter (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search pallet #, release key, elevation..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-8 max-w-xs text-xs"
            />
            <div className="flex items-center gap-1">
              {(['ALL', 'BUILDING', 'STAGED', 'SHIPPED'] as const).map((st) => (
                <Button
                  key={st}
                  variant={statusFilter === st ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(st)}
                  className="h-8 text-[10px] font-bold uppercase"
                >
                  {st}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredPallets.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                No pallets found matching your criteria.
              </div>
            ) : (
              filteredPallets.map((p) => {
                const isSelected = selectedPallet?.id === p.id
                const weightPercent = Math.min(
                  100,
                  (p.currentWeightLbs / (p.maxWeightLbs || 2500)) * 100,
                )
                const heightPercent = Math.min(
                  100,
                  (p.currentHeightInches / (p.maxHeightInches || 60)) * 100,
                )

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedPallet(p)
                      refreshPalletDetail(p.id)
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
                            {p.palletNumber}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold uppercase ${
                              p.status === 'Shipped'
                                ? 'border-blue-200 bg-blue-100 text-blue-800'
                                : p.status === 'Staged'
                                  ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                                  : 'border-amber-200 bg-amber-100 text-amber-800'
                            }`}
                          >
                            {p.status}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Release{' '}
                          <span className="font-semibold text-slate-700">
                            {p.releaseKey}
                          </span>{' '}
                          • {p.elevation || 'No Elevation Group'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-slate-900">
                          {p.panelCount} Panels
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {p.currentWeightLbs.toFixed(0)} / {p.maxWeightLbs} lbs
                        </div>
                      </div>
                    </div>

                    {/* Weight & Height Micro-Bars */}
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-2">
                      <div>
                        <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                          <span>Weight</span>
                          <span>{weightPercent.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full ${weightPercent > 90 ? 'bg-red-500' : 'bg-blue-600'}`}
                            style={{ width: `${weightPercent}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                          <span>Height</span>
                          <span>
                            {p.currentHeightInches.toFixed(1)}&quot; /{' '}
                            {p.maxHeightInches}&quot;
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full ${heightPercent > 90 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${heightPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Pallet Inspector (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          {selectedPallet ? (
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      {selectedPallet.palletNumber}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {selectedPallet.releaseKey} • {selectedPallet.jobName}
                    </CardDescription>
                  </div>
                  <a
                    href={`/api/pallets/${selectedPallet.id}/export`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <FileSpreadsheet className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                      Packing Slip
                    </Button>
                  </a>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Weight className="h-3.5 w-3.5" /> Total Weight
                    </div>
                    <div className="mt-1 font-bold text-slate-900">
                      {selectedPallet.currentWeightLbs.toFixed(1)} lbs
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Ruler className="h-3.5 w-3.5" /> Stack Height
                    </div>
                    <div className="mt-1 font-bold text-slate-900">
                      {selectedPallet.currentHeightInches.toFixed(1)} inches
                    </div>
                  </div>
                </div>

                {/* Pallet Stacking Manifest Table */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Stack Contents ({selectedPallet.items?.length || 0} items)
                    </span>
                    {canManage && selectedPallet.status !== 'Shipped' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setErrorMessage(null)
                          setIsAddItemOpen(true)
                        }}
                        className="h-6 text-[11px]"
                      >
                        <Plus className="mr-1 h-3 w-3" /> Add Mark
                      </Button>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                        <tr>
                          <th className="p-2">Seq</th>
                          <th className="p-2">Mark</th>
                          <th className="p-2">Material</th>
                          <th className="p-2 text-right">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {!selectedPallet.items ||
                        selectedPallet.items.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="p-4 text-center text-slate-400"
                            >
                              No items loaded onto this pallet yet.
                            </td>
                          </tr>
                        ) : (
                          selectedPallet.items.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="p-2 font-mono text-[10px] text-slate-400">
                                #{item.sequence}
                              </td>
                              <td className="p-2 font-bold text-slate-800">
                                {item.markCode}
                              </td>
                              <td className="p-2 text-slate-500">
                                {item.materialFamily}
                              </td>
                              <td className="p-2 text-right font-black text-slate-900">
                                {item.quantity}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Finalize Actions */}
                {canManage && selectedPallet.status === 'Building' && (
                  <Button
                    onClick={() => handleCompletePallet(selectedPallet.id)}
                    disabled={isSubmitting || selectedPallet.panelCount === 0}
                    className="w-full bg-emerald-600 text-xs font-bold hover:bg-emerald-700"
                  >
                    <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                    Complete &amp; Stage for Shipping
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
              Select a pallet from the list to view stack details and packing
              slip.
            </div>
          )}
        </div>
      </div>

      {/* Build Pallet Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreatePallet}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Build New Pallet
              </DialogTitle>
              <DialogDescription className="text-xs">
                Create an empty pallet container linked to an active release and
                elevation zone.
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
                  Select Release
                </label>
                <select
                  value={selectedReleaseId}
                  onChange={(e) => setSelectedReleaseId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 text-xs"
                >
                  {availableReleases.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.releaseKey} (Job {r.jobNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  Elevation Grouping
                </label>
                <input
                  type="text"
                  value={newElevation}
                  onChange={(e) => setNewElevation(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                  placeholder="e.g. North Elevation, Level 4"
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
                {isSubmitting ? 'Creating...' : 'Initialize Pallet'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Item Modal */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAddItem}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Stack Panel Mark onto {selectedPallet?.palletNumber}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Select from produced panel marks ready for packaging.
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
                  Panel Mark
                </label>
                <select
                  value={selectedMarkId}
                  onChange={(e) => setSelectedMarkId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 text-xs"
                >
                  {availableMarks.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.mark} • {m.materialFamily} (
                      {m.dimensions || 'Standard'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={addItemQty}
                  onChange={(e) =>
                    setAddItemQty(Math.max(1, parseInt(e.target.value) || 1))
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
                onClick={() => setIsAddItemOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
                className="bg-blue-600 text-xs font-semibold hover:bg-blue-700"
              >
                {isSubmitting ? 'Adding...' : 'Add to Pallet'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
