/**
 * Tests for input parsing
 */

import * as core from '@actions/core'
import { parseInputs } from '../src/inputs'

// Mock @actions/core
jest.mock('@actions/core')

describe('parseInputs', () => {
  const mockGetInput = core.getInput as jest.MockedFunction<typeof core.getInput>
  const mockSetSecret = core.setSecret as jest.MockedFunction<typeof core.setSecret>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should parse required inputs', () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'dokploy-url': 'https://dokploy.example.com',
        'api-key': 'test-api-key',
        'docker-image': 'nginx:latest'
      }
      return inputs[name] || ''
    })

    const result = parseInputs()

    expect(result.dokployUrl).toBe('https://dokploy.example.com')
    expect(result.apiKey).toBe('test-api-key')
    expect(result.dockerImage).toBe('nginx:latest')
    expect(mockSetSecret).toHaveBeenCalledWith('test-api-key')
  })

  it('should parse optional string inputs', () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'dokploy-url': 'https://dokploy.example.com',
        'api-key': 'test-api-key',
        'docker-image': 'nginx:latest',
        'project-name': 'my-project',
        'application-name': 'my-app'
      }
      return inputs[name] || ''
    })

    const result = parseInputs()

    expect(result.projectName).toBe('my-project')
    expect(result.applicationName).toBe('my-app')
  })

  it('should parse boolean inputs', () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'dokploy-url': 'https://dokploy.example.com',
        'api-key': 'test-api-key',
        'docker-image': 'nginx:latest',
        'auto-create-resources': 'false',
        'wait-for-deployment': 'true'
      }
      return inputs[name] || ''
    })

    const result = parseInputs()

    expect(result.autoCreateResources).toBe(false)
    expect(result.waitForDeployment).toBe(true)
  })

  it('should parse integer inputs', () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'dokploy-url': 'https://dokploy.example.com',
        'api-key': 'test-api-key',
        'docker-image': 'nginx:latest',
        'port': '8080',
        'memory-limit': '512',
        'replicas': '3'
      }
      return inputs[name] || ''
    })

    const result = parseInputs()

    expect(result.port).toBe(8080)
    expect(result.memoryLimit).toBe(512)
    expect(result.replicas).toBe(3)
  })

  it('should use default values for optional inputs', () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'dokploy-url': 'https://dokploy.example.com',
        'api-key': 'test-api-key',
        'docker-image': 'nginx:latest'
      }
      return inputs[name] || ''
    })

    const result = parseInputs()

    expect(result.environmentName).toBe('production')
    expect(result.serverName).toBe('Hostinger-Server1')
    expect(result.registryUrl).toBe('ghcr.io')
    expect(result.autoCreateResources).toBe(true)
    expect(result.waitForDeployment).toBe(true)
    expect(result.healthCheckEnabled).toBe(true)
    expect(result.domainHttps).toBe(true)
  })

  it('should mask sensitive inputs', () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'dokploy-url': 'https://dokploy.example.com',
        'api-key': 'secret-api-key',
        'docker-image': 'nginx:latest',
        'registry-password': 'secret-password'
      }
      return inputs[name] || ''
    })

    parseInputs()

    expect(mockSetSecret).toHaveBeenCalledWith('secret-api-key')
    expect(mockSetSecret).toHaveBeenCalledWith('secret-password')
  })

  it('should parse CPU limits with m suffix', () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'dokploy-url': 'https://dokploy.example.com',
        'api-key': 'test-api-key',
        'docker-image': 'nginx:latest',
        'cpu-limit': '500m',
        'cpu-reservation': '250m'
      }
      return inputs[name] || ''
    })

    const result = parseInputs()

    expect(result.cpuLimit).toBe(0.5)   // 500m = 0.5 CPU
    expect(result.cpuReservation).toBe(0.25) // 250m = 0.25 CPU
  })
})

