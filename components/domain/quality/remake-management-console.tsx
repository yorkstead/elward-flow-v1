'use client'

import * as React from 'react'
import {
  RotateCcw,
  Search,
  Plus,
  DollarSign,
  CheckCircle2,
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
import type { RemakeItem } from '@/lib/services/quality'

interface MarkOption {
  id: string
  mark: string
  materialFamily: string
  color: string | null
}

interface RemakeManagementConsoleProps {
  initialRemakes: RemakeItem[]
  marks: MarkOption[]
  canViewCost?: boolean
  onRemakeCreated?: () => void
}

export function RemakeManagementConsole({
  initialRemakes,
  marks,
  canViewCost,
  onRemakeCreated,
}: RemakeManagementConsoleProps) {
  const [remakes, setRemakes] = React.useState<RemakeItem[]>(initialRemakes)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('all')

  // Generate Remake Modal State
  const [modalOpen, setModalOpen] = React.useState(false)
  const [selectedMarkId, setSelectedMarkId] = React.useState(marks[0]?.id || '')
  const [remakeType, setRemakeType] = React.useState<'RMK' | 'RME'>('RME')
  const [responsibleArea, setResponsibleArea] = React.useState('Engineering')
  const [materialCost, setMaterialCost] = React.useState('145.00')
  const [laborHours, setLaborHours] = React.useState('1.50')
  const [laborCost, setLaborCost] = React.useState('67.50')
  const [outsideCost, setOutsideCost] = React.useState('0.00')
  const [notes, setNotes] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const filtered = remakes.filter((item) => {
    if (typeFilter !== 'all') {
      if (item.remakeType.toLowerCase() !== typeFilter.toLowerCase()) {
        return false
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matches =
        item.remakeMark.toLowerCase().includes(q) ||
        item.originalMarkCode.toLowerCase().includes(q) ||
        item.responsibleArea.toLowerCase().includes(q)
      if (!matches) return false
    }
    return true
  })

  const handleCreateRemake = async () => {
    if (!selectedMarkId) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/quality/remake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalPanelMarkId: selectedMarkId,
          remakeType,
          responsibleArea,
          startingSequence: 51,
          materialCost: parseFloat(materialCost) || 0,
          laborHours: parseFloat(laborHours) || 0,
          laborCost: parseFloat(laborCost) || 0,
          outsideCost: parseFloat(outsideCost) || 0,
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to generate remake')
      }

      const data = await res.json()
      const origMark = marks.find((m) => m.id === selectedMarkId)

      const mat = parseFloat(materialCost) || 0
      const lab = parseFloat(laborCost) || 0
      const out = parseFloat(outsideCost) || 0
      const total = mat + lab + out

      const newRemake: RemakeItem = {
        id: data.result?.remakeId || `remake-${Date.now()}`,
        remakeType,
        remakeMark:
          data.result?.remakeMark || `${origMark?.mark}-${remakeType}-51`,
        sequenceNumber: 51,
        originalMarkCode: origMark?.mark || 'P-101',
        originalMarkId: selectedMarkId,
        replacementMarkId: null,
        responsibleArea,
        materialCost: canViewCost ? mat : null,
        laborHours: canViewCost ? parseFloat(laborHours) || 0 : null,
        laborCost: canViewCost ? lab : null,
        outsideCost: canViewCost ? out : null,
        totalCost: canViewCost ? total : null,
        status: 'In Routing',
        createdAt: new Date().toLocaleString('en-US', {
          timeZone: 'America/Denver',
        }),
      }

      setRemakes((prev) => [newRemake, ...prev])
      setModalOpen(false)
      setNotes('')
      onRemakeCreated?.()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              RMK / RME Remake Command & Cost Trace
            </h2>
            <p className="text-xs text-slate-500">
              Generate replacement marks starting at sequence 51, maintain
              parent-child lineage, and roll up total non-conformance cost
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48 sm:w-60">
            <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search remake, parent mark..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 font-mono text-xs"
            />
          </div>

          <Select
            value={typeFilter}
            onValueChange={(val) => {
              if (val) setTypeFilter(val)
            }}
          >
            <SelectTrigger
              aria-label="Filter Remake Type"
              className="h-8 w-32 text-xs font-semibold"
            >
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="rme">RME (Engineering)</SelectItem>
              <SelectItem value="rmk">RMK (Shop Floor)</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            size="sm"
            onClick={() => setModalOpen(true)}
            className="h-8 bg-blue-600 px-3 text-xs font-bold text-white shadow-2xs hover:bg-blue-700"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Generate RMK / RME Remake
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
          No remakes in routing.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="font-bold">Replacement Mark</TableHead>
                <TableHead className="font-bold">
                  Original Parent Mark
                </TableHead>
                <TableHead className="font-bold">
                  Type & Responsibility
                </TableHead>
                <TableHead className="text-center font-bold">Seq #</TableHead>
                {canViewCost && (
                  <>
                    <TableHead className="text-right font-bold">
                      Labor Hours
                    </TableHead>
                    <TableHead className="text-right font-bold">
                      Material Cost
                    </TableHead>
                    <TableHead className="text-right font-bold">
                      Total Cost ($)
                    </TableHead>
                  </>
                )}
                <TableHead className="text-center font-bold">
                  Routing Status
                </TableHead>
                <TableHead className="text-right font-bold">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id} className="text-xs">
                  <TableCell>
                    <div className="font-mono font-bold text-purple-950">
                      {item.remakeMark}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono font-semibold text-slate-700">
                      {item.originalMarkCode}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        className={
                          item.remakeType === 'RME'
                            ? 'bg-purple-100 text-[10px] font-bold text-purple-800'
                            : 'bg-orange-100 text-[10px] font-bold text-orange-800'
                        }
                      >
                        {item.remakeType}
                      </Badge>
                      <span className="text-xs font-semibold text-slate-900">
                        {item.responsibleArea}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono font-bold text-slate-900">
                    {item.sequenceNumber}
                  </TableCell>
                  {canViewCost && (
                    <>
                      <TableCell className="text-right font-mono text-slate-700">
                        {item.laborHours !== null ? `${item.laborHours}h` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-slate-700">
                        {item.materialCost !== null
                          ? `$${item.materialCost.toFixed(2)}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-red-900">
                        {item.totalCost !== null
                          ? `$${item.totalCost.toFixed(2)}`
                          : '—'}
                      </TableCell>
                    </>
                  )}
                  <TableCell className="text-center">
                    <Badge className="bg-amber-100 text-[10px] font-bold text-amber-800">
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] text-slate-500">
                    {item.createdAt}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Generate Remake Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-950">
              Generate Replacement Remake (RMK / RME)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Creates a replacement panel mark with sequence beginning at 51,
              links parent-child lineage, and dispatches high-priority routing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Parent Panel Mark *
                </label>
                <Select
                  value={selectedMarkId}
                  onValueChange={(val) => {
                    if (val) setSelectedMarkId(val)
                  }}
                >
                  <SelectTrigger
                    aria-label="Parent Mark"
                    className="mt-1 h-9 text-xs"
                  >
                    <SelectValue placeholder="Select mark..." />
                  </SelectTrigger>
                  <SelectContent>
                    {marks.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.mark} ({m.materialFamily})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">
                  Remake Classification *
                </label>
                <Select
                  value={remakeType}
                  onValueChange={(val) => {
                    if (val) {
                      setRemakeType(val as 'RMK' | 'RME')
                      setResponsibleArea(
                        val === 'RME' ? 'Engineering' : 'Shop Floor',
                      )
                    }
                  }}
                >
                  <SelectTrigger
                    aria-label="Remake Classification"
                    className="mt-1 h-9 text-xs font-bold"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RME">
                      RME (Engineering / External Drawing Change)
                    </SelectItem>
                    <SelectItem value="RMK">
                      RMK (Internal Shop Floor Defect)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">
                Responsible Area / Root Cause Department *
              </label>
              <Select
                value={responsibleArea}
                onValueChange={(val) => {
                  if (val) setResponsibleArea(val)
                }}
              >
                <SelectTrigger
                  aria-label="Responsible Area"
                  className="mt-1 h-9 text-xs font-semibold"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Engineering">
                    Engineering / Drafting
                  </SelectItem>
                  <SelectItem value="Shop Floor">Shop Floor Routing</SelectItem>
                  <SelectItem value="Vendor">Material Vendor Flaw</SelectItem>
                  <SelectItem value="Customer Change">
                    Architect / Customer Change
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cost Estimation Breakdown */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                Cost Estimate Breakdown
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 font-mono">
                <div>
                  <label className="text-[10px] text-slate-500">
                    Material ($)
                  </label>
                  <Input
                    value={materialCost}
                    onChange={(e) => setMaterialCost(e.target.value)}
                    className="h-8 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">
                    Labor (hrs)
                  </label>
                  <Input
                    value={laborHours}
                    onChange={(e) => setLaborHours(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">
                    Labor ($)
                  </label>
                  <Input
                    value={laborCost}
                    onChange={(e) => setLaborCost(e.target.value)}
                    className="h-8 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">
                    Outside ($)
                  </label>
                  <Input
                    value={outsideCost}
                    onChange={(e) => setOutsideCost(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">
                Engineering Notes / Revision Context (Optional)
              </label>
              <Input
                placeholder="e.g. Revised flange return dimension from 1.50 to 1.75 per RFI-08"
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
              disabled={submitting || !selectedMarkId}
              onClick={handleCreateRemake}
              className="bg-blue-600 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
            >
              {submitting ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Generate Remake & Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
