'use client'

import * as React from 'react'
import {
  AlertOctagon,
  Search,
  CheckCircle2,
  Lock,
  Unlock,
  Clock,
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
  QualityIssueItem,
  QualityDisposition,
} from '@/lib/services/quality'

interface QualityIssuesBoardProps {
  initialIssues: QualityIssueItem[]
  onHoldReleased?: () => void
}

export function QualityIssuesBoard({
  initialIssues,
  onHoldReleased,
}: QualityIssuesBoardProps) {
  const [issues, setIssues] = React.useState<QualityIssueItem[]>(initialIssues)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('open')
  const [severityFilter, setSeverityFilter] = React.useState('all')

  // Hold Release Modal State
  const [releaseModalOpen, setReleaseModalOpen] = React.useState(false)
  const [selectedIssue, setSelectedIssue] =
    React.useState<QualityIssueItem | null>(null)
  const [releaseReason, setReleaseReason] = React.useState('')
  const [releaseDisposition, setReleaseDisposition] =
    React.useState<QualityDisposition>('Pass with Note')
  const [releasing, setReleasing] = React.useState(false)

  const filtered = issues.filter((item) => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'open' && item.status === 'Resolved') return false
      if (statusFilter === 'resolved' && item.status !== 'Resolved')
        return false
    }
    if (severityFilter !== 'all') {
      if (item.severity.toLowerCase() !== severityFilter.toLowerCase()) {
        return false
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matches =
        item.issueNumber.toLowerCase().includes(q) ||
        item.markCode.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.suspectedCause
          ? item.suspectedCause.toLowerCase().includes(q)
          : false)
      if (!matches) return false
    }
    return true
  })

  const openReleaseDialog = (issue: QualityIssueItem) => {
    setSelectedIssue(issue)
    setReleaseReason('')
    setReleaseDisposition('Pass with Note')
    setReleaseModalOpen(true)
  }

  const handleExecuteReleaseHold = async () => {
    if (!selectedIssue || !releaseReason.trim()) return

    setReleasing(true)
    try {
      const res = await fetch('/api/quality/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: selectedIssue.id,
          releaseReason: releaseReason.trim(),
          disposition: releaseDisposition,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to release hold')
      }

      setIssues((prev) =>
        prev.map((i) =>
          i.id === selectedIssue.id
            ? {
                ...i,
                status: 'Resolved',
                resolutionNotes: releaseReason.trim(),
                verifiedByName: 'Quality Supervisor',
                verifiedAt: new Date().toLocaleString('en-US', {
                  timeZone: 'America/Denver',
                }),
              }
            : i,
        ),
      )

      setReleaseModalOpen(false)
      onHoldReleased?.()
    } catch (err) {
      console.error(err)
    } finally {
      setReleasing(false)
    }
  }

  const renderSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'Blocking':
      case 'Critical':
        return (
          <Badge className="bg-red-100 text-xs font-bold text-red-800">
            {sev}
          </Badge>
        )
      case 'Moderate':
        return (
          <Badge className="bg-amber-100 text-xs font-bold text-amber-800">
            {sev}
          </Badge>
        )
      default:
        return (
          <Badge className="bg-blue-100 text-xs font-bold text-blue-800">
            {sev}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <AlertOctagon className="h-5 w-5 text-amber-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Non-Conformance Issues & Quality Holds
            </h2>
            <p className="text-xs text-slate-500">
              Manage shop floor quality holds, root causes, containment, and
              auditable supervisor releases
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48 sm:w-60">
            <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search issue, mark, cause..."
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
              aria-label="Status Filter"
              className="h-8 w-32 text-xs font-semibold"
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Active Holds</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={severityFilter}
            onValueChange={(val) => {
              if (val) setSeverityFilter(val)
            }}
          >
            <SelectTrigger
              aria-label="Severity Filter"
              className="h-8 w-32 text-xs font-semibold"
            >
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical / Blocking</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="minor">Minor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
          No quality issues matching filters. All quality holds cleared.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="font-bold">Issue / Mark</TableHead>
                <TableHead className="font-bold">Category & Severity</TableHead>
                <TableHead className="font-bold">
                  Suspected Root Cause
                </TableHead>
                <TableHead className="font-bold">Responsible & Owner</TableHead>
                <TableHead className="text-center font-bold">Aging</TableHead>
                <TableHead className="font-bold">
                  Status & Disposition
                </TableHead>
                <TableHead className="text-right font-bold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id} className="text-xs">
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-950">
                        {item.issueNumber}
                      </span>
                    </div>
                    <div className="mt-0.5 font-bold text-blue-900">
                      Mark: {item.markCode} ({item.releaseKey})
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-900">
                      {item.category}
                    </div>
                    <div className="mt-0.5">
                      {renderSeverityBadge(item.severity)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-[11px] text-slate-800">
                      {item.suspectedCause || 'Under investigation'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Point: {item.detectionPoint}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-900">
                      {item.responsibleDepartment}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Owner: {item.ownerName}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono font-semibold text-amber-800">
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      {item.agingDays}d
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.status === 'Resolved' ? (
                      <Badge className="bg-emerald-100 text-xs font-bold text-emerald-800">
                        Resolved
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-xs font-bold text-red-800">
                        <Lock className="mr-1 h-3 w-3" />
                        Hold Blocking
                      </Badge>
                    )}
                    <div className="mt-0.5 text-[10px] text-slate-500">
                      {item.affectedQuantity} unit(s) held
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.status !== 'Resolved' ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openReleaseDialog(item)}
                        className="h-7 bg-amber-600 px-3 text-xs font-bold text-white shadow-2xs hover:bg-amber-700"
                      >
                        <Unlock className="mr-1 h-3 w-3" />
                        Release Hold
                      </Button>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-700">
                        Cleared by {item.verifiedByName}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Release Hold Modal */}
      <Dialog open={releaseModalOpen} onOpenChange={setReleaseModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-950">
              Release Quality Hold — {selectedIssue?.issueNumber}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Authorized release of held mark {selectedIssue?.markCode}. A
              mandatory supervisor audit reason is required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
              <div className="font-bold">
                Mark: {selectedIssue?.markCode} • Defect:{' '}
                {selectedIssue?.category}
              </div>
              <div className="mt-1 text-amber-800">
                Suspected Cause: {selectedIssue?.suspectedCause}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                Post-Hold Disposition *
              </label>
              <Select
                value={releaseDisposition}
                onValueChange={(val) => {
                  if (val) setReleaseDisposition(val as QualityDisposition)
                }}
              >
                <SelectTrigger
                  aria-label="Post-Hold Disposition"
                  className="mt-1 h-9 text-xs font-bold"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pass with Note">
                    Pass with Note (Deviation authorized by supervisor)
                  </SelectItem>
                  <SelectItem value="Pass">
                    Pass (Rework verified complete)
                  </SelectItem>
                  <SelectItem value="Rework">
                    Rework (Return to upstream station)
                  </SelectItem>
                  <SelectItem value="Remake">
                    Remake (Generate replacement RMK/RME)
                  </SelectItem>
                  <SelectItem value="Scrap">
                    Scrap (Non-conforming write-off)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                Mandatory Release Reason / Supervisor Sign-Off *
              </label>
              <Input
                placeholder="e.g. Flange deburred and polished; dimensions verified within ±0.015 tolerance"
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                className="mt-1 h-9 text-xs"
                required
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReleaseModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={releasing || !releaseReason.trim()}
              onClick={handleExecuteReleaseHold}
              className="bg-amber-600 text-xs font-bold text-white shadow-xs hover:bg-amber-700"
            >
              {releasing ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Confirm Release & Log Audit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
