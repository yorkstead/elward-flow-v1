'use client'

import * as React from 'react'
import {
  Scan,
  Camera,
  Keyboard,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
  RefreshCw,
  MapPin,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  type ResolveScanResult,
  type PermittedAction,
  type MovementCondition,
} from '@/lib/services/scanner'
import { OfflineScanQueue } from '@/lib/scanner/offline-queue'
import {
  MovementLedgerView,
  type MovementLedgerItem,
} from './movement-ledger-view'

interface WorkstationItem {
  id: string
  name: string
  code: string
  department: string
}

interface ScanStationProps {
  workstations: WorkstationItem[]
  initialMovements: MovementLedgerItem[]
  userRoles: string[]
  userName: string
}

export function ScanStation({
  workstations,
  initialMovements,
  userRoles,
}: ScanStationProps) {
  // State
  const [activeStationId, setActiveStationId] = React.useState<string>(
    workstations[0]?.id || '',
  )
  const [manualCode, setManualCode] = React.useState('')
  const [scanning, setScanning] = React.useState(false)
  const [cameraActive, setCameraActive] = React.useState(false)
  const [isOnline, setIsOnline] = React.useState(true)
  const [queuedCount, setQueuedCount] = React.useState(
    () =>
      OfflineScanQueue.getQueue().filter((i) => i.status === 'pending').length,
  )
  const [recentMovements, setRecentMovements] =
    React.useState<MovementLedgerItem[]>(initialMovements)

  // Scan Result State
  const [scanResult, setScanResult] = React.useState<ResolveScanResult | null>(
    null,
  )
  const [scanError, setScanError] = React.useState<string | null>(null)
  const [lastActionSuccess, setLastActionSuccess] = React.useState<
    string | null
  >(null)

  // Action Dialog State
  const [selectedAction, setSelectedAction] =
    React.useState<PermittedAction | null>(null)
  const [actionQuantity, setActionQuantity] = React.useState(1)
  const [actionCondition, setActionCondition] =
    React.useState<MovementCondition>('pass')
  const [actionReason, setActionReason] = React.useState('')
  const [actionNotes, setActionNotes] = React.useState('')
  const [submittingMovement, setSubmittingMovement] = React.useState(false)

  // Blocking Warning Modal for Obsolete Revisions
  const [blockingModalOpen, setBlockingModalOpen] = React.useState(false)

  // Workstation lookup
  const currentStation = workstations.find((w) => w.id === activeStationId)

  // Resolve Scanned Code
  const handleResolveScan = React.useCallback(
    async (codeToScan: string) => {
      if (!codeToScan.trim()) return

      setScanning(true)
      setScanError(null)
      setLastActionSuccess(null)

      try {
        // Offline fallback resolution or direct API call
        const res = await fetch('/api/scanner/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: codeToScan.trim(),
            workstationId: activeStationId,
          }),
        })

        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Scan resolution failed')

        const result: ResolveScanResult = json.result
        setScanResult(result)

        if (!result.found) {
          setScanError(`No record found matching identifier: "${codeToScan}"`)
          return
        }

        // Check for Blocking Obsolete Revision Warning
        if (result.isSuperseded && result.blockingWarning) {
          setBlockingModalOpen(true)
          return
        }

        // If permitted actions exist and top one is recommended, prepare default action
        if (result.permittedActions.length > 0) {
          const top =
            result.permittedActions.find((a) => a.recommended) ||
            result.permittedActions[0]
          setSelectedAction(top)
          setActionQuantity(
            result.entity?.remainingQuantity &&
              result.entity.remainingQuantity > 0
              ? Math.min(result.entity.remainingQuantity, 1)
              : 1,
          )
          setActionCondition(top.conditionRequired || 'pass')
          setActionReason('')
          setActionNotes('')
        }
      } catch (err) {
        setScanError(err instanceof Error ? err.message : 'Scan error')
      } finally {
        setScanning(false)
        setManualCode('')
      }
    },
    [activeStationId],
  )

  // Online / Offline Listeners
  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      void OfflineScanQueue.flush()
    }
    const handleOffline = () => setIsOnline(false)
    const handleQueueUpdate = () => {
      setQueuedCount(
        OfflineScanQueue.getQueue().filter((i) => i.status === 'pending')
          .length,
      )
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('ef:queue-updated', handleQueueUpdate)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('ef:queue-updated', handleQueueUpdate)
    }
  }, [])

  // Keyboard Wedge Listener (captures rapid keystrokes ending with Enter)
  React.useEffect(() => {
    let buffer = ''
    let lastKeyTime = Date.now()

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is intentionally typing into a form input/textarea
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      const now = Date.now()
      if (now - lastKeyTime > 150) {
        buffer = '' // Reset buffer if typing was slow (human typing vs hardware scanner)
      }
      lastKeyTime = now

      if (e.key === 'Enter') {
        if (buffer.trim().length > 1) {
          e.preventDefault()
          void handleResolveScan(buffer.trim())
          buffer = ''
        }
      } else if (e.key.length === 1) {
        buffer += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleResolveScan])

  // Execute Movement Mutation (Idempotent)
  const handleConfirmMovement = async () => {
    if (!scanResult?.entity || !selectedAction) return

    // Require reason for scrap, hold, rework
    if (
      (actionCondition === 'scrap' ||
        actionCondition === 'hold' ||
        actionCondition === 'rework' ||
        actionCondition === 'remake') &&
      !actionReason.trim()
    ) {
      setScanError(
        `A non-empty reason is mandatory when recording ${actionCondition.toUpperCase()} status.`,
      )
      return
    }

    setSubmittingMovement(true)
    setScanError(null)

    const idempotencyKey = `scan-${scanResult.entity.id}-${selectedAction.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    const payload = {
      idempotencyKey,
      recordType: scanResult.recordType,
      recordId: scanResult.entity.id,
      recordIdentifier: scanResult.entity.identifier,
      operationInstanceId: scanResult.entity.activeOperationInstanceId,
      actionId: selectedAction.id,
      sourceStatus: scanResult.entity.status,
      destinationStatus: selectedAction.targetStatus,
      quantity: actionQuantity,
      unit: 'EA',
      condition: actionCondition,
      reason: actionReason.trim() || undefined,
      notes: actionNotes.trim() || undefined,
      workstationId: activeStationId || undefined,
      clientTimestamp: new Date().toISOString(),
    }

    try {
      if (!navigator.onLine) {
        // Enqueue offline action
        OfflineScanQueue.enqueue(payload)
        setLastActionSuccess(
          `QUEUED OFFLINE: ${actionQuantity} pcs of ${scanResult.entity.identifier} (${selectedAction.label}). Will sync when reconnected.`,
        )
        setSelectedAction(null)
        setScanResult(null)
        return
      }

      const res = await fetch('/api/scanner/movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Movement execution failed')

      setLastActionSuccess(
        `SUCCESS: Recorded ${actionQuantity} pcs of ${scanResult.entity.identifier} -> ${selectedAction.targetStatus} (${actionCondition.toUpperCase()}). Ready for next scan.`,
      )

      // Add to local movement ledger
      const newLedgerItem: MovementLedgerItem = {
        id: json.result?.movementId || idempotencyKey,
        recordType: scanResult.recordType,
        recordIdentifier: scanResult.entity.identifier,
        sourceStatus: scanResult.entity.status,
        destinationStatus: selectedAction.targetStatus,
        quantity: String(actionQuantity),
        unit: 'EA',
        condition: actionCondition,
        reason: actionReason.trim() || null,
        notes: actionNotes.trim() || null,
        actorName: userRoles[0] || 'Operator',
        actingRole: userRoles[0] || 'Operator',
        workstationName: currentStation?.name || 'Scan Station',
        timestamp: new Date().toISOString(),
      }

      setRecentMovements((prev) => [newLedgerItem, ...prev])
      setSelectedAction(null)
      setScanResult(null)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Movement failed')
    } finally {
      setSubmittingMovement(false)
    }
  }

  // Flush Offline Queue
  const handleFlushQueue = async () => {
    setScanning(true)
    const { succeeded, failed } = await OfflineScanQueue.flush()
    setScanning(false)
    setQueuedCount(
      OfflineScanQueue.getQueue().filter((i) => i.status === 'pending').length,
    )
    if (succeeded > 0) {
      setLastActionSuccess(
        `Synchronized ${succeeded} offline movements successfully.`,
      )
    }
    if (failed > 0) {
      setScanError(
        `${failed} offline items require manual resolution. Check queue.`,
      )
    }
  }

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* Top Station Bar: Workstation Binding & Network State */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
            <Scan className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-slate-950">
                Shop Floor Scan Station
              </h1>
              {isOnline ? (
                <Badge className="border-emerald-200 bg-emerald-50 text-[10px] font-bold text-emerald-800">
                  <Wifi className="mr-1 h-3 w-3 text-emerald-600" /> ONLINE
                </Badge>
              ) : (
                <Badge className="border-amber-200 bg-amber-50 text-[10px] font-bold text-amber-800">
                  <WifiOff className="mr-1 h-3 w-3 text-amber-600" /> OFFLINE
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Hardware wedge listener active • Instant 2-3 tap execution
            </p>
          </div>
        </div>

        {/* Workstation Selector & Offline Sync CTA */}
        <div className="flex flex-wrap items-center gap-2">
          {queuedCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleFlushQueue}
              className="border-amber-300 bg-amber-50 text-xs font-bold text-amber-900 hover:bg-amber-100"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin text-amber-700" />
              Sync {queuedCount} Queued Actions
            </Button>
          )}

          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-slate-400" />
            <Select
              value={activeStationId}
              onValueChange={(val) => {
                if (val) setActiveStationId(val)
              }}
            >
              <SelectTrigger
                aria-label="Select active workstation"
                className="h-9 w-52 text-xs font-semibold"
              >
                <SelectValue placeholder="Select Workstation" />
              </SelectTrigger>
              <SelectContent>
                {workstations.map((st) => (
                  <SelectItem key={st.id} value={st.id}>
                    {st.name} ({st.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Main Scan Input & Camera Viewfinder Section */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Hardware & Manual Input Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-bold tracking-wider text-slate-700 uppercase">
                  Barcode / QR Scanner Input
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCameraActive(!cameraActive)}
                className={`h-7 px-2.5 text-xs font-semibold ${
                  cameraActive
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'text-slate-600'
                }`}
              >
                <Camera className="mr-1.5 h-3.5 w-3.5" />
                {cameraActive ? 'Close Camera' : 'Use Device Camera'}
              </Button>
            </div>

            {/* Camera Viewfinder (Simulated/Active) */}
            {cameraActive && (
              <div className="relative my-4 flex h-48 flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-400 bg-slate-950 text-white">
                <div className="absolute inset-x-8 top-1/2 h-0.5 animate-pulse bg-red-500 shadow-md" />
                <Camera className="mb-2 h-8 w-8 text-slate-400" />
                <p className="text-xs font-semibold text-slate-300">
                  Align Barcode / QR Code within the guide
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Auto-detect active
                </p>
              </div>
            )}

            {/* Manual Code Entry Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleResolveScan(manualCode)
              }}
              className="mt-4 flex gap-2"
            >
              <div className="relative flex-1">
                <Input
                  placeholder="Scan barcode, enter mark (e.g. P-101) or release (e.g. 54120-1)..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="h-12 pl-4 text-sm font-semibold tracking-wide"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                disabled={scanning || !manualCode.trim()}
                className="h-12 bg-blue-600 px-6 text-sm font-bold text-white shadow-xs hover:bg-blue-700"
              >
                {scanning ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Scan className="mr-2 h-4 w-4" />
                )}
                Resolve Code
              </Button>
            </form>

            {/* Sample Test Barcodes for Fast Verification */}
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-700 uppercase">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                <span>Quick Test Barcodes</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { label: 'Mark P-101 (Current)', code: 'P-101' },
                  { label: 'Mark P-102 (Hold Test)', code: 'P-102' },
                  { label: 'Mark P-103 (Scrap Test)', code: 'P-103' },
                  { label: 'Release 54120-1', code: '54120-1' },
                  {
                    label: '⚠️ Obsolete Rev Barcode',
                    code: 'EF:MARK:54120-1:P-101:REV-OLD',
                  },
                ].map((tc) => (
                  <button
                    key={tc.code}
                    type="button"
                    onClick={() => {
                      setManualCode(tc.code)
                      void handleResolveScan(tc.code)
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800"
                  >
                    {tc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Large Feedback Banners */}
          {lastActionSuccess && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 shadow-2xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <span>{lastActionSuccess}</span>
              </div>
            </div>
          )}

          {scanError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-900 shadow-2xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
                <span>{scanError}</span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* Active Scanned Record Details Card */}
          {/* ========================================================================= */}
          {scanResult?.found &&
            scanResult.entity &&
            !scanResult.isSuperseded && (
              <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-5 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-blue-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-slate-950">
                        {scanResult.entity.title}
                      </span>
                      <Badge className="border-blue-300 bg-blue-100 text-xs font-bold text-blue-900">
                        Current Rev {scanResult.entity.revisionLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600">
                      {scanResult.entity.subtitle}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold tracking-wider text-slate-700 uppercase">
                      Current Stage
                    </div>
                    <Badge className="bg-slate-900 text-xs font-bold text-white">
                      {scanResult.entity.currentStage} (
                      {scanResult.entity.status})
                    </Badge>
                  </div>
                </div>

                {/* Physical Attributes Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <div className="text-xs font-bold text-slate-600 uppercase">
                      Total Quantity
                    </div>
                    <div className="mt-0.5 text-base font-black text-slate-900">
                      {scanResult.entity.totalQuantity} pcs
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <div className="text-xs font-bold text-slate-600 uppercase">
                      Completed Qty
                    </div>
                    <div className="mt-0.5 text-base font-black text-emerald-700">
                      {scanResult.entity.completedQuantity} pcs
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <div className="text-xs font-bold text-slate-600 uppercase">
                      Remaining
                    </div>
                    <div className="mt-0.5 text-base font-black text-blue-700">
                      {scanResult.entity.remainingQuantity} pcs
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <div className="text-xs font-bold text-slate-600 uppercase">
                      Material / Dims
                    </div>
                    <div className="mt-0.5 font-bold text-slate-800">
                      {scanResult.entity.materialFamily} (
                      {scanResult.entity.dimensions || 'Standard'})
                    </div>
                  </div>
                </div>

                {/* Permitted 2-3 Tap Action Buttons */}
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold tracking-wider text-slate-700 uppercase">
                    Permitted Shop Actions (Tap to Execute)
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {scanResult.permittedActions.map((action) => (
                      <Button
                        key={action.id}
                        type="button"
                        size="lg"
                        onClick={() => {
                          setSelectedAction(action)
                          setActionCondition(action.conditionRequired || 'pass')
                        }}
                        className={`h-auto flex-col items-start justify-center p-3 text-left shadow-2xs ${
                          selectedAction?.id === action.id
                            ? 'border-2 border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
                            : 'border border-slate-200 bg-white text-slate-900 hover:border-blue-400 hover:bg-blue-50/50'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-sm font-bold">
                            {action.label}
                          </span>
                          {action.recommended && (
                            <Badge className="bg-emerald-700 text-[10px] font-bold text-white">
                              Recommended
                            </Badge>
                          )}
                        </div>
                        <span
                          className={`mt-1 text-[11px] ${
                            selectedAction?.id === action.id
                              ? 'font-medium text-white'
                              : 'text-slate-500'
                          }`}
                        >
                          {action.description}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Movement Execution Form (2nd/3rd Tap) */}
                {selectedAction && (
                  <div className="mt-4 space-y-3 rounded-xl border border-blue-300 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-800 uppercase">
                        Step 2: Confirm Movement — {selectedAction.label}
                      </span>
                      <Badge className="bg-blue-100 text-xs text-blue-800">
                        Target: {selectedAction.targetStatus}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-bold text-slate-700">
                          Quantity *
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setActionQuantity(Math.max(1, actionQuantity - 1))
                            }
                            className="h-9 w-9 text-base font-bold"
                          >
                            -
                          </Button>
                          <Input
                            aria-label="Quantity to move"
                            type="number"
                            min={1}
                            max={scanResult.entity.remainingQuantity || 100}
                            value={actionQuantity}
                            onChange={(e) =>
                              setActionQuantity(
                                parseInt(e.target.value, 10) || 1,
                              )
                            }
                            className="h-9 text-center text-base font-bold"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setActionQuantity(actionQuantity + 1)
                            }
                            className="h-9 w-9 text-base font-bold"
                          >
                            +
                          </Button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700">
                          Condition Quality *
                        </label>
                        <Select
                          value={actionCondition}
                          onValueChange={(val) => {
                            if (val)
                              setActionCondition(val as MovementCondition)
                          }}
                        >
                          <SelectTrigger
                            aria-label="Condition Quality"
                            className="mt-1 h-9 text-xs font-semibold"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pass">Pass (Good)</SelectItem>
                            <SelectItem value="pass_with_note">
                              Pass with Note
                            </SelectItem>
                            <SelectItem value="hold">
                              Hold (Engineering)
                            </SelectItem>
                            <SelectItem value="rework">Rework</SelectItem>
                            <SelectItem value="scrap">
                              Scrap / Defect
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Non-empty reason required for exceptions */}
                    {(actionCondition === 'scrap' ||
                      actionCondition === 'hold' ||
                      actionCondition === 'rework' ||
                      selectedAction.requiresReason) && (
                      <div>
                        <label className="text-xs font-bold text-red-700">
                          Mandatory Reason / Defect Rationale *
                        </label>
                        <Input
                          placeholder="State reason for hold/scrap/rework..."
                          value={actionReason}
                          onChange={(e) => setActionReason(e.target.value)}
                          className="mt-1 h-9 border-red-300 bg-red-50/30 text-xs"
                          required
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Optional Operator Notes
                      </label>
                      <Input
                        placeholder="Notes for next workstation..."
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        className="mt-1 h-9 text-xs"
                      />
                    </div>

                    <div className="flex justify-end gap-2 border-t border-slate-100 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedAction(null)}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={submittingMovement}
                        onClick={handleConfirmMovement}
                        className="bg-emerald-700 px-5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800"
                      >
                        {submittingMovement ? (
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Confirm Movement ({actionQuantity} pcs)
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>

        {/* Right Column: Station Status & Recent Scan Activity */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <h2 className="text-xs font-bold tracking-wider text-slate-700 uppercase">
              Active Station Status
            </h2>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Workstation</span>
                <span className="font-bold text-slate-900">
                  {currentStation?.name || 'Unassigned'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Department</span>
                <span className="font-bold text-slate-900">
                  {currentStation?.department || 'General'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Network Mode</span>
                <span className="font-bold text-slate-900">
                  {isOnline ? 'Direct Real-Time' : 'Local IndexedDB Queue'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pending Actions</span>
                <span className="font-mono font-bold text-blue-700">
                  {queuedCount} queued
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Full Movement Ledger & Traceability */}
      {/* ========================================================================= */}
      <MovementLedgerView initialMovements={recentMovements} />

      {/* ========================================================================= */}
      {/* BLOCKING WARNING MODAL: Obsolete Revision Scanned */}
      {/* ========================================================================= */}
      <Dialog open={blockingModalOpen} onOpenChange={setBlockingModalOpen}>
        <DialogContent className="border-2 border-red-500 bg-red-50 sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="h-6 w-6" />
              <DialogTitle className="text-base font-black text-red-950">
                SUPERSEDED REVISION DETECTED
              </DialogTitle>
            </div>
            <DialogDescription className="mt-2 text-xs font-medium text-red-900">
              {scanResult?.blockingWarning?.message}
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 space-y-1.5 rounded-lg border border-red-200 bg-white p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Scanned Revision:</span>
              <span className="font-bold text-red-700">
                Rev {scanResult?.blockingWarning?.scannedRevisionLabel}{' '}
                (SUPERSEDED)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Active Current Revision:</span>
              <span className="font-bold text-emerald-700">
                Rev {scanResult?.blockingWarning?.currentRevisionLabel}{' '}
                (APPROVED)
              </span>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setBlockingModalOpen(false)
                setScanResult(null)
              }}
              className="text-xs"
            >
              Dismiss
            </Button>
            {scanResult?.blockingWarning?.directUrl && (
              <a href={scanResult.blockingWarning.directUrl}>
                <Button
                  size="sm"
                  className="bg-red-700 text-xs font-bold text-white hover:bg-red-800"
                >
                  Open Current Revision{' '}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </a>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
