import { db } from '@/db'
import {
  operationInstances,
  operationDefinitions,
  qualityIssues,
  pallets,
  shipments,
} from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { UserContext } from '@/lib/auth/roles'
import { requirePermission } from '@/lib/middleware/authorize'

export interface OperationalYieldSummary {
  totalPlannedPanels: number
  totalCompletedPanels: number
  totalScrapPanels: number
  totalHoldPanels: number
  overallYieldPercentage: number
  scrapRatePercentage: number
}

export interface DepartmentThroughputMetric {
  department: string
  completedUnits: number
  inProgressUnits: number
  scrapUnits: number
  holdUnits: number
  efficiencyScore: number
}

export interface DefectDistributionItem {
  category: string
  count: number
  percentage: number
}

export interface LogisticsThroughputMetric {
  totalPalletsBuilt: number
  totalPalletsShipped: number
  totalShipmentsDispatched: number
  totalWeightShippedLbs: number
}

export interface ComprehensiveReportData {
  yield: OperationalYieldSummary
  departmentThroughput: DepartmentThroughputMetric[]
  defectDistribution: DefectDistributionItem[]
  logistics: LogisticsThroughputMetric
}

export class ReportsService {
  /**
   * Aggregates live operational yield and manufacturing performance.
   */
  static async getComprehensiveReport(
    context: UserContext,
  ): Promise<ComprehensiveReportData> {
    requirePermission(context, 'view', 'getComprehensiveReport')
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

    // 1. Operation instances aggregation
    const opStats = await db
      .select({
        totalPlanned: sql<number>`coalesce(sum(${operationInstances.plannedQuantity}), 0)::int`,
        totalCompleted: sql<number>`coalesce(sum(${operationInstances.completedQuantity}), 0)::int`,
        totalScrap: sql<number>`coalesce(sum(${operationInstances.scrapQuantity}), 0)::int`,
        totalHold: sql<number>`coalesce(sum(${operationInstances.holdQuantity}), 0)::int`,
      })
      .from(operationInstances)
      .where(eq(operationInstances.organizationId, orgId))

    const planned = Number(opStats[0]?.totalPlanned || 0)
    const completed = Number(opStats[0]?.totalCompleted || 0)
    const scrap = Number(opStats[0]?.totalScrap || 0)
    const hold = Number(opStats[0]?.totalHold || 0)

    const overallYield =
      planned > 0 ? (completed / (completed + scrap || 1)) * 100 : 100
    const scrapRate = planned > 0 ? (scrap / planned) * 100 : 0

    // 2. Department Throughput
    const deptRows = await db
      .select({
        department: operationDefinitions.department,
        completed: sql<number>`coalesce(sum(${operationInstances.completedQuantity}), 0)::int`,
        inProgress: sql<number>`coalesce(sum(case when ${operationInstances.status} = 'In progress' then ${operationInstances.plannedQuantity} - ${operationInstances.completedQuantity} else 0 end), 0)::int`,
        scrap: sql<number>`coalesce(sum(${operationInstances.scrapQuantity}), 0)::int`,
        hold: sql<number>`coalesce(sum(${operationInstances.holdQuantity}), 0)::int`,
      })
      .from(operationInstances)
      .innerJoin(
        operationDefinitions,
        eq(operationInstances.operationDefinitionId, operationDefinitions.id),
      )
      .where(eq(operationInstances.organizationId, orgId))
      .groupBy(operationDefinitions.department)

    const defaultDepts = [
      'CNC',
      'ELU',
      'Parts Preparation',
      'Assembly',
      'QC',
      'Packaging',
    ]
    const deptMap = new Map(deptRows.map((d) => [d.department, d]))

    const departmentThroughput: DepartmentThroughputMetric[] = defaultDepts.map(
      (name) => {
        const row = deptMap.get(name)
        const c = Number(row?.completed || 0)
        const s = Number(row?.scrap || 0)
        const eff = c + s > 0 ? (c / (c + s)) * 100 : 100
        return {
          department: name,
          completedUnits: c,
          inProgressUnits: Number(row?.inProgress || 0),
          scrapUnits: s,
          holdUnits: Number(row?.hold || 0),
          efficiencyScore: Number(eff.toFixed(1)),
        }
      },
    )

    // 3. Quality Defect Distribution
    const defectRows = await db
      .select({
        category: qualityIssues.category,
        count: sql<number>`count(*)::int`,
      })
      .from(qualityIssues)
      .where(eq(qualityIssues.organizationId, orgId))
      .groupBy(qualityIssues.category)

    const totalDefects = defectRows.reduce((acc, d) => acc + Number(d.count), 0)
    const defectDistribution: DefectDistributionItem[] = defectRows.map(
      (d) => ({
        category: d.category,
        count: Number(d.count),
        percentage:
          totalDefects > 0
            ? Number(((Number(d.count) / totalDefects) * 100).toFixed(1))
            : 0,
      }),
    )

    // 4. Logistics Throughput
    const palletStats = await db
      .select({
        totalBuilt: sql<number>`count(*)::int`,
        totalShipped: sql<number>`coalesce(sum(case when ${pallets.status} = 'Shipped' then 1 else 0 end), 0)::int`,
      })
      .from(pallets)
      .where(eq(pallets.organizationId, orgId))

    const shipmentStats = await db
      .select({
        totalDispatched: sql<number>`coalesce(sum(case when ${shipments.status} = 'Dispatched' then 1 else 0 end), 0)::int`,
        totalWeight: sql<number>`coalesce(sum(case when ${shipments.status} = 'Dispatched' then ${shipments.totalWeightLbs}::numeric else 0 end), 0)`,
      })
      .from(shipments)
      .where(eq(shipments.organizationId, orgId))

    return {
      yield: {
        totalPlannedPanels: planned,
        totalCompletedPanels: completed,
        totalScrapPanels: scrap,
        totalHoldPanels: hold,
        overallYieldPercentage: Number(overallYield.toFixed(1)),
        scrapRatePercentage: Number(scrapRate.toFixed(1)),
      },
      departmentThroughput,
      defectDistribution,
      logistics: {
        totalPalletsBuilt: Number(palletStats[0]?.totalBuilt || 0),
        totalPalletsShipped: Number(palletStats[0]?.totalShipped || 0),
        totalShipmentsDispatched: Number(
          shipmentStats[0]?.totalDispatched || 0,
        ),
        totalWeightShippedLbs: Number(shipmentStats[0]?.totalWeight || 0),
      },
    }
  }

