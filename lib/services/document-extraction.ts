import { z } from 'zod'

export const ExtractedPanelSourceSchema = z.object({
  documentId: z.string().optional(),
  documentName: z.string().optional(),
  documentType: z.enum([
    'SHOP_DRAWING',
    'ELEVATION_MATRIX',
    'TAKEOFF',
    'CUT_DRAWING',
    'ASSEMBLY_DRAWING',
    'OTHER',
  ]),
  page: z.number().int().positive().nullable().optional(),
  rawText: z.string().optional(),
})

export const ExtractedPanelSchema = z.object({
  mark: z.string().min(1),
  description: z.string().optional(),
  elevations: z.array(z.string()).default([]),
  primaryElevation: z.string().optional(),
  materialFamily: z.string().nullable().optional(),
  materialVariant: z.string().optional(),
  color: z.string().optional(),
  widthInches: z.number().positive().nullable().optional(),
  lengthInches: z.number().positive().nullable().optional(),
  thicknessInches: z.number().positive().nullable().optional(),
  quantity: z.number().int().positive().default(1),
  unitWeightLbs: z.number().positive().optional(),
  source: ExtractedPanelSourceSchema,
  confidence: z.number().min(0).max(1).default(0.95),
  warnings: z.array(z.string()).default([]),
})

export type ExtractedPanel = z.infer<typeof ExtractedPanelSchema>

export const ExtractedElevationMatrixSchema = z.object({
  releaseNumber: z.number().int().optional(),
  jobNumber: z.string().optional(),
  elevations: z.array(
    z.object({
      name: z.string(),
      code: z.string().optional(),
      panelMarks: z.array(z.string()),
    }),
  ),
  panels: z.array(ExtractedPanelSchema),
  confidence: z.number().min(0).max(1).default(0.9),
  sourceDocumentName: z.string().optional(),
  pageCount: z.number().int().optional(),
})

export type ExtractedElevationMatrix = z.infer<
  typeof ExtractedElevationMatrixSchema
>

export class DocumentExtractionService {
  /**
   * Parses structured AI / Gemini or parser JSON output safely against Zod schema.
   */
  public static validateExtractionResponse(
    rawJson: unknown,
  ): ExtractedElevationMatrix {
    const parsed = ExtractedElevationMatrixSchema.safeParse(rawJson)
    if (!parsed.success) {
      throw new Error(
        `AI Document Extraction Schema Validation Error: ${parsed.error.message}`,
      )
    }
    return parsed.data
  }

  /**
   * Reconciles mark-to-elevation mapping from multiple document sources
   * (e.g. CSV takeoff + elevation matrix drawings).
   */
  public static reconcileMarksAndElevations(params: {
    takeoffMarks: {
      mark: string
      quantity: number
      materialFamily: string
      color?: string
      width?: string
      length?: string
      thickness?: string
    }[]
    elevationExtractions?: ExtractedPanel[]
  }): {
    mark: string
    quantity: number
    materialFamily: string
    color?: string
    widthInches: number
    lengthInches: number
    thicknessInches?: number
    elevation: string
    elevationNames: string[]
    sourceProvenance?: {
      documentId?: string
      documentName?: string
      documentType?:
        | 'SHOP_DRAWING'
        | 'ELEVATION_MATRIX'
        | 'TAKEOFF'
        | 'CUT_DRAWING'
        | 'ASSEMBLY_DRAWING'
        | 'OTHER'
      page?: number
      confidence?: number
    }
    confidence: number
  }[] {
    const { takeoffMarks, elevationExtractions = [] } = params
    const extractionMap = new Map<string, ExtractedPanel>()

    for (const item of elevationExtractions) {
      extractionMap.set(item.mark.trim().toUpperCase(), item)
    }

    return takeoffMarks.map((tm) => {
      const markKey = tm.mark.trim().toUpperCase()
      const extracted = extractionMap.get(markKey)

      const elevationNames =
        extracted?.elevations && extracted.elevations.length > 0
          ? extracted.elevations
          : [extracted?.primaryElevation || 'General Elevation']

      const primaryElevation =
        extracted?.primaryElevation || elevationNames[0] || 'General Elevation'

      const widthInches = tm.width
        ? parseFloat(tm.width)
        : extracted?.widthInches || 48
      const lengthInches = tm.length
        ? parseFloat(tm.length)
        : extracted?.lengthInches || 120
      const thicknessInches = tm.thickness
        ? parseFloat(tm.thickness)
        : extracted?.thicknessInches || 0.157

      return {
        mark: tm.mark,
        quantity: tm.quantity,
        materialFamily: tm.materialFamily || extracted?.materialFamily || 'ACM',
        color: tm.color || extracted?.color || 'Bone White',
        widthInches: Number.isFinite(widthInches) ? widthInches : 48,
        lengthInches: Number.isFinite(lengthInches) ? lengthInches : 120,
        thicknessInches: Number.isFinite(thicknessInches)
          ? thicknessInches
          : 0.157,
        elevation: primaryElevation,
        elevationNames,
        sourceProvenance: extracted?.source
          ? {
              documentId: extracted.source.documentId,
              documentName: extracted.source.documentName,
              documentType: extracted.source.documentType,
              page: extracted.source.page ?? undefined,
              confidence: extracted.confidence,
            }
          : {
              documentType: 'TAKEOFF',
              confidence: 1.0,
            },
        confidence: extracted?.confidence ?? 0.95,
      }
    })
  }
}
