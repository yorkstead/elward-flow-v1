import { describe, expect, it } from 'vitest'
import { sha256 } from '@/lib/files/hash'
describe('sha256', () => {
  it('produces a stable lowercase digest', () => {
    expect(sha256(new TextEncoder().encode('Elward Flow'))).toBe(
      '9014afd355c916aa380e60b0b8b007e86baa23ac0ec139b4bc2af6dbb14a6a52',
    )
  })
})