  /**
   * Generates CSV export for various report categories.
   */
  static async exportReportCsv(
    context: UserContext,
    reportType: 'yield' | 'throughput' | 'defects' | 'scrap',
  ): Promise<string> {
    requirePermission(context, 'export', `exportReport:${reportType}`)
    const report = await this.getComprehensiveReport(context)

    if (reportType === 'yield') {
      const headers = ['Metric', 'Value']
      const rows = [
        ['Total Planned Units', report.yield.totalPlannedPanels],
        ['Total Completed Units', report.yield.totalCompletedPanels],
        ['Total Scrap Units', report.yield.totalScrapPanels],
        ['Total Hold Units', report.yield.totalHoldPanels],
        ['Yield Percentage (%)', `${report.yield.overallYieldPercentage}%`],
        ['Scrap Rate (%)', `${report.yield.scrapRatePercentage}%`],
      ]
      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    }

    if (reportType === 'throughput') {
      const headers = [
        'Department',
        'Completed Units',
        'In Progress Units',
        'Scrap Units',
        'Hold Units',
        'Efficiency Score (%)',
      ]
      const rows = report.departmentThroughput.map((d) => [
        `"${d.department}"`,
        d.completedUnits,
        d.inProgressUnits,
        d.scrapUnits,
        d.holdUnits,
        `${d.efficiencyScore}%`,
      ])
      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    }

    if (reportType === 'defects') {
      const headers = ['Defect Category', 'Incident Count', 'Percentage (%)']
      const rows = report.defectDistribution.map((d) => [
        `"${d.category}"`,
        d.count,
        `${d.percentage}%`,
      ])
      return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    }

    // Default / Scrap
    const headers = ['Department', 'Scrap Units', 'Total Units']
    const rows = report.departmentThroughput.map((d) => [
      `"${d.department}"`,
      d.scrapUnits,
      d.completedUnits + d.scrapUnits,
    ])
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  }
}
