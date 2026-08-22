import type { ParsedPanelMarkInput } from './intake'

const HEADER_ALIASES = {
  mark: ['mark', 'mark id', 'panel mark', 'esc mark number'],
  description: ['description', 'family'],
  quantity: ['quantity', 'qty', 'count'],
  materialFamily: ['materialfamily', 'material family'],
  color: ['color', 'colour', 'finish', 'material'],
  thickness: ['thickness', 'material thickness', 'material thickness mm'],
  width: ['width', 'stretch out width'],
  length: ['length', 'height', 'stretch out height'],
} as const

export function isTakeoffCsvCandidate(input: {
  filename: string
  category: string
  isUncertain: boolean
}) {
  return (
    input.filename.toLowerCase().endsWith('.csv') &&
    input.category === 'takeoff' &&
    !input.isUncertain &&
    !/^error[_\-\s]*log\b/i.test(input.filename)
  )
}

export interface TakeoffCsvFileInput {
  filename: string
  csvText: string
  category: string
  isUncertain: boolean
}

function scheduleLabel(filename: string) {
  return filename
    .match(/\(([^)]+)\)/)?.[1]
    ?.trim()
    .toUpperCase()
}

function isCompactSchedule(filename: string) {
  return /\)[_\s-]*clean(?:_|\.)/i.test(filename)
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < csvText.length; index++) {
    const character = csvText[index]
    if (character === '"') {
      if (quoted && csvText[index + 1] === '"') {
        field += '"'
        index++
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      row.push(field.trim())
      field = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && csvText[index + 1] === '\n') index++
      row.push(field.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }

  row.push(field.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
}

function findColumn(headers: string[], aliases: readonly string[]) {
  return headers.findIndex((header) => aliases.includes(header))
}

export function parseTakeoffCsv(params: {
  csvText: string
  filename: string
  defaultMaterialFamily: string
}): ParsedPanelMarkInput[] {
  const rows = parseCsvRows(params.csvText)
  const headerRowIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader)
    return (
      findColumn(headers, HEADER_ALIASES.mark) >= 0 &&
      findColumn(headers, HEADER_ALIASES.quantity) >= 0
    )
  })
  if (headerRowIndex < 0) {
    const isJadeClean = isCompactSchedule(params.filename)
    const hasValidJadeCleanShape =
      rows.length > 0 &&
      rows.every(
        (row) =>
          row.length === 5 &&
          row[0]?.trim() &&
          Number.isInteger(Number(row[1])) &&
          Number(row[1]) >= 1 &&
          Number.isFinite(Number(row[2])) &&
          Number.isFinite(Number(row[3])) &&
          Number.isFinite(Number(row[4])),
      )
    if (isJadeClean && hasValidJadeCleanShape) {
      return rows.map((row) => ({
        mark: row[0].replace(/^\uFEFF/, '').trim(),
        description: `Panel Mark ${row[0].replace(/^\uFEFF/, '').trim()}`,
        quantity: Number(row[1]),
        materialFamily: params.defaultMaterialFamily,
        width: row[3].trim(),
        length: row[2].trim(),
        dimensionUnit: 'in',
      }))
    }
    throw new Error(
      `Takeoff '${params.filename}' must include recognizable mark and quantity columns.`,
    )
  }

  const headers = rows[headerRowIndex].map(normalizeHeader)
  const columns = Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([key, aliases]) => [
      key,
      findColumn(headers, aliases),
    ]),
  ) as Record<keyof typeof HEADER_ALIASES, number>
  const thicknessIsMillimeters =
    headers[columns.thickness] === 'material thickness mm'

  return rows.slice(headerRowIndex + 1).flatMap((values) => {
    const mark = values[columns.mark]?.trim()
    if (!mark) return []

    const quantity = Number(values[columns.quantity])
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(
        `Takeoff '${params.filename}' has an invalid quantity for mark '${mark}'.`,
      )
    }

    const get = (column: number) =>
      column >= 0 ? values[column]?.trim() || undefined : undefined
    const rawThickness = get(columns.thickness)
    const thickness =
      thicknessIsMillimeters && rawThickness
        ? (Number(rawThickness) / 25.4).toFixed(4)
        : rawThickness

    if (
      thicknessIsMillimeters &&
      rawThickness &&
      !Number.isFinite(Number(rawThickness))
    ) {
      throw new Error(
        `Takeoff '${params.filename}' has an invalid thickness for mark '${mark}'.`,
      )
    }

    return [
      {
        mark,
        description: get(columns.description) || `Panel Mark ${mark}`,
        quantity,
        materialFamily:
          get(columns.materialFamily) || params.defaultMaterialFamily,
        color: get(columns.color) || 'Bone White',
        thickness: thickness || '0.1570',
        width: get(columns.width) || '48.0000',
        length: get(columns.length) || '120.0000',
        dimensionUnit: 'in',
      },
    ]
  })
}

export function parseTakeoffCsvFiles(params: {
  files: TakeoffCsvFileInput[]
  defaultMaterialFamily: string
}): ParsedPanelMarkInput[] {
  const candidates = params.files.filter(isTakeoffCsvCandidate)
  const grouped = new Map<
    string,
    { label?: string; files: TakeoffCsvFileInput[] }
  >()

  for (const file of candidates) {
    const label = scheduleLabel(file.filename)
    const key = label || file.filename.toLowerCase()
    const group = grouped.get(key) || { label, files: [] }
    group.files.push(file)
    grouped.set(key, group)
  }

  const parsedGroups = [...grouped.values()].map((group) => {
    const orderedFiles = [...group.files].sort(
      (left, right) =>
        Number(isCompactSchedule(left.filename)) -
        Number(isCompactSchedule(right.filename)),
    )
    let fallbackError: unknown
    for (const file of orderedFiles) {
      try {
        const marks = parseTakeoffCsv({
          csvText: file.csvText,
          filename: file.filename,
          defaultMaterialFamily: params.defaultMaterialFamily,
        })
        if (marks.length > 0) return { label: group.label, marks }
      } catch (error) {
        fallbackError = error
      }
    }
    if (fallbackError) throw fallbackError
    return { label: group.label, marks: [] }
  })

  const namespaceMarks =
    parsedGroups.filter((group) => group.marks.length).length > 1
  return parsedGroups.flatMap((group) =>
    group.marks.map((mark) => {
      if (!namespaceMarks || !group.label) return mark
      const namespacedMark = `${group.label}-${mark.mark}`
      return {
        ...mark,
        mark: namespacedMark,
        description:
          mark.description === `Panel Mark ${mark.mark}`
            ? `Panel Mark ${namespacedMark}`
            : mark.description,
      }
    }),
  )
}
