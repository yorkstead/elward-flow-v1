import { db } from '@/db'
import { auditEvents, storedFiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getFileStore } from '@/lib/files/minio-file-store'
import { sha256 } from '@/lib/files/hash'
import {
  DocumentClassifier,
  type DocumentCategoryCode,
  type ClassificationResult,
} from './classifier'
import { isTakeoffCsvCandidate, parseTakeoffCsv } from './takeoff-parser'

export interface ParsedPanelMarkInput {
  mark: string
  description?: string
  quantity: number
  materialFamily: string
  color?: string
  thickness?: string
  width?: string
  length?: string
  dimensionUnit?: string
}

export interface IntakeFileItem {
  storedFileId: string
  originalName: string
  relativePath: string
  byteSize: number
  contentType: string
  sha256: string
  classification: ClassificationResult
  pageRotation?: number // 0, 90, 180, 270
}

export interface IntakePackageResult {
  rawPackageFileId: string
  rawSha256: string
  originalPackageName: string
  byteSize: number
  inferredJobNumber: string
  inferredReleaseNumber: number
  inferredRevisionLabel: string
  materialFamily: string
  customerName?: string
  projectName?: string
  files: IntakeFileItem[]
  marks: ParsedPanelMarkInput[]
  missingCategories: {
    code: DocumentCategoryCode
    name: string
    requiredFor: string
  }[]
  hasUncertainClassifications: boolean
}

