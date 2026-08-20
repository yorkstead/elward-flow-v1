'use client'

import * as React from 'react'
import {
  AlertOctagon,
  Clock,
  CheckCircle2,
  Plus,
  RefreshCw,
  MapPin,
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
import type { DowntimeCategory } from '@/lib/services/production'

export interface DowntimeEventItem {
  id: string
  department: string
  category: string
  reason: string
  notes?: string | null
  startedAt: Date | string
  workstationName?: string | null
  workstationCode?: string | null
}

interface WorkstationOption {
  id: string
  name: string
  code: string
  department: string
}

interface DowntimeTrackerProps {
  initialDowntimes: DowntimeEventItem[]
  workstations: WorkstationOption[]
  onDowntimeChanged?: () => void
}

export function DowntimeTracker({
  initialDowntimes,
  workstations,
  onDowntimeChanged,
}: DowntimeTrackerProps) {
  const [downtimes, setDowntimes] =
    React.useState<DowntimeEventItem[]>(initialDowntimes)
  const [logModalOpen, setLogModalOpen] = React.useState(false)
  const [resolveModalOpen, setResolveModalOpen] = React.useState(false)
  const [selectedDowntime, setSelectedDowntime] =
    React.useState<DowntimeEventItem | null>(null)

  // Form State
  const [selectedStationId, setSelectedStationId] = React.useState('')
  const [department, setDepartment] = React.useState('CNC')
  const [category, setCategory] =
    React.useState<DowntimeCategory>('Machine Breakdown')
  const [reason, setReason] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [resolutionNotes, setResolutionNotes] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const handleLogDowntime = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/production/downtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workstationId: selectedStationId || undefined,
          department,
          category,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to log downtime')

      const ws = workstations.find((w) => w.id === selectedStationId)
      const newItem: DowntimeEventItem = {
        id: json.result?.downtimeId || String(Date.now()),
        department,
        category,
        reason: reason.trim(),
        notes: notes.trim() || null,
        startedAt: new Date(),
        workstationName: ws?.name || null,
        workstationCode: ws?.code || null,
      }

      setDowntimes((prev) => [newItem, ...prev])
      setLogModalOpen(false)
      setReason('')
      setNotes('')
      onDowntimeChanged?.()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResolveDowntime = async () => {
    if (!selectedDowntime) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/production/downtime', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          downtimeId: selectedDowntime.id,
          notes: resolutionNotes.trim() || undefined,
        }),
      })

      if (!res.ok) throw new Error('Failed to resolve downtime')

      setDowntimes((prev) => prev.filter((d) => d.id !== selectedDowntime.id))
      setResolveModalOpen(false)
      setSelectedDowntime(null)
      setResolutionNotes('')
      onDowntimeChanged?.()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <AlertOctagon className="h-5 w-5 text-red-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Shop Downtime & Maintenance Tracker
            </h2>
            <p className="text-xs text-slate-500">
              Active machine and tooling outages impacting production capacity
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => setLogModalOpen(true)}
          className="bg-red-700 text-xs font-bold text-white shadow-xs hover:bg-red-800"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Log Machine Downtime
        </Button>
      </div>

      {downtimes.length === 0 ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            All shop workstations and machines are currently operational with 0
            open downtime events.
          </span>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {downtimes.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50/50 p-3 text-xs"
            >
              <div className="flex items-start gap-3">
                <Badge className="border-red-300 bg-red-100 font-bold text-red-800">
                  {d.department}
                </Badge>
                <div>
                  <div className="flex items-center gap-2 font-bold text-slate-950">
                    <span>{d.category}</span>
                    {d.workstationName && (
                      <span className="flex items-center gap-1 font-normal text-slate-600">
                        <MapPin className="h-3 w-3 text-slate-500" />
                        {d.workstationName} ({d.workstationCode})
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-medium text-slate-700">
                    {d.reason}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  <span>
                    Started:{' '}
                    {new Date(d.startedAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedDowntime(d)
                    setResolveModalOpen(true)
                  }}
                  className="h-7 border-slate-300 bg-white text-xs font-bold text-slate-800 hover:bg-slate-50"
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                  Resolve Outage
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log Downtime Modal */}
      <Dialog open={logModalOpen} onOpenChange={setLogModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-950">
              Report Machine or Shop Downtime
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Log an active stoppage so downstream stations and schedule boards
              reflect capacity impact.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleLogDowntime} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Department *
                </label>
                <Select
                  value={department}
                  onValueChange={(val) => {
                    if (val) setDepartment(val)
                  }}
                >
                  <SelectTrigger
                    aria-label="Department"
                    className="mt-1 h-9 text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CNC">CNC Routing</SelectItem>
                    <SelectItem value="ELU">ELU Extrusion</SelectItem>
                    <SelectItem value="Assembly">Assembly</SelectItem>
                    <SelectItem value="QC">QC</SelectItem>
                    <SelectItem value="Shipping">Shipping</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">
                  Category *
                </label>
                <Select
                  value={category}
                  onValueChange={(val) => {
                    if (val) setCategory(val as DowntimeCategory)
                  }}
                >
                  <SelectTrigger
                    aria-label="Downtime Category"
                    className="mt-1 h-9 text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Machine Breakdown">
                      Machine Breakdown
                    </SelectItem>
                    <SelectItem value="Drawing Conflict">
                      Drawing Conflict
                    </SelectItem>
                    <SelectItem value="Material Shortage">
                      Material Shortage
                    </SelectItem>
                    <SelectItem value="Tooling Change">
                      Tooling Change
                    </SelectItem>
                    <SelectItem value="Quality Investigation">
                      Quality Investigation
                    </SelectItem>
                    <SelectItem value="Other">Other Stoppage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                Workstation / Machine (Optional)
              </label>
              <Select
                value={selectedStationId}
                onValueChange={(val) => {
                  if (val) setSelectedStationId(val)
                }}
              >
                <SelectTrigger
                  aria-label="Workstation"
                  className="mt-1 h-9 text-xs"
                >
                  <SelectValue placeholder="Select machine/station..." />
                </SelectTrigger>
                <SelectContent>
                  {workstations.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                Stoppage Reason / Defect Detail *
              </label>
              <Input
                placeholder="e.g. Spindle bearing vibration error on Table 1"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 h-9 text-xs"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">
                Corrective Notes / Maintenance ETA
              </label>
              <Input
                placeholder="e.g. Maintenance technician dispatched, 30 min ETA"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLogModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || !reason.trim()}
                className="bg-red-700 text-xs font-bold text-white hover:bg-red-800"
              >
                {submitting ? (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <AlertOctagon className="mr-1.5 h-3.5 w-3.5" />
                )}
                Log Stoppage
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Resolve Downtime Modal */}
      <Dialog open={resolveModalOpen} onOpenChange={setResolveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-950">
              Restore Workstation Operation
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Confirm machine/station is operational to resume scheduling and
              movement logging.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="font-bold text-slate-900">
                {selectedDowntime?.category}: {selectedDowntime?.reason}
              </div>
              <div className="text-slate-600">
                Station: {selectedDowntime?.workstationName || 'General'}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                Resolution Notes
              </label>
              <Input
                placeholder="e.g. Tooling replaced and recalibrated. Ready for cutting."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResolveModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submitting}
              onClick={handleResolveDowntime}
              className="bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800"
            >
              {submitting ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Confirm Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
