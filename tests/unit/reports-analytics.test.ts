import { describe, it, expect, vi } from 'vitest'
import { ReportsService } from '@/lib/services/reports'

describe('Reports & Manufacturing Analytics', () => {
  const mockUserContext = {
    userId: '33333333-3333-3333-3333-333333333333',
    email: 'manager@elward.test',
    roles: ['manager', 'operations manager'],
    isAdmin: false,
    organizationId: '00000000-0000-0000-0000-000000000001',
  }

  it('generates yield and throughput CSV reports with expected column structure', async () => {
    const sampleReport = {
      yield: {
        totalPlannedPanels: 100,
        totalCompletedPanels: 95,
        totalScrapPanels: 5,
        totalHoldPanels: 0,
        overallYieldPercentage: 95.0,
        scrapRatePercentage: 5.0,
      },
      departmentThroughput: [
        {
          department: 'CNC',
          completedUnits: 95,
          inProgressUnits: 0,
          scrapUnits: 5,
          holdUnits: 0,
          efficiencyScore: 95.0,
        },
      ],
      defectDistribution: [
        {
          category: 'Surface Defect',
          count: 2,
          percentage: 40.0,
        },
      ],
      logistics: {
        totalPalletsBuilt: 4,
        totalPalletsShipped: 2,
        totalShipmentsDispatched: 1,
        totalWeightShippedLbs: 888,
      },
    }

    vi.spyOn(ReportsService, 'getComprehensiveReport').mockResolvedValue(
      sampleReport,
    )

    const yieldCsv = await ReportsService.exportReportCsv(
      mockUserContext,
      'yield',
    )
    expect(yieldCsv).toContain('Metric,Value')
    expect(yieldCsv).toContain('Yield Percentage (%),95%')

    const throughputCsv = await ReportsService.exportReportCsv(
      mockUserContext,
      'throughput',
    )
    expect(throughputCsv).toContain(
      'Department,Completed Units,In Progress Units',
    )
    expect(throughputCsv).toContain('"CNC"')
  })
})
