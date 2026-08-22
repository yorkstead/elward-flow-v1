import JSZip from 'jszip'

export type DocumentCategoryCode =
  | 'packing_list'
  | 'cnc_layout'
  | 'cut_drawing'
  | 'assembly_drawing'
  | 'extrusion_cut_list'
  | 'accessory_list'
  | 'elevation'
  | 'shipping_info'
  | 'takeoff'
  | 'other'

export interface ClassificationRule {
  code: DocumentCategoryCode
  name: string
  patterns: RegExp[]
  description: string
  defaultDepartment: string
}

export const STANDARD_DOCUMENT_CATEGORIES: ClassificationRule[] = [
  {
    code: 'packing_list',
    name: 'Packing List',
    patterns: [
      /packing[_\-\s]*list/i,
      /pack[_\-\s]*list/i,
      /pkg[_\-\s]*list/i,
      /manifest/i,
      /delivery[_\-\s]*ticket/i,
    ],
    description: 'Release packing lists and delivery manifests',
    defaultDepartment: 'Shipping',
  },
  {
    code: 'cnc_layout',
    name: 'CNC / Table Layout',
    patterns: [
      /cnc[_\-\s]*layout/i,
      /table[_\-\s]*layout/i,
      /nest[_\-\s]*(sheet|layout|plan)?/i,
      /\.nc$/i,
      /\.nc5$/i,
      /\.tap$/i,
      /\.dxf$/i,
      /\.mpr$/i,
      /router[_\-\s]*file/i,
    ],
    description: 'CNC router nest layouts, G-code files, and table maps',
    defaultDepartment: 'CNC',
  },
  {
    code: 'extrusion_cut_list',
    name: 'Extrusion Cut List',
    patterns: [
      /extrusion[_\-\s]*(cut[_\-\s]*list|schedule)?/i,
      /elu[_\-\s]*(cut|saw|list)?/i,
      /ext[_\-\s]*cut/i,
      /saw[_\-\s]*schedule/i,
      /perimeter[_\-\s]*profile/i,
      /stiffener[_\-\s]*list/i,
    ],
    description: 'Extrusion profiles, saw schedules, and perimeter frame cuts',
    defaultDepartment: 'ELU',
  },
  {
    code: 'cut_drawing',
    name: 'Cut Drawing / Sheet',
    patterns: [
      /panel[_\-\s]*cut/i,
      /piece[_\-\s]*drawing/i,
      /cut[_\-\s]*(drawing|sheet|plan)/i,
      /flat[_\-\s]*pattern/i,
      /route[_\-\s]*and[_\-\s]*return/i,
    ],
    description: 'Individual panel flat patterns and routing cut drawings',
    defaultDepartment: 'CNC',
  },
  {
    code: 'assembly_drawing',
    name: 'Assembly Drawing',
    patterns: [
      /assembly[_\-\s]*(drawing|sheet|detail)?/i,
      /assy[_\-\s]*(dwg|drawing)?/i,
      /cross[_\-\s]*section/i,
      /detail[_\-\s]*sheet/i,
      /joint[_\-\s]*detail/i,
    ],
    description: 'Sub-assembly and finished panel fabrication drawings',
    defaultDepartment: 'Assembly',
  },
  {
    code: 'accessory_list',
    name: 'Accessory / Hardware Schedule',
    patterns: [
      /accessory[_\-\s]*(list|schedule)?/i,
      /accessories/i,
      /hardware[_\-\s]*(list|schedule)?/i,
      /fastener[_\-\s]*schedule/i,
      /clip[_\-\s]*list/i,
      /gasket[_\-\s]*schedule/i,
      /rivet[_\-\s]*schedule/i,
    ],
    description: 'Clips, fasteners, rivets, anchors, and hardware requirements',
    defaultDepartment: 'Assembly',
  },
  {
    code: 'elevation',
    name: 'Architectural Elevation / Key Plan',
    patterns: [
      /elevation/i,
      /key[_\-\s]*plan/i,
      /shop[_\-\s]*drawing/i,
      /facade/i,
      /wall[_\-\s]*elevation/i,
    ],
    description: 'Overall building elevations and panel location key plans',
    defaultDepartment: 'Drafting',
  },
  {
    code: 'shipping_info',
    name: 'Shipping / Pallet Guide',
    patterns: [
      /shipping[_\-\s]*(info|guide|plan|schedule)?/i,
      /pallet[_\-\s]*(map|guide|layout|plan)?/i,
      /crate[_\-\s]*plan/i,
      /truck[_\-\s]*load/i,
      /bol/i,
      /bill[_\-\s]*of[_\-\s]*lading/i,
    ],
    description: 'Pallet loading maps, crate guidelines, and logistics data',
    defaultDepartment: 'Shipping',
  },
  {
    code: 'takeoff',
    name: 'Panel Takeoff / Schedule',
    patterns: [
      /takeoff/i,
      /panel[_\-\s]*schedule/i,
      /bom/i,
      /bill[_\-\s]*of[_\-\s]*materials/i,
      /mark[_\-\s]*schedule/i,
    ],
    description: 'Tabular mark schedules, dimensions, and takeoff sheets',
    defaultDepartment: 'Drafting',
  },
]

