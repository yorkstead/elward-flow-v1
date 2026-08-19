import JSZip from 'jszip'
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import { db } from '@/db'
import {
  productionJobs,
  releases,
  releaseRevisions,
  documents,
  documentRevisions,
  documentClassifications,
  storedFiles,
} from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getFileStore } from '@/lib/files/minio-file-store'
import { sha256 } from '@/lib/files/hash'

export type DepartmentPacketType =
  'complete' | 'cnc' | 'elu' | 'assembly' | 'qc' | 'shipping'

export interface PacketDefinition {
  type: DepartmentPacketType
  title: string
  department: string
  includedCategories: string[]
  description: string
}

export const DEPARTMENT_PACKET_DEFINITIONS: Record<
  DepartmentPacketType,
  PacketDefinition
> = {
  complete: {
    type: 'complete',
    title: 'Complete Department Release Packet',
    department: 'All Departments',
    includedCategories: [
      'packing_list',
      'cnc_layout',
      'cut_drawing',
      'assembly_drawing',
      'extrusion_cut_list',
      'accessory_list',
      'elevation',
      'shipping_info',
      'takeoff',
      'other',
    ],
    description:
      'Master package containing all controlled drawings and specifications',
  },
  cnc: {
    type: 'cnc',
    title: 'CNC Routing Execution Packet',
    department: 'CNC',
    includedCategories: ['cnc_layout', 'cut_drawing', 'elevation', 'takeoff'],
    description:
      'Table nest layouts, G-code references, and cut drawing sheets',
  },
  elu: {
    type: 'elu',
    title: 'ELU Extrusions & Saw Packet',
    department: 'ELU',
    includedCategories: ['extrusion_cut_list', 'cut_drawing', 'takeoff'],
    description:
      'Extrusion cut lists, perimeter frame schedules, and stiffeners',
  },
  assembly: {
    type: 'assembly',
    title: 'Assembly & Parts Packet',
    department: 'Assembly',
    includedCategories: [
      'assembly_drawing',
      'accessory_list',
      'elevation',
      'cut_drawing',
    ],
    description:
      'Assembly drawings, fastener schedules, and fabrication details',
  },
  qc: {
    type: 'qc',
    title: 'Quality Control Inspection Packet',
    department: 'QC',
    includedCategories: [
      'assembly_drawing',
      'cut_drawing',
      'elevation',
      'packing_list',
    ],
    description:
      'Inspection standards, critical dimensions, and assembly tolerances',
  },
  shipping: {
    type: 'shipping',
    title: 'Shipping & Packaging Packet',
    department: 'Shipping',
    includedCategories: [
      'packing_list',
      'shipping_info',
      'elevation',
      'accessory_list',
    ],
    description: 'Packing lists, pallet elevation maps, and delivery manifests',
  },
}

