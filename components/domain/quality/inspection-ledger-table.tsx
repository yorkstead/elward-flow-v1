'use client'

import * as React from 'react'
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Compass,
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
  QualityInspectionItem,
  QualityDisposition,
  QualityIssueCategory,
  QualityIssueSeverity,
} from '@/lib/services/quality'

interface MarkOption {
  id: string
  mark: string
  materialFamily: string
  color: string | null
}

interface InspectionLedgerTableProps {
  initialInspections: QualityInspectionItem[]
  marks: MarkOption[]
  releaseId: string
  onInspectionAdded?: () => void
}

export function InspectionLedgerTable({
  initialInspections,
  marks,
  releaseId,
  onInspectionAdded,
}: InspectionLedgerTableProps) {
  const [inspections, setInspections] =
    React.useState<QualityInspectionItem[]>(initialInspections)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [dispositionFilter, setDispositionFilter] = React.useState('all')

  // New Inspection Modal State
  const [modalOpen, setModalOpen] = React.useState(false)
  const [selectedMarkId, setSelectedMarkId] = React.useState(marks[0]?.id || '')
  const [quantity, setQuantity] = React.useState('1')
  const [disposition, setDisposition] =
    React.useState<QualityDisposition>('Pass')
  const [specVersion] = React.useState('v1.2')
  const [width, setWidth] = React.useState('')
  const [length, setLength] = React.useState('')
  const [diagonal, setDiagonal] = React.useState('')
  const [thickness, setThickness] = React.useState('')
  const [caliperDevice] = React.useState('Mitutoyo-Digimatic-01')
  const [notes, setNotes] = React.useState('')

  // Non-conformance details (if not Pass)
  const [issueCategory, setIssueCategory] =
    React.useState<QualityIssueCategory>('Surface Defect')
  const [issueSeverity, setIssueSeverity] =
    React.useState<QualityIssueSeverity>('Moderate')
  const [suspectedCause, setSuspectedCause] = React.useState('')
  const [responsibleDept] = React.useState('Assembly')
  const [submitting, setSubmitting] = React.useState(false)

  const filtered = inspections.filter((item) => {
    if (dispositionFilter !== 'all') {
      if (item.disposition.toLowerCase() !== dispositionFilter.toLowerCase()) {
        return false
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matches =
        item.markCode.toLowerCase().includes(q) ||
        item.releaseKey.toLowerCase().includes(q) ||
        item.inspectorName.toLowerCase().includes(q) ||
        (item.notes ? item.notes.toLowerCase().includes(q) : false)
      if (!matches) return false
    }
    return true
  })

  const handleSaveInspection = async () => {
    if (!selectedMarkId || !quantity) return

    setSubmitting(true)
    try {
      const measurements = {
        width: width ? parseFloat(width) : undefined,
        length: length ? parseFloat(length) : undefined,
        diagonal: diagonal ? parseFloat(diagonal) : undefined,
        thickness: thickness ? parseFloat(thickness) : undefined,
        caliperDevice,
      }

      const res = await fetch('/api/quality/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId,
          panelMarkId: selectedMarkId,
          quantity: parseInt(quantity, 10),
          disposition,
          specificationVersion: specVersion,
          measurements,
          notes: notes.trim() || undefined,
          destination:
            disposition === 'Pass' || disposition === 'Pass with Note'
              ? 'Pallet Staging Bay'
              : 'QC Quarantine Area',
          issueCategory:
            disposition !== 'Pass' && disposition !== 'Pass with Note'
              ? issueCategory
              : undefined,
          issueSeverity:
            disposition !== 'Pass' && disposition !== 'Pass with Note'
              ? issueSeverity
              : undefined,
          suspectedCause: suspectedCause.trim() || undefined,
          responsibleDepartment: responsibleDept,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to record inspection')
      }

      const mark = marks.find((m) => m.id === selectedMarkId)
      const newItem: QualityInspectionItem = {
        id: `insp-${Date.now()}`,
        releaseId,
        releaseKey: '25036-1',
        markId: selectedMarkId,
        markCode: mark?.mark || 'P-101',
        quantity: parseInt(quantity, 10),
        inspectorName: 'Quality Inspector',
        specificationVersion: specVersion,
        measurements,
        disposition,
        notes: notes.trim() || null,
        destination: disposition === 'Pass' ? 'Pallet Staging' : 'QC Hold Bay',
        createdAt: new Date().toLocaleString('en-US', {
          timeZone: 'America/Denver',
        }),
      }

      setInspections((prev) => [newItem, ...prev])
      setModalOpen(false)
      setNotes('')
      setSuspectedCause('')
      onInspectionAdded?.()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const renderDispositionBadge = (disp: QualityDisposition) => {
    switch (disp) {
      case 'Pass':
        return (
          <Badge className="bg-emerald-100 text-xs font-bold text-emerald-800">
            Pass
          </Badge>
        )
      case 'Pass with Note':
        return (
          <Badge className="bg-blue-100 text-xs font-bold text-blue-800">
            Pass with Note
          </Badge>
        )
      case 'Hold':
        return (
          <Badge className="bg-amber-100 text-xs font-bold text-amber-800">
            Hold
          </Badge>
        )
      case 'Rework':
        return (
          <Badge className="bg-purple-100 text-xs font-bold text-purple-800">
            Rework
          </Badge>
        )
      case 'Remake':
        return (
          <Badge className="bg-orange-100 text-xs font-bold text-orange-800">
            Remake
          </Badge>
        )
      case 'Scrap':
        return (
          <Badge className="bg-red-100 text-xs font-bold text-red-800">
            Scrap
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Inspection Ledger & Caliper Measurements
            </h2>
            <p className="text-xs text-slate-500">
              Checklist specs, dimensional tolerances, and multi-disposition
              verification
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48 sm:w-60">
            <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search mark, inspector, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <Select
            value={dispositionFilter}
            onValueChange={(val) => {
              if (val) setDispositionFilter(val)
            }}
          >
            <SelectTrigger
              aria-label="Filter Disposition"
              className="h-8 w-36 text-xs font-semibold"
            >
              <SelectValue placeholder="Disposition" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dispositions</SelectItem>
              <SelectItem value="pass">Pass</SelectItem>
              <SelectItem value="pass with note">Pass with Note</SelectItem>
              <SelectItem value="hold">Hold</SelectItem>
              <SelectItem value="rework">Rework</SelectItem>
              <SelectItem value="remake">Remake</SelectItem>
              <SelectItem value="scrap">Scrap</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            size="sm"
            onClick={() => setModalOpen(true)}
            className="h-8 bg-blue-600 px-3 text-xs font-bold text-white shadow-2xs hover:bg-blue-700"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Record Inspection
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
          No quality inspections matching filter.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="font-bold">Mark / Release</TableHead>
                <TableHead className="text-center font-bold">Qty</TableHead>
                <TableHead className="font-bold">Disposition</TableHead>
                <TableHead className="font-bold">
                  Caliper Measurements
                </TableHead>
                <TableHead className="font-bold">Inspector & Spec</TableHead>
                <TableHead className="font-bold">Notes & Destination</TableHead>
                <TableHead className="text-right font-bold">
                  Timestamp
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id} className="text-xs">
                  <TableCell>
                    <div className="font-mono font-bold text-slate-950">
                      {item.markCode}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {item.releaseKey}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono font-bold text-slate-900">
                    {item.quantity}
                  </TableCell>
                  <TableCell>
                    {renderDispositionBadge(item.disposition)}
                  </TableCell>
                  <TableCell>
                    {item.measurements ? (
                      <div className="space-y-0.5 font-mono text-[11px] text-slate-700">
                        <div>
                          W: {item.measurements.width ?? '—'}&quot; × L:{' '}
                          {item.measurements.length ?? '—'}&quot;
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Diag: {item.measurements.diagonal ?? '—'}&quot; •
                          Thick: {item.measurements.thickness ?? '—'}&quot;
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">Visual check</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-900">
                      {item.inspectorName}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Spec: {item.specificationVersion}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-[11px] text-slate-800">
                      {item.notes || 'Routine checklist passed'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Dest: {item.destination || 'Next station'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] text-slate-600">
                    {item.createdAt}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Record Inspection Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-950">
              Record QC Inspection
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Perform physical checklist verification, log caliper tolerances,
              and apply disposition.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Panel Mark *
                </label>
                <Select
                  value={selectedMarkId}
                  onValueChange={(val) => {
                    if (val) setSelectedMarkId(val)
                  }}
                >
                  <SelectTrigger
                    aria-label="Panel Mark"
                    className="mt-1 h-9 text-xs"
                  >
                    <SelectValue placeholder="Select mark..." />
                  </SelectTrigger>
                  <SelectContent>
                    {marks.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.mark} — {m.materialFamily} ({m.color || 'Standard'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">
                  Inspected Quantity *
                </label>
                <Input
                  aria-label="Inspection Quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1 h-9 font-mono text-xs font-bold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                QC Disposition *
              </label>
              <Select
                value={disposition}
                onValueChange={(val) => {
                  if (val) setDisposition(val as QualityDisposition)
                }}
              >
                <SelectTrigger
                  aria-label="QC Disposition"
                  className="mt-1 h-9 text-xs font-bold"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pass">
                    Pass (Meets all tolerances)
                  </SelectItem>
                  <SelectItem value="Pass with Note">
                    Pass with Note (Minor deviation acceptable)
                  </SelectItem>
                  <SelectItem value="Hold">
                    Hold (Place on QC quarantine hold)
                  </SelectItem>
                  <SelectItem value="Rework">
                    Rework (Return to upstream station)
                  </SelectItem>
                  <SelectItem value="Remake">
                    Remake (Generate RMK / RME replacement)
                  </SelectItem>
                  <SelectItem value="Scrap">
                    Scrap (Non-conforming write-off)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Caliper Measurement Grid */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Compass className="h-3.5 w-3.5 text-blue-600" />
                Caliper & Dimensional Measurements (Inches)
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 font-mono">
                <div>
                  <label className="text-[10px] text-slate-500">Width</label>
                  <Input
                    placeholder="48.000"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Length</label>
                  <Input
                    placeholder="120.000"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Diagonal</label>
                  <Input
                    placeholder="129.240"
                    value={diagonal}
                    onChange={(e) => setDiagonal(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">
                    Thickness
                  </label>
                  <Input
                    placeholder="0.1575"
                    value={thickness}
                    onChange={(e) => setThickness(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Non-Conformance Fields if Disposition is not Pass */}
            {disposition !== 'Pass' && disposition !== 'Pass with Note' && (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                  Non-Conformance Issue Capture
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-amber-900">
                      Defect Category *
                    </label>
                    <Select
                      value={issueCategory}
                      onValueChange={(val) => {
                        if (val) setIssueCategory(val as QualityIssueCategory)
                      }}
                    >
                      <SelectTrigger
                        aria-label="Defect Category"
                        className="h-8 text-xs"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Surface Defect">
                          Surface Defect
                        </SelectItem>
                        <SelectItem value="Dimensional Discrepancy">
                          Dimensional Discrepancy
                        </SelectItem>
                        <SelectItem value="Machining / Routing Error">
                          Machining / Routing Error
                        </SelectItem>
                        <SelectItem value="Hardware/Assembly Defect">
                          Hardware / Assembly Defect
                        </SelectItem>
                        <SelectItem value="Material Flaw">
                          Material Flaw
                        </SelectItem>
                        <SelectItem value="Drawing Discrepancy">
                          Drawing Discrepancy
                        </SelectItem>
                        <SelectItem value="Handling Damage">
                          Handling Damage
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-amber-900">
                      Severity *
                    </label>
                    <Select
                      value={issueSeverity}
                      onValueChange={(val) => {
                        if (val) setIssueSeverity(val as QualityIssueSeverity)
                      }}
                    >
                      <SelectTrigger
                        aria-label="Severity"
                        className="h-8 text-xs"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Minor">Minor</SelectItem>
                        <SelectItem value="Moderate">Moderate</SelectItem>
                        <SelectItem value="Critical">Critical</SelectItem>
                        <SelectItem value="Blocking">Blocking</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-amber-900">
                    Suspected Root Cause *
                  </label>
                  <Input
                    placeholder="e.g. CNC suction vacuum dropped causing corner misalignment"
                    value={suspectedCause}
                    onChange={(e) => setSuspectedCause(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-slate-700">
                Inspection Notes / Observations
              </label>
              <Input
                placeholder="e.g. All edge rivets inspected; silicone seal continuous"
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
              onClick={() => setModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submitting || !quantity}
              onClick={handleSaveInspection}
              className="bg-blue-600 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
            >
              {submitting ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Log Inspection & Apply Disposition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
