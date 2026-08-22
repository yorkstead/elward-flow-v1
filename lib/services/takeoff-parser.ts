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
    const isJadeClean = /jade.*clean/i.test(params.filename)
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
        mark: row[0].trim(),
        description: `Panel Mark ${row[0].trim()}`,
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
