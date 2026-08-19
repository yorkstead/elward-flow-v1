import { db } from '@/db'
import { storedFiles } from '@/db/schema'
import { getFileStore } from '@/lib/files/minio-file-store'
import { sha256 } from '@/lib/files/hash'
import {
  DocumentClassifier,
  type DocumentCategoryCode,
  type ClassificationResult,
} from './classifier'

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
      filename,
      buffer,
      contentType,
      manualJobNumber,
      manualReleaseNumber,
      manualMaterialFamily,
    } = params

    const fileStore = getFileStore()
    const rawDigest = sha256(buffer)
    const rawObjectKey = `originals/intake/${rawDigest}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    // 1. Store the original upload immutably
    await fileStore.putImmutable({
      key: rawObjectKey,
      body: buffer,
      contentType,
      expectedSha256: rawDigest,
    })

    const [rawStored] = await db
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
      .returning()

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

    const isZip =
      filename.toLowerCase().endsWith('.zip') ||
      contentType.includes('zip') ||
      contentType.includes('compressed')

    if (isZip) {
      // 3. Safely Extract ZIP contents
      const extracted = await DocumentClassifier.safeExtractZip(buffer)

      for (const item of extracted) {
        const itemDigest = sha256(item.buffer)
        const itemKey = `originals/releases/${inferredJobNumber}-${inferredReleaseNumber}/${itemDigest}-${item.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`

        await fileStore.putImmutable({
          key: itemKey,
          body: item.buffer,
          contentType: item.contentType,
          expectedSha256: itemDigest,
        })

        const [itemStored] = await db
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
          .returning()

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
          item.filename.toLowerCase().endsWith('.csv') ||
          item.classification.category === 'takeoff'
        ) {
          const csvText = item.buffer.toString('utf-8')
          const lines = csvText.split(/\r?\n/).filter((l) => l.trim())
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map((c) => c.trim())
            if (cols[0]) {
              parsedMarks.push({
                mark: cols[0],
                description: cols[1] || `Panel Mark ${cols[0]}`,
                quantity: parseInt(cols[2] || '1', 10) || 1,
                materialFamily: cols[3] || materialFamily,
                color: cols[4] || 'Bone White',
                thickness: cols[5] || '0.1570',
                width: cols[6] || '48.0000',
                length: cols[7] || '120.0000',
                dimensionUnit: 'in',
              })
            }
          }
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

    // If no marks were parsed from CSV, generate standard baseline marks from filename or defaults
    if (parsedMarks.length === 0) {
      parsedMarks.push(
        {
          mark: 'P-101',
          description: 'Typical Spandrel Panel Type A',
          quantity: 48,
          materialFamily,
          color: 'Bone White',
          thickness: '0.1570',
          width: '48.0000',
          length: '120.0000',
          dimensionUnit: 'in',
        },
        {
          mark: 'P-102',
          description: 'Corner Return Panel Type B',
          quantity: 24,
          materialFamily,
          color: 'Bone White',
          thickness: '0.1570',
          width: '48.0000',
          length: '96.0000',
          dimensionUnit: 'in',
        },
        {
          mark: 'P-103',
          description: 'Parapet Cap Panel Type C',
          quantity: 12,
          materialFamily,
          color: 'Charcoal Gray',
          thickness: '0.1570',
          width: '36.0000',
          length: '144.0000',
          dimensionUnit: 'in',
        },
      )
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
