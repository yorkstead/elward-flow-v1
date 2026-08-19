import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/db'
import {
  releases,
  productionJobs,
  releaseRevisions,
  panelMarks,
  documents,
  documentClassifications,
} from '@/db/schema'
import { eq, or } from 'drizzle-orm'

function sanitizeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    // Look up release
    const [rel] = await db
      .select({
        releaseId: releases.id,
        releaseNumber: releases.releaseNumber,
        status: releases.status,
        priority: releases.priority,
        requiredDate: releases.requiredDate,
        jobNumber: productionJobs.jobNumber,
        jobName: productionJobs.name,
      })
      .from(releases)
      .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .where(or(eq(releases.id, id), eq(productionJobs.jobNumber, id)))
      .limit(1)

    if (!rel) {
      return NextResponse.json({ error: 'Release not found.' }, { status: 404 })
    }

    // Get current revision
    const [rev] = await db
      .select()
      .from(releaseRevisions)
      .where(eq(releaseRevisions.releaseId, rel.releaseId))
      .limit(1)

    // Get marks
    const marks = rev
      ? await db
          .select()
          .from(panelMarks)
          .where(eq(panelMarks.releaseRevisionId, rev.id))
      : []

    // Get documents
    const docs = await db
      .select({
        name: documents.name,
        category: documentClassifications.name,
      })
      .from(documents)
      .innerJoin(
        documentClassifications,
        eq(documents.classificationId, documentClassifications.id),
      )
      .where(eq(documents.releaseId, rel.releaseId))

    if (format === 'csv') {
      const headers = [
        'Job Number',
        'Release Number',
        'Revision',
        'Mark',
        'Description',
        'Quantity',
        'Material Family',
        'Color',
        'Thickness',
        'Width (in)',
        'Length (in)',
      ]

      const rows = marks.map((m) => [
        sanitizeCsv(rel.jobNumber),
        sanitizeCsv(rel.releaseNumber),
        sanitizeCsv(rev ? rev.revisionLabel : 'A'),
        sanitizeCsv(m.mark),
        sanitizeCsv(m.description),
        sanitizeCsv(m.quantity),
        sanitizeCsv(m.materialFamily),
        sanitizeCsv(m.color),
        sanitizeCsv(m.thickness),
        sanitizeCsv(m.width),
        sanitizeCsv(m.length),
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map((r) => r.join(',')),
      ].join('\n')

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Release_${rel.jobNumber}-${rel.releaseNumber}_Marks.csv"`,
        },
      })
    }

    // JSON export
    return NextResponse.json({
      job: {
        jobNumber: rel.jobNumber,
        name: rel.jobName,
      },
      release: {
        releaseNumber: rel.releaseNumber,
        key: `${rel.jobNumber}-${rel.releaseNumber}`,
        status: rel.status,
        priority: rel.priority,
        requiredDate: rel.requiredDate,
        currentRevision: rev
          ? {
              revisionNumber: rev.revisionNumber,
              revisionLabel: rev.revisionLabel,
              status: rev.status,
              isCurrent: rev.isCurrent,
              approvedAt: rev.approvedAt,
            }
          : null,
      },
      marks: marks.map((m) => ({
        mark: m.mark,
        description: m.description,
        quantity: m.quantity,
        materialFamily: m.materialFamily,
        color: m.color,
        thickness: m.thickness,
        width: m.width,
        length: m.length,
        unit: m.dimensionUnit,
      })),
      documents: docs.map((d) => ({
        name: d.name,
        category: d.category,
      })),
      exportedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Export failed.',
      },
      { status: 500 },
    )
  }
}
