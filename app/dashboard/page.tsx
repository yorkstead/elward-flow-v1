import { auth } from '@/auth'
import Link from 'next/link'
import { db } from '@/db'
import {
  productionJobs,
  releases,
  releaseRevisions,
  panelMarks,
  customers,
  projects,
  operationDefinitions,
  operationInstances,
  documentClassifications,
  documents,
  documentRevisions,
  activityEvents,
  users,
} from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { ReleaseHeaderBanner } from '@/components/domain/release/release-header-banner'
import { QuickActionsToolbar } from '@/components/domain/release/quick-actions-toolbar'
import {
  BlockersExceptionsCard,
  type BlockerItem,
} from '@/components/domain/release/blockers-exceptions-card'
import {
  DepartmentProgressTracker,
  type DepartmentStepProgress,
} from '@/components/domain/release/department-progress-tracker'
import {
  PanelMarksTable,
  type PanelMarkRow,
} from '@/components/domain/release/panel-marks-table'
import {
  ControlledDocumentsList,
  type ReleaseDocumentItem,
} from '@/components/domain/release/controlled-documents-list'
import {
  ActivityStream,
  type ActivityItem,
} from '@/components/domain/release/activity-stream'
import { FirstRunDashboard } from '@/components/domain/dashboard/first-run-dashboard'
import { Button } from '@/components/ui/button'

interface PageProps {
  searchParams: Promise<{
    job?: string
    release?: string
  }>
}