export interface ClassificationResult {
  category: DocumentCategoryCode
  name: string
  confidence: number
  matchReason: string
  isUncertain: boolean
  defaultDepartment: string
}

export interface ExtractedArchiveFile {
  relativePath: string
  filename: string
  byteSize: number
  contentType: string
  buffer: Buffer
  classification: ClassificationResult
}

export class DocumentClassifier {
  private static DANGEROUS_EXTENSIONS = new Set([
    '.exe',
    '.bat',
    '.cmd',
    '.sh',
    '.ps1',
    '.vbs',
    '.js',
    '.mjs',
    '.cjs',
    '.msi',
    '.dll',
    '.com',
    '.scr',
    '.pif',
    '.jar',
  ])

  /**
   * Deterministically classifies a file by name, path, and MIME type.
   */
  public static classify(
    filename: string,
    relativePath?: string,
  ): ClassificationResult {
    const fullPath = relativePath
      ? `${relativePath}/${filename}`.toLowerCase()
      : filename.toLowerCase()

    for (const cat of STANDARD_DOCUMENT_CATEGORIES) {
      for (const pattern of cat.patterns) {
        if (pattern.test(fullPath)) {
          return {
            category: cat.code,
            name: cat.name,
            confidence: 0.95,
            matchReason: `Matched pattern '${pattern.source}' on '${filename}'`,
            isUncertain: false,
            defaultDepartment: cat.defaultDepartment,
          }
        }
      }
    }

    // Secondary heuristics based on extension
    if (filename.toLowerCase().endsWith('.pdf')) {
      return {
        category: 'cut_drawing',
        name: 'Cut Drawing / Sheet',
        confidence: 0.5,
        matchReason: 'Default fallback for unclassified PDF drawing',
        isUncertain: true,
        defaultDepartment: 'CNC',
      }
    }

    if (
      filename.toLowerCase().endsWith('.csv') ||
      filename.toLowerCase().endsWith('.xlsx')
    ) {
      return {
        category: 'takeoff',
        name: 'Panel Takeoff / Schedule',
        confidence: 0.6,
        matchReason: 'Spreadsheet format defaulted to Takeoff',
        isUncertain: true,
        defaultDepartment: 'Drafting',
      }
    }

    return {
      category: 'other',
      name: 'Unclassified Document',
      confidence: 0.2,
      matchReason: 'No deterministic rule matched filename or path',
      isUncertain: true,
      defaultDepartment: 'Drafting',
    }
  }

  /**
   * Validates material-family-specific expected document rules.
   */
  public static getExpectedCategoriesForMaterial(
    materialFamily: string,
  ): DocumentCategoryCode[] {
    const family = materialFamily.trim().toUpperCase()

    if (
      family === 'SWISSPEARL' ||
      family === 'TRESPA' ||
      family === 'HPL' ||
      family === 'FIBER_CEMENT'
    ) {
      return ['cut_drawing', 'assembly_drawing', 'accessory_list', 'elevation']
    }

    if (family === 'PLATE' || family === 'SOLID_ALUMINUM') {
      return [
        'cnc_layout',
        'cut_drawing',
        'assembly_drawing',
        'extrusion_cut_list',
        'elevation',
      ]
    }

    // Default standard ACM profile
    return [
      'cnc_layout',
      'cut_drawing',
      'assembly_drawing',
      'extrusion_cut_list',
      'elevation',
    ]
  }

