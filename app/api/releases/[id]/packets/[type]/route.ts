import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  PacketGeneratorService,
  type DepartmentPacketType,
} from '@/lib/services/packet-generator'
import { db } from '@/db'
import { releaseRevisions } from '@/db/schema'
import { and, eq, or } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; type: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, type } = await params
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      return NextResponse.json(
        { error: 'A valid release or revision identifier is required.' },
        { status: 400 },
      )
    }
    const packetType = type as DepartmentPacketType
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'pdf'

    // Resolve either a revision ID or a release ID within the signed-in organization.
    const [rev] = await db
      .select({ id: releaseRevisions.id })
      .from(releaseRevisions)
      .where(
        and(
          eq(releaseRevisions.organizationId, session.user.organizationId),
          or(
            eq(releaseRevisions.id, id),
            and(
              eq(releaseRevisions.releaseId, id),
              eq(releaseRevisions.isCurrent, true),
            ),
          ),
        ),
      )
      .limit(1)

    if (!rev) {
      return NextResponse.json(
        { error: 'Release revision not found.' },
        { status: 404 },
      )
    }

    if (format === 'zip') {
      const zipData = await PacketGeneratorService.generatePacketZip({
        releaseRevisionId: rev.id,
        packetType,
      })

      return new NextResponse(new Uint8Array(zipData.buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${zipData.filename}"`,
          'Content-Length': zipData.byteSize.toString(),
          'X-Sha256-Checksum': zipData.sha256,
        },
      })
    }

    // Default to merged controlled PDF
    const pdfData = await PacketGeneratorService.generatePacketPdf({
      releaseRevisionId: rev.id,
      packetType,
    })

    return new NextResponse(new Uint8Array(pdfData.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${pdfData.filename}"`,
        'Content-Length': pdfData.byteSize.toString(),
        'X-Sha256-Checksum': pdfData.sha256,
      },
    })
  } catch (error) {
    logger.error('Packet generation failed', { error: String(error) })
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Packet generation failed.',
      },
      { status: 500 },
    )
  }
}
