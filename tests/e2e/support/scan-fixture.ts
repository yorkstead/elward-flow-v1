import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import {
  users,
  customers,
  projects,
  productionJobs,
  releases,
  releaseRevisions,
  panelMarks,
  operationDefinitions,
  operationInstances,
} from '@/db/schema'

export async function createScanFixture() {
  if (
    !['localhost', '127.0.0.1'].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw new Error('Browser fixtures require a local test database')
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, process.env.ADMIN_EMAIL || 'admin@example.test'))
    .limit(1)
  if (!user) throw new Error('Seed the synthetic administrator first')
  const organizationId = user.organizationId
  let [job] = await db
    .select()
    .from(productionJobs)
    .where(
      and(
        eq(productionJobs.organizationId, organizationId),
        eq(productionJobs.jobNumber, '99882'),
      ),
    )
  if (!job) {
    const [customer] = await db
      .insert(customers)
      .values({ organizationId, name: 'Synthetic scanner test customer' })
      .returning()
    const [project] = await db
      .insert(projects)
      .values({
        organizationId,
        customerId: customer.id,
        name: 'Synthetic scanner test project',
      })
      .returning()
    ;[job] = await db
      .insert(productionJobs)
      .values({
        organizationId,
        customerId: customer.id,
        projectId: project.id,
        jobNumber: '99882',
        name: 'Synthetic scanner test job',
      })
      .returning()
  }
  const suffix = crypto.randomUUID().slice(0, 8)
  const [release] = await db
    .insert(releases)
    .values({
      organizationId,
      jobId: job.id,
      releaseNumber: Math.floor(Math.random() * 2_000_000_000) + 1,
    })
    .returning()
  const [current, obsolete] = await db
    .insert(releaseRevisions)
    .values([
      {
        organizationId,
        releaseId: release.id,
        revisionNumber: 1,
        revisionLabel: 'A',
        isCurrent: true,
        status: 'Approved',
      },
      {
        organizationId,
        releaseId: release.id,
        revisionNumber: 0,
        revisionLabel: 'PRELIM',
        isCurrent: false,
        status: 'Superseded',
      },
    ])
    .returning()
  const [elu, qc] = await db
    .insert(operationDefinitions)
    .values([
      {
        organizationId,
        code: `E2E-ELU-${suffix}`,
        name: 'Synthetic ELU',
        department: 'ELU',
      },
      {
        organizationId,
        code: `E2E-QC-${suffix}`,
        name: 'Synthetic QC',
        department: 'QC',
      },
    ])
    .returning()
  const names = {
    elu: `TEST-ELU-${suffix}`,
    qc: `TEST-QC-${suffix}`,
    obsolete: `TEST-OLD-${suffix}`,
  }
  const [eluMark, qcMark] = await db
    .insert(panelMarks)
    .values([
      {
        organizationId,
        releaseRevisionId: current.id,
        mark: names.elu,
        materialFamily: 'Synthetic',
        quantity: 5,
      },
      {
        organizationId,
        releaseRevisionId: current.id,
        mark: names.qc,
        materialFamily: 'Synthetic',
        quantity: 5,
      },
      {
        organizationId,
        releaseRevisionId: obsolete.id,
        mark: names.obsolete,
        materialFamily: 'Synthetic',
        quantity: 5,
      },
    ])
    .returning()
  await db.insert(operationInstances).values([
    {
      organizationId,
      releaseRevisionId: current.id,
      panelMarkId: eluMark.id,
      operationDefinitionId: elu.id,
      sequence: 1,
      status: 'In progress',
      plannedQuantity: 5,
    },
    {
      organizationId,
      releaseRevisionId: current.id,
      panelMarkId: qcMark.id,
      operationDefinitionId: qc.id,
      sequence: 1,
      status: 'In progress',
      plannedQuantity: 5,
    },
  ])
  return names
}