  /**
   * Identifies any expected categories missing from a release package.
   */
  public static checkMissingExpectedCategories(
    materialFamily: string,
    presentCategories: DocumentCategoryCode[],
  ): { code: DocumentCategoryCode; name: string; requiredFor: string }[] {
    const expected = this.getExpectedCategoriesForMaterial(materialFamily)
    const presentSet = new Set(presentCategories)
    const missing: {
      code: DocumentCategoryCode
      name: string
      requiredFor: string
    }[] = []

    for (const reqCode of expected) {
      if (!presentSet.has(reqCode)) {
        const catInfo = STANDARD_DOCUMENT_CATEGORIES.find(
          (c) => c.code === reqCode,
        )
        missing.push({
          code: reqCode,
          name: catInfo ? catInfo.name : reqCode,
          requiredFor: `Standard ${materialFamily} release document package`,
        })
      }
    }

    return missing
  }

  /**
   * Safely extracts and verifies a ZIP archive.
   * Enforces path traversal prevention, size limits, and executable file blocks.
   */
  public static async safeExtractZip(
    zipBuffer: Buffer,
    options: {
      maxTotalBytes?: number
      maxFileBytes?: number
      maxFileCount?: number
    } = {},
  ): Promise<ExtractedArchiveFile[]> {
    const maxTotalBytes = options.maxTotalBytes ?? 500 * 1024 * 1024 // 500 MB
    const maxFileBytes = options.maxFileBytes ?? 100 * 1024 * 1024 // 100 MB
    const maxFileCount = options.maxFileCount ?? 1000

    const zip = await JSZip.loadAsync(zipBuffer)
    const files: ExtractedArchiveFile[] = []
    let totalUncompressedBytes = 0

    const entries = Object.keys(zip.files)
    if (entries.length > maxFileCount) {
      throw new Error(
        `ZIP archive contains ${entries.length} files, exceeding the limit of ${maxFileCount}.`,
      )
    }

    for (const relativePath of entries) {
      const entry = zip.files[relativePath]
      if (entry.dir) continue

      // 1. Path Traversal Prevention
      const sourcePath = entry.unsafeOriginalName ?? relativePath
      const normalizedPath = sourcePath.replace(/\\/g, '/')
      if (
        normalizedPath.includes('../') ||
        normalizedPath.startsWith('/') ||
        normalizedPath.includes('/..')
      ) {
        throw new Error(
          `Security violation: ZIP contains illegal path traversal '${relativePath}'.`,
        )
      }

      // 2. Executable / Dangerous File Blocking
      const ext = (
        normalizedPath.substring(normalizedPath.lastIndexOf('.')) || ''
      ).toLowerCase()
      if (this.DANGEROUS_EXTENSIONS.has(ext)) {
        throw new Error(
          `Security violation: ZIP contains prohibited executable file '${relativePath}'.`,
        )
      }

      // 3. Decompression & Size Verification
      const fileBuffer = await entry.async('nodebuffer')
      if (fileBuffer.byteLength > maxFileBytes) {
        throw new Error(
          `File '${relativePath}' (${fileBuffer.byteLength} bytes) exceeds the individual file size limit of ${maxFileBytes} bytes.`,
        )
      }

      totalUncompressedBytes += fileBuffer.byteLength
      if (totalUncompressedBytes > maxTotalBytes) {
        throw new Error(
          `Total uncompressed ZIP size exceeds the safety limit of ${maxTotalBytes} bytes (decompression bomb protection).`,
        )
      }

      const filename = normalizedPath.split('/').pop() ?? normalizedPath
      const contentType = this.inferContentType(filename)
      const classification = this.classify(filename, normalizedPath)

      files.push({
        relativePath: normalizedPath,
        filename,
        byteSize: fileBuffer.byteLength,
        contentType,
        buffer: fileBuffer,
        classification,
      })
    }

    return files
  }

  public static inferContentType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop()
    switch (ext) {
      case 'pdf':
        return 'application/pdf'
      case 'dxf':
        return 'application/dxf'
      case 'nc':
      case 'nc5':
      case 'tap':
      case 'mpr':
        return 'text/plain'
      case 'csv':
        return 'text/csv'
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      case 'png':
        return 'image/png'
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg'
      default:
        return 'application/octet-stream'
    }
  }
}
