export const MAX_INTAKE_BYTES = 100 * 1024 * 1024
export const DIRECT_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024
export const DIRECT_UPLOAD_EXPIRY_SECONDS = 5 * 60

export const INTAKE_ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
])

export function isAllowedIntakeFile(filename: string, contentType: string) {
  const lowerName = filename.toLowerCase()
  return (
    (lowerName.endsWith('.zip') || lowerName.endsWith('.pdf')) &&
    (!contentType || INTAKE_ALLOWED_TYPES.has(contentType))
  )
}

export function sanitizeUploadFilename(filename: string) {
  return (
    filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '') || 'upload'
  )
}
