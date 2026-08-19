import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  PacketGeneratorService,
  type DepartmentPacketType,
} from '@/lib/services/packet-generator'
import { db } from '@/db'
import { releaseRevisions } from '@/db/schema'
import { eq, or } from 'drizzle-orm'
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
    const packetType = type as DepartmentPacketType
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'pdf'

    // Look up revision (id can be revision ID or release ID)
    let [rev] = await db
      .select({ id: releaseRevisions.id })
      .from(releaseRevisions)
      .where(eq(releaseRevisions.id, id))
      .limit(1)

    if (!rev) {
      // Try resolving as release ID -> active revision
      const [activeRev] = await db
        .select({ id: releaseRevisions.id })
        .from(releaseRevisions)
        .where(
          or(
            eq(releaseRevisions.releaseId, id),
            eq(releaseRevisions.isCurrent, true),
          ),
        )
        .limit(1)
      rev = activeRev
    }

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