export class IntakeService {
  /**
   * Processes an uploaded release package (ZIP or PDF), storing files immutably and extracting metadata.
   */
  public static async processUploadPackage(params: {
    organizationId: string
    uploadedById: string
    actingRole: string
    filename: string
    buffer: Buffer
    contentType: string
    manualJobNumber?: string
    manualReleaseNumber?: number
    manualMaterialFamily?: string
  }): Promise<IntakePackageResult> {
    const {
      organizationId,
      uploadedById,
      actingRole,
      filename,
      buffer,
      contentType,
      manualJobNumber,
      manualReleaseNumber,
      manualMaterialFamily,
    } = params

    const lowerFilename = filename.toLowerCase()
    const isZip = lowerFilename.endsWith('.zip') || contentType.includes('zip')
    const isPdf =
      lowerFilename.endsWith('.pdf') || contentType === 'application/pdf'

    if (!isZip && !isPdf) {
      throw new Error('Release package must be a ZIP archive or PDF.')
    }
    if (isZip && (buffer[0] !== 0x50 || buffer[1] !== 0x4b)) {
      throw new Error('Uploaded ZIP archive has an invalid file signature.')
    }
    if (isPdf && buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error('Uploaded PDF has an invalid file signature.')
    }

    const fileStore = getFileStore()
    const rawDigest = sha256(buffer)
    const rawObjectKey = `originals/${organizationId}/intake/${rawDigest}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    // 1. Store the original upload immutably
    await fileStore.putImmutable({
      key: rawObjectKey,
      body: buffer,
      contentType,
      expectedSha256: rawDigest,
    })

    const [insertedRawStored] = await db
      .insert(storedFiles)
      .values({
        organizationId,
        objectKey: rawObjectKey,
        originalName: filename,
        contentType,
        byteSize: buffer.byteLength,
        sha256: rawDigest,
        uploadedById,
      })
      .onConflictDoNothing({ target: storedFiles.objectKey })
      .returning()
    const rawStored =
      insertedRawStored ??
      (
        await db
          .select()
          .from(storedFiles)
          .where(eq(storedFiles.objectKey, rawObjectKey))
          .limit(1)
      )[0]
    if (!rawStored || rawStored.sha256 !== rawDigest)
      throw new Error('Stored release package metadata does not match upload.')

    // 2. Infer Job Number and Release Number from filename
    let inferredJobNumber = manualJobNumber || '54120'
    let inferredReleaseNumber = manualReleaseNumber || 1
    let inferredRevisionLabel = 'A'

    const jobMatch = filename.match(/\b(\d{5})\b/)
    if (jobMatch && !manualJobNumber) {
      inferredJobNumber = jobMatch[1]
    }

    const relMatch = filename.match(/(?:rel|release|r)[_\-\s]*(\d+)/i)
    if (relMatch && !manualReleaseNumber) {
      inferredReleaseNumber = parseInt(relMatch[1], 10)
    }

    const revMatch = filename.match(/(?:rev|revision)[_\-\s]*([a-zA-Z0-9]+)/i)
    if (revMatch) {
      inferredRevisionLabel = revMatch[1].toUpperCase()
    }

    const materialFamily = manualMaterialFamily || 'ACM'

    const processedFiles: IntakeFileItem[] = []
    const parsedMarks: ParsedPanelMarkInput[] = []

    if (isZip) {
      // 3. Safely Extract ZIP contents
      const extracted = await DocumentClassifier.safeExtractZip(buffer)

      for (const item of extracted) {
        const itemDigest = sha256(item.buffer)
        const itemKey = `originals/${organizationId}/releases/${inferredJobNumber}-${inferredReleaseNumber}/${itemDigest}-${item.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`

        await fileStore.putImmutable({
          key: itemKey,
          body: item.buffer,
          contentType: item.contentType,
          expectedSha256: itemDigest,
        })

        const [insertedItemStored] = await db
          .insert(storedFiles)
          .values({
            organizationId,
            objectKey: itemKey,
            originalName: item.filename,
            contentType: item.contentType,
            byteSize: item.byteSize,
            sha256: itemDigest,
            uploadedById,
          })
          .onConflictDoNothing({ target: storedFiles.objectKey })
          .returning()
        const itemStored =
          insertedItemStored ??
          (
            await db
              .select()
              .from(storedFiles)
              .where(eq(storedFiles.objectKey, itemKey))
              .limit(1)
          )[0]
        if (!itemStored || itemStored.sha256 !== itemDigest)
          throw new Error(
            `Stored metadata for '${item.filename}' does not match upload.`,
          )

        processedFiles.push({
          storedFileId: itemStored.id,
          originalName: item.filename,
          relativePath: item.relativePath,
          byteSize: item.byteSize,
          contentType: item.contentType,
          sha256: itemDigest,
          classification: item.classification,
          pageRotation: 0,
        })

        // Check if file is a CSV takeoff schedule
        if (
          isTakeoffCsvCandidate({
            filename: item.filename,
            category: item.classification.category,
            isUncertain: item.classification.isUncertain,
          })
        ) {
          parsedMarks.push(
            ...parseTakeoffCsv({
              csvText: item.buffer.toString('utf-8'),
              filename: item.filename,
              defaultMaterialFamily: materialFamily,
            }),
          )
        }
      }
    } else {
      // Single PDF drawing upload
      const singleClassification = DocumentClassifier.classify(filename)
      processedFiles.push({
        storedFileId: rawStored.id,
        originalName: filename,
        relativePath: filename,
        byteSize: buffer.byteLength,
        contentType,
        sha256: rawDigest,
        classification: singleClassification,
        pageRotation: 0,
      })
    }

    const uniqueMarks = new Set<string>()
    for (const mark of parsedMarks) {
      const normalizedMark = mark.mark.toUpperCase()
      if (uniqueMarks.has(normalizedMark)) {
        throw new Error(`Duplicate panel mark '${mark.mark}' in takeoff data.`)
      }
      uniqueMarks.add(normalizedMark)
    }

    // Check missing expected document categories
    const presentCategories = processedFiles.map(
      (f) => f.classification.category,
    )
    const missingCategories = DocumentClassifier.checkMissingExpectedCategories(
      materialFamily,
      presentCategories,
    )

    const hasUncertainClassifications = processedFiles.some(
      (f) => f.classification.isUncertain,
    )

    await db.insert(auditEvents).values({
      organizationId,
      actorId: uploadedById,
      actingRole,
      action: 'RELEASE_PACKAGE_INGESTED',
      resourceType: 'stored_file',
      resourceId: rawStored.id,
      newState: {
        originalPackageName: filename,
        sha256: rawDigest,
        jobNumber: inferredJobNumber,
        releaseNumber: inferredReleaseNumber,
        documentCount: processedFiles.length,
        markCount: parsedMarks.length,
      },
      quantity: String(processedFiles.length),
      condition: hasUncertainClassifications ? 'needs_review' : 'classified',
      sourceRevision: inferredRevisionLabel,
      reason: 'Authenticated release intake upload',
    })

    return {
      rawPackageFileId: rawStored.id,
      rawSha256: rawDigest,
      originalPackageName: filename,
      byteSize: buffer.byteLength,
      inferredJobNumber,
      inferredReleaseNumber,
      inferredRevisionLabel,
      materialFamily,
      files: processedFiles,
      marks: parsedMarks,
      missingCategories,
      hasUncertainClassifications,
    }
  }
}
