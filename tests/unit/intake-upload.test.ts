import { describe, expect, it } from 'vitest'
import {
  DIRECT_UPLOAD_EXPIRY_SECONDS,
  DIRECT_UPLOAD_THRESHOLD_BYTES,
  isAllowedIntakeFile,
  MAX_INTAKE_BYTES,
  sanitizeUploadFilename,
} from '@/lib/intake-upload'

describe('release intake direct upload policy', () => {
  it('keeps the hosted transfer below the function payload ceiling', () => {
    expect(DIRECT_UPLOAD_THRESHOLD_BYTES).toBe(4 * 1024 * 1024)
    expect(MAX_INTAKE_BYTES).toBe(100 * 1024 * 1024)
    expect(DIRECT_UPLOAD_EXPIRY_SECONDS).toBe(300)
  })

  it('accepts controlled ZIP and PDF package types only', () => {
    expect(isAllowedIntakeFile('25036.zip', 'application/zip')).toBe(true)
    expect(isAllowedIntakeFile('25036.PDF', 'application/pdf')).toBe(true)
    expect(isAllowedIntakeFile('25036.exe', 'application/octet-stream')).toBe(
      false,
    )
    expect(isAllowedIntakeFile('25036.zip', 'text/plain')).toBe(false)
  })

  it('sanitizes object-key filenames without changing their extension', () => {
    expect(sanitizeUploadFilename('../25036 release.zip')).toBe(
      '_25036_release.zip',
    )
  })
})
