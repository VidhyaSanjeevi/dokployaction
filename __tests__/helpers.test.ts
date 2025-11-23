/**
 * Tests for utility helper functions
 */

import { parseIntInput, parseBooleanInput, parseCpuLimit, sleep } from '../src/utils/helpers'

describe('Utility Helpers', () => {
  describe('parseIntInput', () => {
    it('should parse valid integer', () => {
      expect(parseIntInput('123', 'test')).toBe(123)
    })

    it('should return undefined for empty string', () => {
      expect(parseIntInput('', 'test')).toBeUndefined()
    })

    it('should return undefined for undefined', () => {
      expect(parseIntInput(undefined, 'test')).toBeUndefined()
    })

    it('should throw error for invalid number', () => {
      expect(() => parseIntInput('abc', 'test')).toThrow('test must be a valid number')
    })
  })

  describe('parseBooleanInput', () => {
    it('should parse "true" as true', () => {
      expect(parseBooleanInput('true')).toBe(true)
    })

    it('should parse "false" as false', () => {
      expect(parseBooleanInput('false')).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(parseBooleanInput('TRUE')).toBe(true)
      expect(parseBooleanInput('FALSE')).toBe(false)
    })

    it('should return undefined for empty string', () => {
      expect(parseBooleanInput('')).toBeUndefined()
    })

    it('should throw error for invalid boolean', () => {
      expect(() => parseBooleanInput('yes')).toThrow("Expected 'true' or 'false'")
    })
  })

  describe('parseCpuLimit', () => {
    it('should parse number', () => {
      expect(parseCpuLimit('500')).toBe(500)
    })

    it('should parse decimal number', () => {
      expect(parseCpuLimit('0.5')).toBe(0.5)
      expect(parseCpuLimit('1.0')).toBe(1.0)
      expect(parseCpuLimit('2.5')).toBe(2.5)
    })

    it('should parse number with "m" suffix (millicpu)', () => {
      expect(parseCpuLimit('500m')).toBe(0.5)  // 500m = 0.5 CPU
      expect(parseCpuLimit('1000m')).toBe(1.0) // 1000m = 1.0 CPU
      expect(parseCpuLimit('250m')).toBe(0.25) // 250m = 0.25 CPU
    })

    it('should be case insensitive for suffix', () => {
      expect(parseCpuLimit('500M')).toBe(0.5)
      expect(parseCpuLimit('1000M')).toBe(1.0)
    })

    it('should return undefined for empty string', () => {
      expect(parseCpuLimit('')).toBeUndefined()
    })

    it('should throw error for invalid format', () => {
      expect(() => parseCpuLimit('abc')).toThrow('CPU limit must be a valid number')
    })
  })

  describe('sleep', () => {
    it('should return a promise', () => {
      const result = sleep(100)
      expect(result).toBeInstanceOf(Promise)
    })
  })
})
