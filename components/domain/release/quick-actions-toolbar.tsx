'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  QrCode,
  CheckCircle,
  FileEdit,
  AlertTriangle,
  FileText,
  Binary,
  ShieldAlert,
} from 'lucide-react'

interface QuickActionsToolbarProps {
  jobNumber: string
  releaseNumber: number
  userRoles: string[]
  isAdmin?: boolean
}

export function QuickActionsToolbar({
  jobNumber,
  releaseNumber,
  userRoles,
  isAdmin = false,
}: QuickActionsToolbarProps) {
  const canHold =
    isAdmin ||
    userRoles.some((r) =>
      [
        'System Administrator',
        'Operations Manager',
        'Production Manager',
        'QC',
      ].includes(r),
    )

  const canProduce =
    isAdmin ||
    userRoles.some((r) =>
      [
        'System Administrator',
        'Operations Manager',
        'Production Manager',
        'CNC Operator',
        'CNC Lead',
        'ELU Operator',
        'ELU Lead',
        'Assembly Operator',
        'Assembly Lead',
        'Parts Preparation',
      ].includes(r),
    )

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h2 className="text-sm font-bold text-slate-900">
          Prominent Shop Floor Actions
        </h2>
        <span className="font-mono text-xs text-slate-500">
          Job {jobNumber}-{releaseNumber}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Link
          href={`/scan?job=${jobNumber}&release=${releaseNumber}`}
          className="w-full"
        >
          <Button
            variant="default"
            className="flex h-11 w-full items-center justify-center gap-2 bg-blue-600 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
          >
            <QrCode className="h-4 w-4" />
            Scan
          </Button>
        </Link>

        {canProduce && (
          <Button
            variant="outline"
            onClick={() =>
              alert(
                `Opening Record Production dialog for Release ${jobNumber}-${releaseNumber}`,
              )
            }
            className="flex h-11 w-full items-center justify-center gap-1.5 border-slate-200 text-xs font-semibold hover:bg-slate-50"
          >
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            Record Qty
          </Button>
        )}

        <Button
          variant="outline"
          onClick={() => alert(`Opening Add Note/Photo dialog`)}
          className="flex h-11 w-full items-center justify-center gap-1.5 border-slate-200 text-xs font-semibold hover:bg-slate-50"
        >
          <FileEdit className="h-4 w-4 text-slate-600" />
          Add Note/Photo
        </Button>

        <Button
          variant="outline"
          onClick={() => alert(`Opening Report Issue dialog`)}
          className="flex h-11 w-full items-center justify-center gap-1.5 border-amber-200 bg-amber-50/50 text-xs font-semibold text-amber-900 hover:bg-amber-100"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Report Issue
        </Button>

        <Button
          variant="outline"
          onClick={() => alert(`Opening Current Approved Drawings`)}
          className="flex h-11 w-full items-center justify-center gap-1.5 border-slate-200 text-xs font-semibold hover:bg-slate-50"
        >
          <FileText className="h-4 w-4 text-blue-600" />
          Drawings
        </Button>

        <Button
          variant="outline"
          onClick={() => alert(`Opening CNC Files & Layouts`)}
          className="flex h-11 w-full items-center justify-center gap-1.5 border-slate-200 text-xs font-semibold hover:bg-slate-50"
        >
          <Binary className="h-4 w-4 text-purple-600" />
          CNC Files
        </Button>

        {canHold && (
          <Button
            variant="outline"
            onClick={() => alert(`Opening Quality Hold Management`)}
            className="flex h-11 w-full items-center justify-center gap-1.5 border-red-200 bg-red-50/50 text-xs font-semibold text-red-900 hover:bg-red-100"
          >
            <ShieldAlert className="h-4 w-4 text-red-600" />
            Toggle Hold
          </Button>
        )}
      </div>
    </div>
  )
}