export class PacketGeneratorService {
  /**
   * Generates a merged, controlled PDF packet with cover page and dynamic watermark.
   */
  public static async generatePacketPdf(params: {
    releaseRevisionId: string
    packetType: DepartmentPacketType
    generationVersion?: number
  }): Promise<{
    buffer: Buffer
    byteSize: number
    sha256: string
    filename: string
  }> {
    const { releaseRevisionId, packetType, generationVersion = 1 } = params
    const packetDef = DEPARTMENT_PACKET_DEFINITIONS[packetType]

    // Fetch revision, release, job, and documents
    const [rev] = await db
      .select({
        revisionId: releaseRevisions.id,
        revisionNumber: releaseRevisions.revisionNumber,
        revisionLabel: releaseRevisions.revisionLabel,
        isCurrent: releaseRevisions.isCurrent,
        status: releaseRevisions.status,
        releaseNumber: releases.releaseNumber,
        jobNumber: productionJobs.jobNumber,
        jobName: productionJobs.name,
      })
      .from(releaseRevisions)
      .innerJoin(releases, eq(releaseRevisions.releaseId, releases.id))
      .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .where(eq(releaseRevisions.id, releaseRevisionId))
      .limit(1)

    if (!rev) {
      throw new Error(`Release revision '${releaseRevisionId}' not found.`)
    }

    const docItems = await db
      .select({
        docId: documents.id,
        docName: documents.name,
        categoryCode: documentClassifications.code,
        categoryName: documentClassifications.name,
        storedFileId: storedFiles.id,
        objectKey: storedFiles.objectKey,
        contentType: storedFiles.contentType,
      })
      .from(documentRevisions)
      .innerJoin(documents, eq(documentRevisions.documentId, documents.id))
      .innerJoin(
        documentClassifications,
        eq(documents.classificationId, documentClassifications.id),
      )
      .innerJoin(
        storedFiles,
        eq(documentRevisions.storedFileId, storedFiles.id),
      )
      .where(eq(documentRevisions.revisionLabel, rev.revisionLabel))

    const filteredDocs = docItems.filter((d) =>
      packetDef.includedCategories.includes(d.categoryCode),
    )

    const fileStore = getFileStore()
    const mergedPdf = await PDFDocument.create()
    const fontBold = await mergedPdf.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await mergedPdf.embedFont(StandardFonts.Helvetica)

    // 1. Generate Cover Sheet Page
    const coverPage = mergedPdf.addPage([612, 792]) // Standard US Letter Portrait
    const { width, height } = coverPage.getSize()

    // Header banner
    coverPage.drawRectangle({
      x: 0,
      y: height - 100,
      width,
      height: 100,
      color: rgb(0.06, 0.09, 0.16), // Dark Slate
    })

    coverPage.drawText('ELWARD SYSTEMS CORPORATION', {
      x: 50,
      y: height - 45,
      size: 14,
      font: fontBold,
      color: rgb(0.9, 0.95, 1.0),
    })

    coverPage.drawText('CONTROLLED MANUFACTURING RELEASE PACKET', {
      x: 50,
      y: height - 65,
      size: 10,
      font: fontRegular,
      color: rgb(0.58, 0.65, 0.75),
    })

    // Packet Title & Meta
    coverPage.drawText(packetDef.title.toUpperCase(), {
      x: 50,
      y: height - 150,
      size: 18,
      font: fontBold,
      color: rgb(0.06, 0.09, 0.16),
    })

    coverPage.drawText(`Department: ${packetDef.department}`, {
      x: 50,
      y: height - 175,
      size: 12,
      font: fontBold,
      color: rgb(0.15, 0.39, 0.92), // Blue
    })

    const metadataBoxY = height - 340
    coverPage.drawRectangle({
      x: 50,
      y: metadataBoxY,
      width: width - 100,
      height: 140,
      color: rgb(0.96, 0.97, 0.98),
      borderColor: rgb(0.85, 0.88, 0.92),
      borderWidth: 1,
    })

    coverPage.drawText(`Job Number: ${rev.jobNumber}`, {
      x: 70,
      y: metadataBoxY + 110,
      size: 11,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    })

    coverPage.drawText(
      `Release Number: ${rev.releaseNumber} (Key: ${rev.jobNumber}-${rev.releaseNumber})`,
      {
        x: 70,
        y: metadataBoxY + 85,
        size: 11,
        font: fontBold,
        color: rgb(0.1, 0.15, 0.25),
      },
    )

    coverPage.drawText(
      `Revision: Rev ${rev.revisionNumber} (${rev.revisionLabel})`,
      {
        x: 70,
        y: metadataBoxY + 60,
        size: 11,
        font: fontBold,
        color: rgb(0.1, 0.15, 0.25),
      },
    )

    coverPage.drawText(`Project: ${rev.jobName}`, {
      x: 70,
      y: metadataBoxY + 35,
      size: 10,
      font: fontRegular,
      color: rgb(0.3, 0.35, 0.45),
    })

    coverPage.drawText(
      `Status: ${rev.isCurrent ? 'CURRENT APPROVED' : 'SUPERSEDED'} • Generated: ${new Date().toISOString()}`,
      {
        x: 70,
        y: metadataBoxY + 12,
        size: 9,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.55),
      },
    )

    // Document Table of Contents
    coverPage.drawText('INCLUDED CONTROLLED DOCUMENTS', {
      x: 50,
      y: height - 375,
      size: 11,
      font: fontBold,
      color: rgb(0.06, 0.09, 0.16),
    })

    let listY = height - 400
    for (const doc of filteredDocs.slice(0, 10)) {
      coverPage.drawText(`• [${doc.categoryName}] ${doc.docName}`, {
        x: 60,
        y: listY,
        size: 10,
        font: fontRegular,
        color: rgb(0.2, 0.25, 0.35),
      })
      listY -= 20
    }

    if (filteredDocs.length === 0) {
      coverPage.drawText(
        'No specific standalone drawings attached to this category.',
        {
          x: 60,
          y: listY,
          size: 10,
          font: fontRegular,
          color: rgb(0.5, 0.55, 0.65),
        },
      )
    }

    // 2. Append PDF Documents
    for (const doc of filteredDocs) {
      if (doc.contentType === 'application/pdf') {
        try {
          const fileData = await fileStore.get(doc.objectKey)
          const docPdf = await PDFDocument.load(fileData.body)
          const copiedPages = await mergedPdf.copyPages(
            docPdf,
            docPdf.getPageIndices(),
          )

          for (const page of copiedPages) {
            mergedPdf.addPage(page)
          }
        } catch {
          // If a file cannot be loaded as PDF (e.g. mock data), continue
        }
      }
    }

    // 3. Stamp Watermark & Headers on every page
    const totalPages = mergedPdf.getPageCount()
    for (let i = 0; i < totalPages; i++) {
      const page = mergedPdf.getPage(i)
      const { width: pWidth, height: pHeight } = page.getSize()

      // Header stamp
      page.drawText(
        `ELWARD FLOW CONTROLLED DOCUMENT — Job ${rev.jobNumber}-${rev.releaseNumber} Rev ${rev.revisionNumber} (${rev.revisionLabel}) — Sheet ${i + 1} of ${totalPages}`,
        {
          x: 40,
          y: pHeight - 20,
          size: 8,
          font: fontBold,
          color: rgb(0.4, 0.45, 0.55),
        },
      )

      // If Superseded: Stamp large prominent diagonal watermark
      if (!rev.isCurrent || rev.status === 'Superseded') {
        page.drawText('SUPERSEDED — NOT FOR PRODUCTION', {
          x: pWidth / 2 - 200,
          y: pHeight / 2 - 50,
          size: 32,
          font: fontBold,
          color: rgb(0.9, 0.1, 0.1),
          opacity: 0.35,
          rotate: degrees(35),
        })
      }
    }

