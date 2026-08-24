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
  AlertTriangle,
  Sparkles,
  Search,
  Trash2,
} from 'lucide-react'
import { PalletSummary } from '@/lib/services/pallet'
import { PalletPlanView } from './pallet-plan-view'

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

type MainTab = 'PLAN' | 'BUILD' | 'STAGED' | 'SHIPPED'

export function PalletDashboardView({
  initialPallets,
  availableReleases,
  availableMarks,
  canManage,
}: PalletDashboardProps) {
  const [activeTab, setActiveTab] = useState<MainTab>('PLAN')
  const [palletsList, setPalletsList] =
    useState<PalletSummary[]>(initialPallets)
  const [selectedPallet, setSelectedPallet] = useState<PalletSummary | null>(
    palletsList[0] || null,
  )
  const [searchFilter, setSearchFilter] = useState('')
  const [selectedPlanReleaseId, setSelectedPlanReleaseId] = useState(
    availableReleases[0]?.id || '',
  )

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
    (p) => p.status === 'Building' || p.status === 'Draft',
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
        p.elevation.toLowerCase().includes(searchFilter.toLowerCase())) ||
      (p.elevations &&
        p.elevations.some((e) =>
          e.toLowerCase().includes(searchFilter.toLowerCase()),
        ))

    let matchesTab = true
    if (activeTab === 'BUILD') {
      matchesTab = p.status === 'Building' || p.status === 'Draft'
    } else if (activeTab === 'STAGED') {
      matchesTab = p.status === 'Staged'
    } else if (activeTab === 'SHIPPED') {
      matchesTab = p.status === 'Shipped'
    }

    return matchesSearch && matchesTab
  })

  const refreshPallets = async () => {
    try {
      const res = await fetch('/api/pallets')
      if (res.ok) {
        const data = await res.json()
        setPalletsList(data.pallets || [])
        if (selectedPallet) {
          const updated = data.pallets.find(
            (p: PalletSummary) => p.id === selectedPallet.id,
          )
          if (updated) setSelectedPallet(updated)
        }
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
          maxWeightLbs: 3500,
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

  const handleRemoveItem = async (itemId: string) => {
    if (!selectedPallet) return
    setIsSubmitting(true)
    try {
      const res = await fetch(
        `/api/pallets/${selectedPallet.id}/items?itemId=${itemId}`,
        {
          method: 'DELETE',
        },
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to remove item')
      }
      const data = await res.json()
      setSelectedPallet(data.pallet)
      setPalletsList((prev) =>
        prev.map((p) => (p.id === selectedPallet.id ? data.pallet : p)),
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove item')
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

  const handleExportCsv = async (palletId: string) => {
    try {
      window.open(`/api/pallets/${palletId}/export`, '_blank')
    } catch {
      alert('Failed to export packing slip')
    }
  }

  const currentPlanRelease =
    availableReleases.find((r) => r.id === selectedPlanReleaseId) ||
    availableReleases[0]

  return (
    <div className="space-y-6">
      {/* Top Navigation & Mode Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Palletizing &amp; Staging Command Center
          </h1>
          <p className="text-xs text-slate-500">
            Intelligent release planning, multi-elevation stacking, weight
            limits, and packing slips
          </p>
        </div>

        {/* Tab Controls: PLAN | BUILD | STAGED | SHIPPED */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
          {(
            [
              { key: 'PLAN', label: 'Plan', icon: Sparkles },
              { key: 'BUILD', label: 'Build', icon: Layers },
              { key: 'STAGED', label: 'Staged', icon: CheckCircle },
              { key: 'SHIPPED', label: 'Shipped', icon: Truck },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-white text-blue-700 shadow-xs ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}
                />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* KPI Cards Bar */}
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

      {/* TAB 1: PLAN VIEW */}
      {activeTab === 'PLAN' && (
        <div className="space-y-4">
          {/* Release Selection Bar */}
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                Target Release:
              </span>
              <select
                value={selectedPlanReleaseId}
                onChange={(e) => setSelectedPlanReleaseId(e.target.value)}
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-blue-600"
              >
                {availableReleases.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.releaseKey} (Job #{r.jobNumber})
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[11px] text-slate-500">
              Only active approved revisions generate release plans.
            </span>
          </div>

          {currentPlanRelease && (
            <PalletPlanView
              releaseId={currentPlanRelease.id}
              releaseKey={currentPlanRelease.releaseKey}
              jobNumber={currentPlanRelease.jobNumber}
              canManage={canManage}
              onPlanApplied={() => {
                refreshPallets()
                setActiveTab('BUILD')
              }}
            />
          )}
        </div>
      )}

      {/* TABS 2, 3, 4: BUILD / STAGED / SHIPPED OPERATIONAL VIEWS */}
      {activeTab !== 'PLAN' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-72">
              <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search pallet #, release key, elevation..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="h-8 bg-white pl-8 text-xs"
              />
            </div>

            {canManage && activeTab === 'BUILD' && (
              <Button
                onClick={() => {
                  setErrorMessage(null)
                  setIsCreateOpen(true)
                }}
                size="sm"
                className="bg-blue-600 text-xs font-semibold hover:bg-blue-700"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Build Manual Pallet
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Operational Pallets Grid (7 cols) */}
            <div className="space-y-3 lg:col-span-7">
              {filteredPallets.length === 0 ? (
                <Card className="p-8 text-center text-xs text-slate-400">
                  No {activeTab.toLowerCase()} pallets found.
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {filteredPallets.map((p) => {
                    const isSelected = p.id === selectedPallet?.id
                    const elevations =
                      p.elevations && p.elevations.length > 0
                        ? p.elevations
                        : p.elevation
                          ? [p.elevation]
                          : ['General']

                    return (
                      <Card
                        key={p.id}
                        onClick={() => setSelectedPallet(p)}
                        className={`cursor-pointer transition-all hover:border-blue-400 ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <CardHeader className="p-3.5 pb-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {p.palletNumber}
                            </span>
                            <Badge
                              className={`text-[10px] ${
                                p.status === 'Staged'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : p.status === 'Shipped'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {p.status.toUpperCase()}
                            </Badge>
                          </div>
                          <CardDescription className="text-[11px] font-semibold text-slate-600">
                            {p.releaseKey} • Job #{p.jobNumber}
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-2 p-3.5 pt-0 text-xs">
                          {/* Dimensions */}
                          {p.widthInches && p.lengthInches && (
                            <div className="font-mono text-[11px] text-slate-500">
                              {`${p.widthInches}" × ${p.lengthInches}"`}
                            </div>
                          )}

                          {/* Capacity indicators */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                              <span>
                                Weight: {p.currentWeightLbs} / {p.maxWeightLbs}{' '}
                                lb
                              </span>
                              <span>
                                {(
                                  (p.currentWeightLbs / p.maxWeightLbs) *
                                  100
                                ).toFixed(0)}
                                %
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full bg-emerald-500"
                                style={{
                                  width: `${Math.min(100, (p.currentWeightLbs / p.maxWeightLbs) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>

                          {/* Elevations */}
                          <div className="flex flex-wrap gap-1 pt-1">
                            {elevations.map((e, idx) => (
                              <Badge
                                key={idx}
                                className="bg-slate-100 text-[10px] font-medium text-slate-700"
                              >
                                {e}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right: Selected Pallet Inspector (5 cols) */}
            <div className="space-y-4 lg:col-span-5">
              {selectedPallet ? (
                <Card className="border-slate-200 bg-white shadow-xs">
                  <CardHeader className="border-b border-slate-100 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-black text-slate-900">
                          {selectedPallet.palletNumber}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {selectedPallet.releaseKey} • {selectedPallet.status}
                        </CardDescription>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExportCsv(selectedPallet.id)}
                        className="text-xs font-semibold text-slate-700"
                      >
                        <FileSpreadsheet className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                        Packing Slip
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-4 text-xs">
                    <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-3">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">
                          Total Panels
                        </span>
                        <span className="text-base font-black text-slate-900">
                          {selectedPallet.panelCount}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">
                          Total Weight
                        </span>
                        <span className="text-base font-black text-slate-900">
                          {selectedPallet.currentWeightLbs} lb
                        </span>
                      </div>
                    </div>

                    {/* Staged Items List */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-bold text-slate-700">
                          Stacked Panels ({selectedPallet.items?.length || 0})
                        </span>
                        {canManage && selectedPallet.status === 'Building' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsAddItemOpen(true)}
                            className="h-6 text-[10px] font-semibold text-blue-700"
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Add Panel
                          </Button>
                        )}
                      </div>

                      <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                        {(selectedPallet.items || []).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2.5 hover:bg-slate-50"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-blue-700">
                                  {item.markCode}
                                </span>
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">
                                  × {item.quantity}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {item.materialFamily} •{' '}
                                {item.dimensions || 'Custom'}{' '}
                                {item.elevation && `• ${item.elevation}`}
                              </div>
                            </div>

                            {canManage &&
                              selectedPallet.status === 'Building' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Complete & Stage Button */}
                    {canManage && selectedPallet.status === 'Building' && (
                      <Button
                        onClick={() => handleCompletePallet(selectedPallet.id)}
                        disabled={
                          isSubmitting || selectedPallet.panelCount === 0
                        }
                        className="w-full bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                        Complete &amp; Stage for Shipping
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-xs text-slate-400">
                  Select a pallet to inspect details
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Build Pallet Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-white sm:max-w-md">
          <form onSubmit={handleCreatePallet}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Build New Pallet
              </DialogTitle>
              <DialogDescription className="text-xs">
                Create an empty pallet container linked to an active release.
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
                      {r.releaseKey} (Job #{r.jobNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  Initial Elevation Grouping
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
        <DialogContent className="bg-white sm:max-w-md">
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
                  max={100}
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
