/**
 * Utility functions for parsing and validating inputs
 */

import * as core from '@actions/core'

export function parseIntInput(value: string | undefined, name: string): number | undefined {
  if (!value || value === '') {
    return undefined
  }
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    throw new Error(`${name} must be a valid number, got: ${value}`)
  }
  return parsed
}

export function parseBooleanInput(value: string | undefined): boolean | undefined {
  if (!value || value === '') {
    return undefined
  }
  const lower = value.toLowerCase()
  if (lower === 'true') return true
  if (lower === 'false') return false
  throw new Error(`Expected 'true' or 'false', got: ${value}`)
}

export function parseOptionalStringInput(key: string): string | undefined {
  const value = core.getInput(key, { required: false })
  return value && value.trim() !== '' ? value.trim() : undefined
}

export function parseCpuLimit(value: string | undefined): number | undefined {
  if (!value || value === '') {
    return undefined
  }
  // CPU limits can be:
  // - Decimal values: 0.5, 1.0, 2.5
  // - Integer values: 1, 2, 4
  // - Millicpu values with 'm' suffix: 500m, 1000m (convert to decimal)
  
  let cleanValue = value.toString().trim()
  
  // Handle millicpu format (e.g., "500m" = 0.5 CPU)
  if (cleanValue.endsWith('m') || cleanValue.endsWith('M')) {
    const milliValue = parseInt(cleanValue.slice(0, -1), 10)
    if (isNaN(milliValue)) {
      throw new Error(`CPU limit must be a valid number, got: ${value}`)
    }
    // Convert millicpu to decimal (1000m = 1.0 CPU)
    return milliValue / 1000
  }
  
  // Parse as decimal number
  const parsed = parseFloat(cleanValue)
  if (isNaN(parsed)) {
    throw new Error(`CPU limit must be a valid number, got: ${value}`)
  }
  
  return parsed
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function debugLog(message: string, data?: unknown): void {
  const debugMode = parseBooleanInput(core.getInput('debug-mode', { required: false }))
  if (debugMode) {
    core.info(`🐛 DEBUG: ${message}`)
    if (data) {
      core.info(`🐛 DEBUG DATA: ${JSON.stringify(data, null, 2)}`)
    }
  }
}

export function logApiRequest(method: string, url: string, body?: unknown): void {
  const logRequests = parseBooleanInput(core.getInput('log-api-requests', { required: false }))
  if (logRequests) {
    core.info(`📤 API REQUEST: ${method} ${url}`)
    if (body) {
      // Sanitize sensitive data
      const sanitized = JSON.stringify(
        body,
        (key, value) => {
          if (
            key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('key') ||
            key.toLowerCase().includes('secret')
          ) {
            return '[REDACTED]'
          }
          return value
        },
        2
      )
      core.info(`📤 REQUEST BODY: ${sanitized}`)
    }
  }
}

export function logApiResponse(status: number, response?: unknown): void {
  const logResponses = parseBooleanInput(core.getInput('log-api-responses', { required: false }))
  if (logResponses) {
    core.info(`📥 API RESPONSE: HTTP ${status}`)
    if (response) {
      core.info(`📥 RESPONSE BODY: ${JSON.stringify(response, null, 2)}`)
    }
  }
}

export function sanitizeSecret(value: string): void {
  if (value && value.trim() !== '') {
    core.setSecret(value)
  }
}