    const pdfBytes = await mergedPdf.save()
    const pdfBuffer = Buffer.from(pdfBytes)
    const digest = sha256(pdfBuffer)
    const filename = `${rev.jobNumber}-${rev.releaseNumber}_Rev_${rev.revisionLabel}_${packetType.toUpperCase()}_Packet_v${generationVersion}.pdf`

    return {
      buffer: pdfBuffer,
      byteSize: pdfBuffer.byteLength,
      sha256: digest,
      filename,
    }
  }

  /**
   * Generates a multi-document ZIP archive packet with manifest and drawings.
   */
  public static async generatePacketZip(params: {
    releaseRevisionId: string
    packetType: DepartmentPacketType
    generationVersion?: number
  }): Promise<{
    buffer: Buffer
    byteSize: number
    sha256: string
    filename: string
  }> {
    const { releaseRevisionId, packetType, generationVersion = 1 } = params
    const packetDef = DEPARTMENT_PACKET_DEFINITIONS[packetType]

    const [rev] = await db
      .select({
        revisionId: releaseRevisions.id,
        revisionNumber: releaseRevisions.revisionNumber,
        revisionLabel: releaseRevisions.revisionLabel,
        isCurrent: releaseRevisions.isCurrent,
        status: releaseRevisions.status,
        releaseNumber: releases.releaseNumber,
        jobNumber: productionJobs.jobNumber,
        jobName: productionJobs.name,
      })
      .from(releaseRevisions)
      .innerJoin(releases, eq(releaseRevisions.releaseId, releases.id))
      .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .where(eq(releaseRevisions.id, releaseRevisionId))
      .limit(1)

    if (!rev) {
      throw new Error(`Release revision '${releaseRevisionId}' not found.`)
    }

    const docItems = await db
      .select({
        docId: documents.id,
        docName: documents.name,
        categoryCode: documentClassifications.code,
        categoryName: documentClassifications.name,
        storedFileId: storedFiles.id,
        objectKey: storedFiles.objectKey,
        contentType: storedFiles.contentType,
        originalName: storedFiles.originalName,
      })
      .from(documentRevisions)
      .innerJoin(documents, eq(documentRevisions.documentId, documents.id))
      .innerJoin(
        documentClassifications,
        eq(documents.classificationId, documentClassifications.id),
      )
      .innerJoin(
        storedFiles,
        eq(documentRevisions.storedFileId, storedFiles.id),
      )
      .where(eq(documentRevisions.revisionLabel, rev.revisionLabel))

    const filteredDocs = docItems.filter((d) =>
      packetDef.includedCategories.includes(d.categoryCode),
    )

    const fileStore = getFileStore()
    const zip = new JSZip()

    // 1. Manifest text file
    let manifestText = `=================================================================\n`
    manifestText += `ELWARD FLOW CONTROLLED DEPARTMENT PACKET\n`
    manifestText += `=================================================================\n`
    manifestText += `Job Number:        ${rev.jobNumber}\n`
    manifestText += `Release Number:    ${rev.releaseNumber} (Key: ${rev.jobNumber}-${rev.releaseNumber})\n`
    manifestText += `Revision:          Rev ${rev.revisionNumber} (${rev.revisionLabel})\n`
    manifestText += `Packet Type:       ${packetDef.title} (${packetDef.department})\n`
    manifestText += `Status:            ${rev.isCurrent ? 'CURRENT APPROVED' : 'SUPERSEDED - NOT FOR PRODUCTION'}\n`
    manifestText += `Generation Ver:    v${generationVersion}\n`
    manifestText += `Generated Date:    ${new Date().toISOString()}\n\n`
    manifestText += `INCLUDED FILES (${filteredDocs.length}):\n`

    for (const doc of filteredDocs) {
      manifestText += `- [${doc.categoryName}] ${doc.originalName}\n`
      try {
        const fileData = await fileStore.get(doc.objectKey)
        const subfolder = doc.categoryCode.toUpperCase()
        zip.file(`${subfolder}/${doc.originalName}`, fileData.body)
      } catch {
        // Continue if source file is missing
      }
    }

    zip.file('RELEASE_MANIFEST.txt', manifestText)

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })

    const digest = sha256(zipBuffer)
    const filename = `${rev.jobNumber}-${rev.releaseNumber}_Rev_${rev.revisionLabel}_${packetType.toUpperCase()}_Bundle_v${generationVersion}.zip`

    return {
      buffer: zipBuffer,
      byteSize: zipBuffer.byteLength,
      sha256: digest,
      filename,
    }
  }
}
