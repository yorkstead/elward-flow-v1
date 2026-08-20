'use client'

import * as React from 'react'
import {
  Package,
  Layers,
  Truck,
  ClipboardCheck,
  Download,
  AlertTriangle,
  Boxes,
  DollarSign,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InventoryStockTable } from './inventory-stock-table'
import {
  PurchasingReceivingConsole,
  type PoLineItem,
} from './purchasing-receiving-console'
import { ReleaseDemandBoard } from './release-demand-board'
import { CycleCountConsole } from './cycle-count-console'
import type {
  InventoryItemStockSummary,
  ReleaseDemandItem,
} from '@/lib/services/inventory'

interface LocationOption {
  id: string
  code: string
  name: string
  zone: string
}

interface InventoryDashboardViewProps {
  initialStock: InventoryItemStockSummary[]
  initialPoLines: PoLineItem[]
  initialReleaseDemand: ReleaseDemandItem[]
  locations: LocationOption[]
  activeReleaseKey: string
  activeReleaseId: string
  canViewValuation?: boolean
}

export function InventoryDashboardView({
  initialStock,
  initialPoLines,
  initialReleaseDemand,
  locations,
  activeReleaseKey,
  activeReleaseId,
  canViewValuation,
}: InventoryDashboardViewProps) {
  const [activeTab, setActiveTab] = React.useState<
    'stock' | 'receiving' | 'demand' | 'cycle_count'
  >('stock')

  const totalItems = initialStock.length
  const totalValuation = initialStock.reduce(
    (acc, i) => acc + (i.totalValuation || 0),
    0,
  )
  const openPos = initialPoLines.filter(
    (p) => p.status === 'Open' || p.status === 'Partially Received',
  ).length
  const reorderAlerts = initialStock.filter((i) => i.reorderAlert).length
  const shortages = initialReleaseDemand.filter(
    (d) => d.shortageQuantity > 0,
  ).length

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* Master Top Bar */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-950">
              Inventory, Purchasing & Material Allocations
            </h1>
            <p className="text-xs text-slate-500">
              Transaction-led stock ledger, PO line receiving, demand
              allocation, and blind cycle counts
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tab Navigation */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <Button
              type="button"
              variant={activeTab === 'stock' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('stock')}
              className={`h-7 px-3 text-xs font-semibold ${
                activeTab === 'stock'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600'
              }`}
            >
              <Package className="mr-1.5 h-3.5 w-3.5" />
              Stock Ledger
            </Button>
            <Button
              type="button"
              variant={activeTab === 'receiving' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('receiving')}
              className={`h-7 px-3 text-xs font-semibold ${
                activeTab === 'receiving'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600'
              }`}
            >
              <Truck className="mr-1.5 h-3.5 w-3.5" />
              PO Receiving Dock
            </Button>
            <Button
              type="button"
              variant={activeTab === 'demand' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('demand')}
              className={`h-7 px-3 text-xs font-semibold ${
                activeTab === 'demand'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600'
              }`}
            >
              <Layers className="mr-1.5 h-3.5 w-3.5" />
              Release Demand
            </Button>
            <Button
              type="button"
              variant={activeTab === 'cycle_count' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('cycle_count')}
              className={`h-7 px-3 text-xs font-semibold ${
                activeTab === 'cycle_count'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600'
              }`}
            >
              <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
              Blind Cycle Count
            </Button>
          </div>

          <a href="/api/inventory/export" download>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold text-slate-800"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export Stock CSV
            </Button>
          </a>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Inventory KPI Summary Cards */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Active SKUs</span>
            <Package className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-950">
            {totalItems}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
            <span>ACM, Extrusions & Hardware</span>
          </div>
        </div>

        {canViewValuation && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold">On-Hand Valuation</span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-black text-slate-950">
              $
              {totalValuation.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
              <TrendingUp className="h-3 w-3" />
              <span>Standard Cost Valuation</span>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Open Purchase Orders</span>
            <Truck className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-900">
            {openPos}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {reorderAlerts > 0 ? (
              <span className="font-bold text-amber-700">
                {reorderAlerts} items below reorder point
              </span>
            ) : (
              'All items above reorder point'
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Release Shortages</span>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <div
            className={`mt-2 text-2xl font-black ${
              shortages > 0 ? 'text-red-700' : 'text-emerald-700'
            }`}
          >
            {shortages}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {shortages > 0 ? (
              <span className="font-bold text-red-700">
                Action required for {activeReleaseKey}
              </span>
            ) : (
              'All release demand covered'
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Active Tab Content */}
      {/* ========================================================================= */}
      {activeTab === 'stock' && (
        <InventoryStockTable
          initialItems={initialStock}
          locations={locations}
          canViewValuation={canViewValuation}
        />
      )}

      {activeTab === 'receiving' && (
        <PurchasingReceivingConsole
          initialPoLines={initialPoLines}
          locations={locations}
        />
      )}

      {activeTab === 'demand' && (
        <ReleaseDemandBoard
          releaseKey={activeReleaseKey}
          releaseId={activeReleaseId}
          initialDemand={initialReleaseDemand}
          stockItems={initialStock}
          locations={locations}
        />
      )}

      {activeTab === 'cycle_count' && (
        <CycleCountConsole stockItems={initialStock} />
      )}
    </div>
  )
}
