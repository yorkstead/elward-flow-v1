'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileSearch,
  Layers,
  ShieldCheck,
  Scale,
} from 'lucide-react'
import { PalletPlanDetail } from '@/lib/services/pallet-planner'
import { PalletWarning } from '@/lib/domain/palletization'

interface PalletPlanViewProps {
  releaseId: string
  releaseKey: string
  jobNumber: string
  canManage: boolean
  onPlanApplied?: () => void
}

export function PalletPlanView({
  releaseId,
  releaseKey,
  canManage,
  onPlanApplied,
}: PalletPlanViewProps) {
  const [currentPlan, setCurrentPlan] = useState<PalletPlanDetail | null>(null)
  const [selectedPalletId, setSelectedPalletId] = useState<string | null>(null)
  const [selectedElevationFilter, setSelectedElevationFilter] = useState<
    string | null
  >(null)
  const [inspectingItem, setInspectingItem] = useState<{
    mark: string
    elevation: string
    materialFamily: string
    dimensions: string
    sourceProvenance?: {
      documentId?: string
      documentName?: string
      documentType?: string
      page?: number
      confidence?: number
      rawText?: string
    }
  } | null>(null)

  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false)
  const [selectedWarning, setSelectedWarning] = useState<{
    palletPlanPalletId: string
    warning: PalletWarning
  } | null>(null)
  const [overrideReason, setOverrideReason] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const reloadPlans = useCallback(async () => {
    if (!releaseId) return
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/pallet-plans?releaseId=${releaseId}`)
      if (!res.ok) {
        throw new Error('Failed to load pallet plans')
      }
      const data = await res.json()
      if (data.plans && data.plans.length > 0) {
        const detailRes = await fetch(`/api/pallet-plans/${data.plans[0].id}`)
        if (detailRes.ok) {
          const detailData = await detailRes.json()
          setCurrentPlan(detailData.plan)
          setSelectedPalletId(detailData.plan.pallets[0]?.id || null)
        }
      } else {
        setCurrentPlan(null)
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error fetching plans',
      )
    } finally {
      setIsLoading(false)
    }
  }, [releaseId])

  useEffect(() => {
    let ignore = false
    const load = async () => {
      if (!releaseId) return
      try {
        const res = await fetch(`/api/pallet-plans?releaseId=${releaseId}`)
        if (!res.ok) throw new Error('Failed to load pallet plans')
        const data = await res.json()
        if (ignore) return
        if (data.plans && data.plans.length > 0) {
          const detailRes = await fetch(`/api/pallet-plans/${data.plans[0].id}`)
          if (detailRes.ok) {
            const detailData = await detailRes.json()
            if (!ignore) {
              setCurrentPlan(detailData.plan)
              setSelectedPalletId(detailData.plan.pallets[0]?.id || null)
            }
          }
        } else {
          setCurrentPlan(null)
        }
      } catch (err) {
        if (!ignore) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Error fetching plans',
          )
        }
      }
    }

    void load()
    return () => {
      ignore = true
    }
  }, [releaseId])

  const handleGeneratePlan = async () => {
    setIsGenerating(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const res = await fetch('/api/pallet-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to generate plan')
      }
      const data = await res.json()
      setCurrentPlan(data.plan)
      setSelectedPalletId(data.plan.pallets[0]?.id || null)
      setSuccessMessage('Generated new intelligent pallet plan recommendation.')
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to generate plan',
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApprovePlan = async () => {
    if (!currentPlan) return
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/pallet-plans/${currentPlan.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Approved via Pallet Command Center' }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to approve plan')
      }
      const data = await res.json()
      setCurrentPlan(data.plan)
      setSuccessMessage('Pallet plan approved successfully.')
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to approve plan',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyPlan = async () => {
    if (!currentPlan) return
    setIsApplying(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/pallet-plans/${currentPlan.id}/apply`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to apply plan')
      }
      const data = await res.json()
      setSuccessMessage(
        `Applied plan! Successfully created ${data.totalPallets} operational pallets.`,
      )
      if (onPlanApplied) onPlanApplied()
      void reloadPlans()
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to apply plan',
      )
    } finally {
      setIsApplying(false)
    }
  }

  const handleOverrideWarning = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPlan || !selectedWarning) return
    try {
      const res = await fetch(`/api/pallet-plans/${currentPlan.id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          palletPlanPalletId: selectedWarning.palletPlanPalletId,
          warningCode: selectedWarning.warning.code,
          reason: overrideReason,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to override warning')
      }
      const data = await res.json()
      setCurrentPlan(data.plan)
      setIsOverrideModalOpen(false)
      setOverrideReason('')
      setSelectedWarning(null)
      setSuccessMessage('Warning override recorded in audit ledger.')
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to record override',
      )
    }
  }

  const selectedPallet =
    currentPlan?.pallets.find((p) => p.id === selectedPalletId) ||
    currentPlan?.pallets[0] ||
    null

  return (
    <div className="space-y-6">
      {/* Action & Status Header */}
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              Release Pallet Planner
            </h2>
            <Badge
              variant="outline"
              className="bg-blue-50 font-mono text-xs font-bold text-blue-700"
            >
              {releaseKey}
            </Badge>
            {currentPlan && (
              <Badge
                className={`text-xs font-semibold ${
                  currentPlan.status === 'Approved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : currentPlan.status === 'Applied'
                      ? 'bg-purple-100 text-purple-800'
                      : currentPlan.status === 'Superseded'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-800'
                }`}
              >
                {currentPlan.status.toUpperCase()}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Deterministic bin packing with elevation grouping, material borders,
            and document provenance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <Button
                size="sm"
                onClick={handleGeneratePlan}
                disabled={isGenerating}
                className="bg-blue-600 font-semibold text-white hover:bg-blue-700"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {currentPlan ? 'Regenerate Plan' : 'Generate Pallet Plan'}
              </Button>

              {currentPlan && currentPlan.status === 'Draft' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleApprovePlan}
                  disabled={isLoading || currentPlan.hasBlockingWarnings}
                  className="border-emerald-600 font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                  Approve Plan
                </Button>
              )}

              {currentPlan && currentPlan.status === 'Approved' && (
                <Button
                  size="sm"
                  onClick={handleApplyPlan}
                  disabled={isApplying}
                  className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Apply to Shop Floor
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* No Plan Generated State */}
      {!currentPlan && !isLoading && (
        <Card className="border-dashed border-slate-300 p-12 text-center">
          <Boxes className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-4 text-base font-bold text-slate-900">
            No Pallet Plan for {releaseKey}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Automatically group active panel marks by elevation, compute
            material-specific border footprints, and pack within target limits.
          </p>
          {canManage && (
            <Button
              onClick={handleGeneratePlan}
              disabled={isGenerating}
              className="mt-6 bg-blue-600 text-xs font-semibold hover:bg-blue-700"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Generate Recommended Plan
            </Button>
          )}
        </Card>
      )}

      {/* Plan Dashboard View */}
      {currentPlan && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-slate-200 p-3 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Boxes className="h-3.5 w-3.5 text-blue-500" />
                Planned Pallets
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">
                {currentPlan.palletCount}
              </div>
            </Card>

            <Card className="border-slate-200 p-3 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Layers className="h-3.5 w-3.5 text-indigo-500" />
                Total Panels
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">
                {currentPlan.totalPanels}
              </div>
            </Card>

            <Card className="border-slate-200 p-3 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Scale className="h-3.5 w-3.5 text-emerald-500" />
                Total Weight
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-700">
                {currentPlan.totalWeightLbs.toLocaleString()} lb
              </div>
            </Card>

            <Card className="border-slate-200 p-3 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Warnings / Overrides
              </div>
              <div className="mt-2 text-2xl font-black text-amber-700">
                {currentPlan.warningsCount}
              </div>
            </Card>
          </div>

          {/* Main Visual Pallet Grid & Selected Pallet Inspector */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Planned Pallets List (5 cols) */}
            <div className="space-y-3 lg:col-span-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Proposed Pallets ({currentPlan.pallets.length})
                </h3>
              </div>

              <div className="max-h-[700px] space-y-2.5 overflow-y-auto pr-1">
                {currentPlan.pallets.map((p) => {
                  const isSelected = p.id === selectedPallet?.id
                  const isOverWeight = p.geometry.weightLbs > 3500
                  const isOverHeight = p.geometry.heightInches > 60

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPalletId(p.id)}
                      className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-600'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-black text-slate-900">
                          {p.plannedPalletNumber}
                        </span>
                        <Badge
                          variant="outline"
                          className="bg-slate-50 font-mono text-[10px]"
                        >
                          {p.panelCount} panels
                        </Badge>
                      </div>

                      {/* Dimensions & Border */}
                      <div className="mt-2 text-[11px] font-semibold text-slate-600">
                        {`${p.geometry.widthInches}" × ${p.geometry.lengthInches}"`}
                        <span className="ml-1 text-[10px] font-normal text-slate-400">
                          {`(+${p.geometry.borderInches}" border)`}
                        </span>
                      </div>

                      {/* Weight Progress Bar */}
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                          <span>Weight</span>
                          <span
                            className={
                              isOverWeight
                                ? 'font-bold text-rose-600'
                                : 'text-slate-700'
                            }
                          >
                            {p.geometry.weightLbs.toLocaleString()} / 3,500 lb
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full ${
                              isOverWeight ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                p.weightCapacityPercent,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Height Progress Bar */}
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                          <span>Height</span>
                          <span
                            className={
                              isOverHeight
                                ? 'font-bold text-amber-600'
                                : 'text-slate-700'
                            }
                          >
                            {`${p.geometry.heightInches}" / 60"`}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full ${
                              isOverHeight ? 'bg-amber-500' : 'bg-blue-500'
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                p.heightCapacityPercent,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Elevations List */}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {p.elevations.map((elev, idx) => (
                          <Badge
                            key={idx}
                            className="border border-indigo-200 bg-indigo-50 text-[10px] font-semibold text-indigo-700"
                          >
                            {elev}
                          </Badge>
                        ))}
                      </div>

                      {/* Warnings pill */}
                      {p.warnings.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                          {p.warnings.length} warning(s)
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right: Selected Pallet Detail & Panel Stack (7 cols) */}
            <div className="space-y-4 lg:col-span-7">
              {selectedPallet ? (
                <Card className="border-slate-200 shadow-xs">
                  <CardHeader className="border-b border-slate-100 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-black text-slate-900">
                          {selectedPallet.plannedPalletNumber}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Stack Sequence &amp; Dimension Layout
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-xs font-bold text-slate-900">
                          {`Footprint: ${selectedPallet.geometry.widthInches}" × ${selectedPallet.geometry.lengthInches}"`}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Target Height: 60&quot; • Max: 3,500 lb
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-4">
                    {/* Elevations represented on this pallet */}
                    <div>
                      <span className="mb-1.5 block text-[11px] font-bold text-slate-600">
                        Represented Elevations (Click to highlight)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPallet.elevations.map((elev, idx) => {
                          const isFilterActive =
                            selectedElevationFilter === elev
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() =>
                                setSelectedElevationFilter(
                                  isFilterActive ? null : elev,
                                )
                              }
                              className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                                isFilterActive
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {elev}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Warnings and Overrides Section */}
                    {selectedPallet.warnings.length > 0 && (
                      <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          Warnings &amp; Constraints
                        </span>
                        <div className="space-y-1.5">
                          {selectedPallet.warnings.map((w, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs text-amber-800"
                            >
                              <span>• {w.message}</span>
                              {canManage && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedWarning({
                                      palletPlanPalletId: selectedPallet.id,
                                      warning: w,
                                    })
                                    setIsOverrideModalOpen(true)
                                  }}
                                  className="h-6 text-[10px] text-amber-900 hover:bg-amber-100"
                                >
                                  Override
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Stacked Panels Table */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          Panel Stack Order (Bottom &rarr; Top)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {selectedPallet.items.length} Mark Entries
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-md border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                            <tr>
                              <th className="p-2">#</th>
                              <th className="p-2">Mark</th>
                              <th className="p-2">Elevation</th>
                              <th className="p-2">Material / Color</th>
                              <th className="p-2">Size</th>
                              <th className="p-2 text-right">Qty</th>
                              <th className="p-2 text-right">Weight</th>
                              <th className="p-2 text-center">Trace</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {selectedPallet.items.map((item, idx) => {
                              const isHighlighted =
                                !selectedElevationFilter ||
                                selectedElevationFilter === item.elevation

                              return (
                                <tr
                                  key={idx}
                                  className={`transition-colors ${
                                    isHighlighted
                                      ? 'bg-white'
                                      : 'bg-slate-50 opacity-30'
                                  }`}
                                >
                                  <td className="p-2 font-mono text-[10px] text-slate-400">
                                    {item.sequence}
                                  </td>
                                  <td className="p-2 font-mono font-bold text-blue-700">
                                    {item.mark}
                                  </td>
                                  <td className="p-2 font-semibold text-slate-700">
                                    {item.elevation}
                                  </td>
                                  <td className="p-2 text-slate-600">
                                    {item.materialFamily}{' '}
                                    {item.color && (
                                      <span className="text-[10px] text-slate-400">
                                        ({item.color})
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2 font-mono text-slate-600">
                                    {`${item.widthInches}" × ${item.lengthInches}"`}
                                  </td>
                                  <td className="p-2 text-right font-bold text-slate-900">
                                    {item.quantity}
                                  </td>
                                  <td className="p-2 text-right font-mono text-slate-600">
                                    {item.totalWeightLbs} lb
                                  </td>
                                  <td className="p-2 text-center">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        setInspectingItem({
                                          mark: item.mark,
                                          elevation: item.elevation,
                                          materialFamily: item.materialFamily,
                                          dimensions: `${item.widthInches}" × ${item.lengthInches}"`,
                                          sourceProvenance:
                                            item.sourceProvenance,
                                        })
                                      }
                                      className="h-6 w-6 p-0 text-slate-400 hover:text-blue-600"
                                      title="Inspect document source provenance"
                                    >
                                      <FileSearch className="h-3.5 w-3.5" />
                                    </Button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-xs text-slate-400">
                  Select a pallet to inspect details
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Document Traceability Inspector Modal */}
      <Dialog
        open={!!inspectingItem}
        onOpenChange={() => setInspectingItem(null)}
      >
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-900">
              <FileSearch className="h-4 w-4 text-blue-600" />
              Document Provenance Inspector
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Extraction lineage for panel mark {inspectingItem?.mark}
            </DialogDescription>
          </DialogHeader>

          {inspectingItem && (
            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1.5 rounded-md border border-slate-100 bg-slate-50 p-3">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">
                    Panel Mark:
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {inspectingItem.mark}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">
                    Assigned Elevation:
                  </span>
                  <span className="font-semibold text-blue-700">
                    {inspectingItem.elevation}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">
                    Material / Size:
                  </span>
                  <span className="text-slate-700">
                    {inspectingItem.materialFamily} ({inspectingItem.dimensions}
                    )
                  </span>
                </div>
              </div>

              <div className="space-y-2 rounded-md border border-blue-100 bg-blue-50/50 p-3">
                <span className="block text-[11px] font-bold text-blue-900">
                  Why does the system associate this panel with{' '}
                  {inspectingItem.elevation}?
                </span>
                <div className="space-y-1 text-[11px] text-slate-600">
                  <div>
                    <span className="text-slate-400">Document Type:</span>{' '}
                    <span className="font-semibold">
                      {inspectingItem.sourceProvenance?.documentType ||
                        'Shop Drawings / Elevation Matrix'}
                    </span>
                  </div>
                  {inspectingItem.sourceProvenance?.documentName && (
                    <div>
                      <span className="text-slate-400">Source File:</span>{' '}
                      <span className="font-mono font-semibold">
                        {inspectingItem.sourceProvenance.documentName}
                      </span>
                    </div>
                  )}
                  {inspectingItem.sourceProvenance?.page && (
                    <div>
                      <span className="text-slate-400">
                        Drawing Sheet / Page:
                      </span>{' '}
                      <span className="font-semibold">
                        Page {inspectingItem.sourceProvenance.page}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400">
                      Extraction Confidence:
                    </span>{' '}
                    <span className="font-semibold text-emerald-700">
                      {(
                        (inspectingItem.sourceProvenance?.confidence ?? 0.95) *
                        100
                      ).toFixed(0)}
                      %
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              size="sm"
              onClick={() => setInspectingItem(null)}
              className="bg-slate-900 text-xs font-semibold text-white"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning Override Modal */}
      <Dialog open={isOverrideModalOpen} onOpenChange={setIsOverrideModalOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-900">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Override Pallet Warning
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Provide an authorized justification note to override constraint
              warning.
            </DialogDescription>
          </DialogHeader>

          {selectedWarning && (
            <form
              onSubmit={handleOverrideWarning}
              className="space-y-4 text-xs"
            >
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <span className="font-bold">Warning:</span>{' '}
                {selectedWarning.warning.message}
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">
                  Justification Reason (Mandatory, min 5 chars)
                </label>
                <Input
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g., Authorized oversized crate height by plant manager"
                  className="text-xs"
                  required
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={overrideReason.trim().length < 5}
                  className="bg-amber-600 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  Confirm Override
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
