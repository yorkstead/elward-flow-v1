'use client'

import * as React from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { ProductionQueueItem } from '@/lib/services/production'

interface PrintableQueueDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ProductionQueueItem[]
  department: string
}

export function PrintableQueueDialog({
  open,
  onOpenChange,
  items,
  department,
}: PrintableQueueDialogProps) {
  const handlePrint = () => {
    window.print()
  }

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="print:hidden">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-bold text-slate-950">
                Printable Daily Contingency Queue — {department.toUpperCase()}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Use for physical clipboard check-off and tracking during network
                downtime.
              </DialogDescription>
            </div>
            <Button
              type="button"
              onClick={handlePrint}
              className="bg-blue-600 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print Sheet
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Paper View */}
        <div className="mt-4 space-y-4 border border-slate-300 p-6 text-slate-950 print:border-none print:p-0">
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
            <div>
              <h1 className="text-xl font-black tracking-tight">
                ELWARD FLOW — DAILY SHOP QUEUE
              </h1>
              <p className="text-xs font-semibold text-slate-600">
                Department: {department.toUpperCase()} • Generated:{' '}
                {currentDate}
              </p>
            </div>
            <div className="text-right text-xs">
              <div className="font-bold">Total Marks: {items.length}</div>
              <div className="text-slate-600">
                Planned Pcs:{' '}
                {items.reduce((acc, i) => acc + i.plannedQuantity, 0)}
              </div>
            </div>
          </div>

          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-900 bg-slate-100">
                <th className="p-1.5 font-bold">Seq</th>
                <th className="p-1.5 font-bold">Job / Rel</th>
                <th className="p-1.5 font-bold">Mark</th>
                <th className="p-1.5 font-bold">Material / Dims</th>
                <th className="p-1.5 text-center font-bold">Qty</th>
                <th className="p-1.5 font-bold">Station / Program</th>
                <th className="p-1.5 text-center font-bold">First-Off</th>
                <th className="p-1.5 text-center font-bold">Done [ ✓ ]</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b border-slate-300">
                  <td className="p-1.5 font-mono text-[11px]">{idx + 1}</td>
                  <td className="p-1.5 font-bold">
                    {item.releaseKey} (Rev {item.revisionLabel})
                  </td>
                  <td className="p-1.5 font-mono text-sm font-bold">
                    {item.markCode}
                  </td>
                  <td className="p-1.5">
                    <div>
                      {item.materialFamily} ({item.color})
                    </div>
                    <div className="text-[10px] text-slate-600">
                      {item.dimensions || 'Standard'}
                    </div>
                  </td>
                  <td className="p-1.5 text-center font-mono text-sm font-bold">
                    {item.remainingQuantity}
                  </td>
                  <td className="p-1.5">
                    <div>{item.assignedWorkstationName || 'Unassigned'}</div>
                    {item.machineReference && (
                      <div className="font-mono text-[10px] text-slate-600">
                        {item.machineReference}
                      </div>
                    )}
                  </td>
                  <td className="p-1.5 text-center">
                    <div className="mx-auto h-4 w-4 rounded-xs border border-slate-400" />
                  </td>
                  <td className="p-1.5 text-center">
                    <div className="mx-auto h-5 w-5 rounded-xs border-2 border-slate-900" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 grid grid-cols-2 gap-8 border-t-2 border-slate-900 pt-6 text-xs">
            <div>
              <div className="font-bold">Operator Signature:</div>
              <div className="mt-4 border-b border-slate-400" />
            </div>
            <div>
              <div className="font-bold">Supervisor Sign-Off:</div>
              <div className="mt-4 border-b border-slate-400" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
