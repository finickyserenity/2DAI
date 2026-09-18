import { describe, expect, it, vi } from 'vitest'
import { createId } from './id'

describe('createId', () => {
  it('uses randomUUID when the browser provides it', () => {
    const randomUUID = vi.fn(() => 'native-id')
    expect(createId({ randomUUID })).toBe('native-id')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('creates a UUID from random bytes when randomUUID is unavailable', () => {
    const getRandomValues = vi.fn((values: Uint8Array) => {
      values.set(Array.from({ length: 16 }, (_, index) => index))
      return values
    })
    expect(createId({ getRandomValues })).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
  })
})