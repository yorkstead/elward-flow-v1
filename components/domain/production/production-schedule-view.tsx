'use client'

import * as React from 'react'
import {
  Calendar,
  Download,
  Printer,
  Search,
  CheckCircle2,
  MapPin,
  Sparkles,
  LayoutGrid,
  Table as TableIcon,
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
import { DepartmentCapacityBoard } from './department-capacity-board'
import { DowntimeTracker, type DowntimeEventItem } from './downtime-tracker'
import { PrintableQueueDialog } from './printable-queue-dialog'
import { CncConsole } from './cnc-console'
import { AssemblyConsole } from './assembly-console'
import type {
  DepartmentCapacityMetric,
  ProductionQueueItem,
  ProductionPriority,
} from '@/lib/services/production'

interface WorkstationOption {
  id: string
  name: string
  code: string
  department: string
}

interface ProductionScheduleViewProps {
  initialCapacity: DepartmentCapacityMetric[]
  initialQueue: ProductionQueueItem[]
  initialDowntimes: DowntimeEventItem[]
  workstations: WorkstationOption[]
}

export function ProductionScheduleView({
  initialCapacity,
  initialQueue,
  initialDowntimes,
  workstations,
}: ProductionScheduleViewProps) {
  // Navigation & Filtering
  const [activeDepartment, setActiveDepartment] = React.useState<string>('all')
  const [activeTabMode, setActiveTabMode] = React.useState<
    'schedule' | 'console'
  >('schedule')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [priorityFilter, setPriorityFilter] = React.useState('all')

  // Queue State
  const [queueItems, setQueueItems] =
    React.useState<ProductionQueueItem[]>(initialQueue)
  const [printModalOpen, setPrintModalOpen] = React.useState(false)

  // Reassignment Modal
  const [reassignModalOpen, setReassignModalOpen] = React.useState(false)
  const [selectedItem, setSelectedItem] =
    React.useState<ProductionQueueItem | null>(null)
  const [targetStationId, setTargetStationId] = React.useState('')
  const [targetPriority, setTargetPriority] =
    React.useState<ProductionPriority>('Standard')
  const [targetTeam, setTargetTeam] = React.useState('')
  const [savingReassign, setSavingReassign] = React.useState(false)

  // Filter items
  const filteredItems = queueItems.filter((item) => {
    if (activeDepartment !== 'all') {
      if (item.department.toLowerCase() !== activeDepartment.toLowerCase()) {
        return false
      }
    }
    if (statusFilter !== 'all') {
      if (item.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false
      }
    }
    if (priorityFilter !== 'all') {
      if (item.priority.toLowerCase() !== priorityFilter.toLowerCase()) {
        return false
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matches =
        item.markCode.toLowerCase().includes(q) ||
        item.jobNumber.includes(q) ||
        item.releaseKey.toLowerCase().includes(q) ||
        item.materialFamily.toLowerCase().includes(q) ||
        (item.color ? item.color.toLowerCase().includes(q) : false)
      if (!matches) return false
    }
    return true
  })

  const handleSaveReassign = async () => {
    if (!selectedItem) return
    setSavingReassign(true)
    try {
      const res = await fetch('/api/production/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationInstanceId: selectedItem.id,
          workstationId: targetStationId || null,
          assignedTeam: targetTeam.trim() || null,
          priority: targetPriority,
        }),
      })

      if (!res.ok) throw new Error('Failed to update assignment')

      const ws = workstations.find((w) => w.id === targetStationId)
      setQueueItems((prev) =>
        prev.map((i) =>
          i.id === selectedItem.id
            ? {
                ...i,
                assignedWorkstationId: targetStationId || null,
                assignedWorkstationName: ws?.name || null,
                assignedWorkstationCode: ws?.code || null,
                assignedTeam: targetTeam.trim() || null,
                priority: targetPriority,
              }
            : i,
        ),
      )
      setReassignModalOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingReassign(false)
    }
  }

  const getPriorityBadge = (priority: ProductionPriority) => {
    switch (priority) {
      case 'Remake Priority':
        return (
          <Badge className="border-red-300 bg-red-100 text-[10px] font-bold text-red-800">
            <Sparkles className="mr-1 h-3 w-3 text-red-600" /> Remake
          </Badge>
        )
      case 'Rush':
        return (
          <Badge className="border-amber-300 bg-amber-100 text-[10px] font-bold text-amber-800">
            Rush
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px] text-slate-600">
            Standard
          </Badge>
        )
    }
  }

  const getReadinessBadge = (item: ProductionQueueItem) => {
    if (!item.isCurrentRevision) {
      return (
        <Badge className="border-red-300 bg-red-50 text-[10px] text-red-800">
          Superseded
        </Badge>
      )
    }
    if (item.holdBlocked) {
      return (
        <Badge className="border-amber-300 bg-amber-50 text-[10px] text-amber-800">
          Hold Blocked
        </Badge>
      )
    }
    if (!item.predecessorReady) {
      return (
        <Badge className="border-slate-300 bg-slate-100 text-[10px] text-slate-700">
          Waiting Predecessor
        </Badge>
      )
    }
    if (item.overallReady) {
      return (
        <Badge className="border-emerald-300 bg-emerald-50 text-[10px] font-bold text-emerald-800">
          <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" /> Ready
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-[10px] text-slate-500">
        Pending
      </Badge>
    )
  }

  const handleUpdateItem = (
    updated: Partial<ProductionQueueItem> & { id: string },
  ) => {
    setQueueItems((prev) =>
      prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)),
    )
  }

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* Master Top Bar */}
      {/* ========================================================================= */}
      <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-2xs">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-foreground text-base font-black">
              Production Planning & Department Execution
            </h1>
            <p className="text-muted-foreground text-xs">
              Capacity boards, station dispatch, WinCNC routing, and contingency
              queues
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle between Master Schedule Table and Department Focused Console */}
          <div className="border-border bg-muted flex items-center rounded-lg border p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveTabMode('schedule')}
              className={`h-7 px-3 text-xs font-semibold ${
                activeTabMode === 'schedule'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TableIcon className="mr-1.5 h-3.5 w-3.5" />
              Master Schedule
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveTabMode('console')}
              className={`h-7 px-3 text-xs font-semibold ${
                activeTabMode === 'console'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
              Department Consoles
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPrintModalOpen(true)}
            className="h-8 text-xs font-bold"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print Contingency Queue
          </Button>

          <a
            href={`/api/production/export?department=${activeDepartment}`}
            download
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export CSV
            </Button>
          </a>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Department Capacity Board */}
      {/* ========================================================================= */}
      <DepartmentCapacityBoard
        metrics={initialCapacity}
        activeDepartment={activeDepartment}
        onSelectDepartment={(dept) => {
          setActiveDepartment(
            activeDepartment.toLowerCase() === dept.toLowerCase()
              ? 'all'
              : dept,
          )
        }}
      />

      {/* ========================================================================= */}
      {/* Active Shop Downtime Tracker */}
      {/* ========================================================================= */}
      <DowntimeTracker
        initialDowntimes={initialDowntimes}
        workstations={workstations}
      />

      {/* ========================================================================= */}
      {/* Main View: Schedule Table OR Department Console */}
      {/* ========================================================================= */}
      {activeTabMode === 'console' ? (
        <div className="space-y-6">
          <CncConsole
            cncItems={queueItems.filter((i) => i.department === 'CNC')}
            workstations={workstations}
            onUpdateItem={handleUpdateItem}
          />
          <AssemblyConsole
            assemblyItems={queueItems.filter(
              (i) => i.department === 'Assembly',
            )}
            workstations={workstations}
            onUpdateItem={handleUpdateItem}
          />
        </div>
      ) : (
        <div className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-xs">
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div className="flex items-center gap-2">
              <TableIcon className="text-primary h-5 w-5" />
              <div>
                <h2 className="text-foreground text-sm font-bold">
                  Active Production Queue & Station Readiness
                </h2>
                <p className="text-muted-foreground text-xs">
                  Showing {filteredItems.length} queued operation steps
                </p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-48 sm:w-60">
                <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search mark, job, material..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <Select
                value={activeDepartment}
                onValueChange={(val) => {
                  if (val) setActiveDepartment(val)
                }}
              >
                <SelectTrigger
                  aria-label="Department Filter"
                  className="h-8 w-32 text-xs font-semibold"
                >
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Depts</SelectItem>
                  <SelectItem value="CNC">CNC Routing</SelectItem>
                  <SelectItem value="ELU">ELU Extrusion</SelectItem>
                  <SelectItem value="Assembly">Assembly</SelectItem>
                  <SelectItem value="QC">QC</SelectItem>
                  <SelectItem value="Shipping">Shipping</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  if (val) setStatusFilter(val)
                }}
              >
                <SelectTrigger
                  aria-label="Status Filter"
                  className="h-8 w-28 text-xs font-semibold"
                >
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Ready">Ready</SelectItem>
                  <SelectItem value="In progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Hold">Hold</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={priorityFilter}
                onValueChange={(val) => {
                  if (val) setPriorityFilter(val)
                }}
              >
                <SelectTrigger
                  aria-label="Priority Filter"
                  className="h-8 w-28 text-xs font-semibold"
                >
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Rush">Rush</SelectItem>
                  <SelectItem value="Remake Priority">Remake</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Queue Table */}
          {filteredItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              No operation instances matching selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="font-bold">Mark / Release</TableHead>
                    <TableHead className="font-bold">
                      Department / Step
                    </TableHead>
                    <TableHead className="font-bold">Priority</TableHead>
                    <TableHead className="font-bold">Readiness State</TableHead>
                    <TableHead className="font-bold">Planned / Done</TableHead>
                    <TableHead className="font-bold">Station & Team</TableHead>
                    <TableHead className="text-right font-bold">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} className="text-xs">
                      <TableCell className="text-foreground font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-muted text-foreground rounded-md px-1.5 py-0.5 font-mono text-sm">
                            {item.markCode}
                          </span>
                          <span className="text-muted-foreground text-[11px] font-semibold">
                            {item.releaseKey}
                          </span>
                        </div>
                        <div className="text-muted-foreground mt-0.5 text-[11px]">
                          {item.materialFamily} ({item.dimensions || 'Standard'}
                          )
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-foreground font-semibold">
                          {item.operationName}
                        </div>
                        <div className="text-muted-foreground text-[11px]">
                          Seq {item.sequence} • {item.department}
                        </div>
                      </TableCell>
                      <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getReadinessBadge(item)}
                          <div className="text-muted-foreground text-[11px] font-medium">
                            {item.readinessReason}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        <span className="text-primary font-bold">
                          {item.remainingQuantity}
                        </span>
                        <span className="text-muted-foreground">
                          {' '}
                          / {item.plannedQuantity} pcs
                        </span>
                        {item.scrapQuantity > 0 && (
                          <div className="text-destructive text-[10px] font-bold">
                            {item.scrapQuantity} scrap
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="text-foreground flex items-center gap-1 font-semibold">
                            <MapPin className="text-muted-foreground h-3 w-3" />
                            <span>
                              {item.assignedWorkstationName || 'Unassigned'}
                            </span>
                          </div>
                          {item.assignedTeam && (
                            <div className="text-muted-foreground text-[11px]">
                              Team: {item.assignedTeam}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedItem(item)
                            setTargetStationId(item.assignedWorkstationId || '')
                            setTargetPriority(item.priority)
                            setTargetTeam(item.assignedTeam || '')
                            setReassignModalOpen(true)
                          }}
                          className="h-7 px-2.5 text-xs font-semibold"
                        >
                          Dispatch
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Printable Contingency Queue Dialog */}
      <PrintableQueueDialog
        open={printModalOpen}
        onOpenChange={setPrintModalOpen}
        items={filteredItems}
        department={activeDepartment}
      />

      {/* Dispatch & Reassign Modal */}
      <Dialog open={reassignModalOpen} onOpenChange={setReassignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-950">
              Dispatch & Assign — Mark {selectedItem?.markCode}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Assign workstation machine, operator team, and priority.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700">
                Workstation / Machine
              </label>
              <Select
                value={targetStationId}
                onValueChange={(val) => {
                  if (val) setTargetStationId(val)
                }}
              >
                <SelectTrigger
                  aria-label="Workstation selection"
                  className="mt-1 h-9 text-xs"
                >
                  <SelectValue placeholder="Select workstation..." />
                </SelectTrigger>
                <SelectContent>
                  {workstations
                    .filter(
                      (w) =>
                        !selectedItem ||
                        w.department.toLowerCase() ===
                          selectedItem.department.toLowerCase(),
                    )
                    .map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                Production Priority
              </label>
              <Select
                value={targetPriority}
                onValueChange={(val) => {
                  if (val) setTargetPriority(val as ProductionPriority)
                }}
              >
                <SelectTrigger
                  aria-label="Priority selection"
                  className="mt-1 h-9 text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Standard">Standard Priority</SelectItem>
                  <SelectItem value="Rush">Rush Order</SelectItem>
                  <SelectItem value="Remake Priority">
                    Remake Priority (Elevated)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                Assigned Operator Team
              </label>
              <Input
                placeholder="e.g. Team Alpha / Lead Operator"
                value={targetTeam}
                onChange={(e) => setTargetTeam(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReassignModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingReassign}
              onClick={handleSaveReassign}
              className="bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
            >
              {savingReassign ? 'Saving...' : 'Save Dispatch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