export default async function DashboardPage(props: PageProps) {
  try {
    const session = await auth()
    const searchParams = await props.searchParams

    const organizationId = session?.user?.organizationId
    if (!organizationId || organizationId === 'undefined') {
      return <FirstRunDashboard />
    }

    const [mostRecentRelease] = await db
      .select({
        jobNumber: productionJobs.jobNumber,
        releaseNumber: releases.releaseNumber,
      })
      .from(releases)
      .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .where(eq(releases.organizationId, organizationId))
      .orderBy(desc(releases.updatedAt))
      .limit(1)

    const targetJobNumber = searchParams.job || mostRecentRelease?.jobNumber

    if (!targetJobNumber) {
      return <FirstRunDashboard />
    }

    const parsedReleaseNumber = searchParams.release
      ? Number.parseInt(searchParams.release, 10)
      : mostRecentRelease?.releaseNumber ?? 1
    const targetReleaseNumber =
      Number.isInteger(parsedReleaseNumber) && parsedReleaseNumber > 0
        ? parsedReleaseNumber
        : 1

    // 1. Fetch Production Job & Associated Customer / Project
    const [jobRecord] = await db
      .select({
        id: productionJobs.id,
        jobNumber: productionJobs.jobNumber,
        name: productionJobs.name,
        status: productionJobs.status,
        targetShipDate: productionJobs.targetShipDate,
        customerName: customers.name,
        projectName: projects.name,
      })
      .from(productionJobs)
      .leftJoin(customers, eq(productionJobs.customerId, customers.id))
      .leftJoin(projects, eq(productionJobs.projectId, projects.id))
      .where(
        and(
          eq(productionJobs.organizationId, organizationId),
          eq(productionJobs.jobNumber, targetJobNumber),
        ),
      )
      .limit(1)

    if (!jobRecord) {
      return (
        <div className="space-y-4 p-8 text-center">
          <h2 className="text-xl font-bold text-slate-800">
            Job {targetJobNumber} Not Found
          </h2>
          <p className="text-sm text-slate-500">
            The requested job does not exist in this organization.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link href="/releases/intake">
              <Button>Start Release Intake</Button>
            </Link>
            <Link href="/releases">
              <Button variant="outline">View All Releases</Button>
            </Link>
          </div>
        </div>
      )
    }

    // 2. Fetch Release & Current Revision
    const [releaseRecord] = await db
      .select({
        id: releases.id,
        releaseNumber: releases.releaseNumber,
        status: releases.status,
        priority: releases.priority,
        requiredDate: releases.requiredDate,
      })
      .from(releases)
      .where(
        and(
          eq(releases.organizationId, organizationId),
          eq(releases.jobId, jobRecord.id),
          eq(releases.releaseNumber, targetReleaseNumber),
        ),
      )
      .limit(1)

    if (!releaseRecord) {
      return (
        <div className="mx-auto max-w-3xl space-y-4 p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            Release {targetJobNumber}-{targetReleaseNumber} Not Found
          </h1>
          <p className="text-sm text-slate-600">
            The requested release does not exist in this organization.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link href="/dashboard">
              <Button>Open Active Release</Button>
            </Link>
            <Link href="/releases">
              <Button variant="outline">View All Releases</Button>
            </Link>
          </div>
        </div>
      )
    }

    const [revisionRecord] = releaseRecord
      ? await db
          .select()
          .from(releaseRevisions)
          .where(
            and(
              eq(releaseRevisions.organizationId, organizationId),
              eq(releaseRevisions.releaseId, releaseRecord.id),
              eq(releaseRevisions.isCurrent, true),
            ),
          )
          .limit(1)
      : [null]

    // 3. Fetch Panel Marks for Revision
    const marks = revisionRecord
      ? await db
          .select()
          .from(panelMarks)
          .where(
            and(
              eq(panelMarks.organizationId, organizationId),
              eq(panelMarks.releaseRevisionId, revisionRecord.id),
            ),
          )
      : []

    // 4. Fetch Operation Definitions and Instances
    const opDefs = await db
      .select()
      .from(operationDefinitions)
      .where(eq(operationDefinitions.organizationId, organizationId))
      .orderBy(operationDefinitions.defaultSequence)

    const opInstances = revisionRecord
      ? await db
          .select()
          .from(operationInstances)
          .where(
            and(
              eq(operationInstances.organizationId, organizationId),
              eq(operationInstances.releaseRevisionId, revisionRecord.id),
            ),
          )
      : []

    // Compute department completion counts
    const departmentProgress: DepartmentStepProgress[] = opDefs.map((def) => {
      const instancesForDef = opInstances.filter(
        (inst) => inst.operationDefinitionId === def.id,
      )
      const completed = instancesForDef.reduce(
        (sum, i) => sum + i.completedQuantity,
        0,
      )
      const planned = instancesForDef.reduce(
        (sum, i) => sum + i.plannedQuantity,
        0,
      )
      const hold = instancesForDef.reduce((sum, i) => sum + i.holdQuantity, 0)
      return {
        name: def.name,
        code: def.code,
        department: def.department,
        completed,
        total:
          planned > 0 ? planned : marks.reduce((sum, m) => sum + m.quantity, 0),
        hold,
      }
    })

    // Format Panel Marks Rows
    const panelMarkRows: PanelMarkRow[] = marks.map((m) => {
      const markInstances = opInstances.filter((i) => i.panelMarkId === m.id)
      const currentInstance =
        markInstances.find(
          (i) => i.status === 'In progress' || i.status === 'Hold',
        ) || markInstances[0]

      let status: PanelMarkRow['status'] = 'Pending'
      let currentStage = 'Pending Routing'

      if (currentInstance) {
        const def = opDefs.find(
          (d) => d.id === currentInstance.operationDefinitionId,
        )
        currentStage = def ? def.name : 'Fabrication'
        if (currentInstance.status === 'Hold') status = 'QC hold'
        else if (currentInstance.status === 'Completed') status = 'Completed'
        else if (currentInstance.status === 'In progress') status = 'In progress'
        else if (currentInstance.status === 'Ready') status = 'Ready'
      }

      return {
        id: m.id,
        mark: m.mark,
        description: m.description,
        quantity: m.quantity,
        materialFamily: m.materialFamily,
        color: m.color,
        thickness: m.thickness,
        width: m.width,
        length: m.length,
        dimensionUnit: m.dimensionUnit,
        currentStage,
        status,
      }
    })

    // 5. Fetch Controlled Documents
    const docRecords =
      releaseRecord && revisionRecord
        ? await db
            .select({
              id: documents.id,
              storedFileId: documentRevisions.storedFileId,
              name: documents.name,
              classification: documentClassifications.name,
              revisionLabel: documentRevisions.revisionLabel,
              status: documentRevisions.status,
              updatedAt: documents.updatedAt,
            })
            .from(documents)
            .innerJoin(
              documentClassifications,
              eq(documents.classificationId, documentClassifications.id),
            )
            .innerJoin(
              documentRevisions,
              eq(documents.id, documentRevisions.documentId),
            )
            .where(
              and(
                eq(documents.organizationId, organizationId),
                eq(documents.releaseId, releaseRecord.id),
                eq(documentRevisions.releaseRevisionId, revisionRecord.id),
              ),
            )
        : []

    const formattedDocs: ReleaseDocumentItem[] = docRecords.map((d) => ({
      id: d.id,
      storedFileId: d.storedFileId,
      name: d.name,
      classification: d.classification,
      revisionLabel: d.revisionLabel || 'A',
      status: d.status || 'current',
      updatedAt: d.updatedAt
        ? d.updatedAt.toISOString()
        : new Date().toISOString(),
    }))

    // Blockers must come from operational records; never show demo exceptions.
    const blockers: BlockerItem[] = []

    // 7. Recent Consequential Activities Feed
    let recentActivitiesRaw: {
      id: string
      actionTitle: string
      summary: string
      actorName: string | null
      createdAt: Date | string
    }[] = []
    try {
      recentActivitiesRaw = await db
        .select({
          id: activityEvents.id,
          actionTitle: activityEvents.actionTitle,
          summary: activityEvents.summary,
          actorName: users.name,
          createdAt: activityEvents.createdAt,
        })
        .from(activityEvents)
        .leftJoin(users, eq(activityEvents.actorId, users.id))
        .where(eq(activityEvents.organizationId, organizationId))
        .orderBy(desc(activityEvents.createdAt))
        .limit(5)
    } catch (err) {
      console.error('Failed to load recent activities:', err)
    }

    const activities: ActivityItem[] = recentActivitiesRaw.map((a) => ({
      id: a.id,
      actionTitle: a.actionTitle,
      summary: a.summary,
      actorName: a.actorName || 'System',
      actorRole: 'Operations',
      timestamp: new Date(a.createdAt).toLocaleTimeString('en-US', {
        timeZone: 'America/Denver',
        hour: '2-digit',
        minute: '2-digit',
      }),
    }))

    const totalPanels = marks.reduce((sum, m) => sum + m.quantity, 0)

    return (
      <div className="mx-auto w-full max-w-[1920px] space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 1. Primary Header Banner */}
        <ReleaseHeaderBanner
          jobNumber={jobRecord.jobNumber}
          releaseNumber={
            releaseRecord ? releaseRecord.releaseNumber : targetReleaseNumber
          }
          revisionLabel={revisionRecord ? revisionRecord.revisionLabel : 'A'}
          revisionNumber={revisionRecord ? revisionRecord.revisionNumber : 1}
          customerName={jobRecord.customerName || 'N/A'}
          projectName={jobRecord.projectName || 'N/A'}
          status={
            releaseRecord ? releaseRecord.status : 'Approved for production'
          }
          priority={releaseRecord ? releaseRecord.priority : 1}
          requiredDate={releaseRecord?.requiredDate}
          plannedShipDate={jobRecord.targetShipDate}
          isCurrentRevision={revisionRecord ? revisionRecord.isCurrent : true}
        />

        {/* 2. Prominent Shop Actions Toolbar */}
        <QuickActionsToolbar
          jobNumber={jobRecord.jobNumber}
          releaseNumber={
            releaseRecord ? releaseRecord.releaseNumber : targetReleaseNumber
          }
          releaseRevisionId={revisionRecord?.id ?? null}
          userRoles={session.user.roles}
          isAdmin={session.user.isAdmin}
        />

        {/* 3. Blockers & Department Progress */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Department Execution Pipeline */}
            <DepartmentProgressTracker
              steps={departmentProgress}
              totalPanels={totalPanels}
            />

            {/* Panel Marks Table */}
            <PanelMarksTable
              marks={panelMarkRows}
              jobNumber={jobRecord.jobNumber}
              releaseNumber={
                releaseRecord ? releaseRecord.releaseNumber : targetReleaseNumber
              }
            />
          </div>

          <div className="space-y-6">
            {/* Blockers & Exceptions */}
            <BlockersExceptionsCard blockers={blockers} />

            {/* Controlled Documents & Packets */}
            <ControlledDocumentsList
              documents={formattedDocs}
              releaseRevisionId={revisionRecord?.id ?? null}
              jobNumber={jobRecord.jobNumber}
              releaseNumber={
                releaseRecord ? releaseRecord.releaseNumber : targetReleaseNumber
              }
            />

            {/* Recent Activity Ledger */}
            <ActivityStream activities={activities} />
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('DashboardPage top-level error:', error)
    return <FirstRunDashboard />
  }
}
