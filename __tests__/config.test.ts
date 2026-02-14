/**
 * Tests for configuration builders
 */

import { buildApplicationConfig, buildDomainConfig, parseEnvironmentVariables } from '../src/config'
import type { ActionInputs } from '../src/types/dokploy'

describe('buildApplicationConfig', () => {
  const mockInputs: ActionInputs = {
    dokployUrl: 'https://dokploy.example.com',
    apiKey: 'test-key',
    dockerImage: 'nginx:latest'
  }

  it('should build basic application config', () => {
    const config = buildApplicationConfig('test-app', 'proj-1', 'env-1', 'srv-1', mockInputs)

    expect(config.name).toBe('test-app')
    expect(config.projectId).toBe('proj-1')
    expect(config.environmentId).toBe('env-1')
    expect(config.serverId).toBe('srv-1')
    expect(config.applicationStatus).toBe('idle')
    expect(config.port).toBe(8080)
    expect(config.targetPort).toBe(8080)
    expect(config.restartPolicy).toBe('unless-stopped')
  })

  it('should include custom title and description', () => {
    const inputs: ActionInputs = {
      ...mockInputs,
      applicationTitle: 'My App',
      applicationDescription: 'My custom description'
    }

    const config = buildApplicationConfig('test-app', 'proj-1', 'env-1', 'srv-1', inputs)

    expect(config.title).toBe('My App')
    expect(config.description).toBe('My custom description')
  })

  it('should include resource limits', () => {
    const inputs: ActionInputs = {
      ...mockInputs,
      memoryLimit: 1024,
      memoryReservation: 512,
      cpuLimit: 2.0,
      cpuReservation: 0.5
    }

    const config = buildApplicationConfig('test-app', 'proj-1', 'env-1', 'srv-1', inputs)

    // Memory: MB -> bytes (× 1024 × 1024)
    expect(config.memoryLimit).toBe(1024 * 1024 * 1024)
    expect(config.memoryReservation).toBe(512 * 1024 * 1024)
    // CPU: cores -> NanoCPUs (× 1e9)
    expect(config.cpuLimit).toBe(2000000000)
    expect(config.cpuReservation).toBe(500000000)
  })

  it('should convert CPU cores to NanoCPUs for Docker Swarm API', () => {
    // Docker Swarm's NanoCPUs field: 1 CPU core = 1,000,000,000 NanoCPUs
    // Without conversion, 2.0 cores becomes 2 NanoCPUs = 2e-9 CPUs
    // which triggers: "invalid cpu value 2e-09: Must be at least 0.001"
    const testCases = [
      { cpuLimit: 0.5, cpuReservation: 0.25, expectedLimit: 500000000, expectedReservation: 250000000 },
      { cpuLimit: 1.0, cpuReservation: 0.5, expectedLimit: 1000000000, expectedReservation: 500000000 },
      { cpuLimit: 2.0, cpuReservation: 0.5, expectedLimit: 2000000000, expectedReservation: 500000000 },
      { cpuLimit: 0.001, cpuReservation: 0.001, expectedLimit: 1000000, expectedReservation: 1000000 },
    ]

    for (const tc of testCases) {
      const inputs: ActionInputs = {
        ...mockInputs,
        cpuLimit: tc.cpuLimit,
        cpuReservation: tc.cpuReservation
      }
      const config = buildApplicationConfig('test-app', 'proj-1', 'env-1', 'srv-1', inputs)
      expect(config.cpuLimit).toBe(tc.expectedLimit)
      expect(config.cpuReservation).toBe(tc.expectedReservation)
    }
  })

  it('should convert memory MB to bytes for Docker Swarm API', () => {
    // Docker Swarm's MemoryBytes field expects bytes
    // Without conversion, 2048 (MB) becomes 2048 bytes ≈ 0 memory
    const testCases = [
      { memoryLimit: 256, memoryReservation: 128, expectedLimit: 268435456, expectedReservation: 134217728 },
      { memoryLimit: 512, memoryReservation: 256, expectedLimit: 536870912, expectedReservation: 268435456 },
      { memoryLimit: 1024, memoryReservation: 512, expectedLimit: 1073741824, expectedReservation: 536870912 },
      { memoryLimit: 2048, memoryReservation: 1024, expectedLimit: 2147483648, expectedReservation: 1073741824 },
    ]

    for (const tc of testCases) {
      const inputs: ActionInputs = {
        ...mockInputs,
        memoryLimit: tc.memoryLimit,
        memoryReservation: tc.memoryReservation
      }
      const config = buildApplicationConfig('test-app', 'proj-1', 'env-1', 'srv-1', inputs)
      expect(config.memoryLimit).toBe(tc.expectedLimit)
      expect(config.memoryReservation).toBe(tc.expectedReservation)
    }
  })

  it('should not set resource fields when not provided', () => {
    const config = buildApplicationConfig('test-app', 'proj-1', 'env-1', 'srv-1', mockInputs)
    expect(config.cpuLimit).toBeUndefined()
    expect(config.cpuReservation).toBeUndefined()
    expect(config.memoryLimit).toBeUndefined()
    expect(config.memoryReservation).toBeUndefined()
  })

  it('should include custom ports', () => {
    const inputs: ActionInputs = {
      ...mockInputs,
      port: 3000,
      targetPort: 3000
    }

    const config = buildApplicationConfig('test-app', 'proj-1', 'env-1', 'srv-1', inputs)

    expect(config.port).toBe(3000)
    expect(config.targetPort).toBe(3000)
  })

  it('should include replicas', () => {
    const inputs: ActionInputs = {
      ...mockInputs,
      replicas: 3
    }

    const config = buildApplicationConfig('test-app', 'proj-1', 'env-1', 'srv-1', inputs)

    expect(config.replicas).toBe(3)
  })

  it('should include container name', () => {
    const inputs: ActionInputs = {
      ...mockInputs,
      containerName: 'my-container'
    }

    const config = buildApplicationConfig('test-app', 'proj-1', 'env-1', 'srv-1', inputs)

    expect(config.appName).toBe('my-container')
  })
})

describe('buildDomainConfig', () => {
  const mockInputs: ActionInputs = {
    dokployUrl: 'https://dokploy.example.com',
    apiKey: 'test-key',
    dockerImage: 'nginx:latest'
  }

  it('should return null when no domain host provided', () => {
    const config = buildDomainConfig(mockInputs)
    expect(config).toBeNull()
  })

  it('should build basic domain config', () => {
    const inputs: ActionInputs = {
      ...mockInputs,
      domainHost: 'example.com'
    }

    const config = buildDomainConfig(inputs)

    expect(config).not.toBeNull()
    expect(config?.host).toBe('example.com')
    expect(config?.path).toBe('/')
    expect(config?.port).toBe(8080)
    expect(config?.https).toBe(true)
    expect(config?.certificateType).toBe('letsencrypt')
    expect(config?.domainType).toBe('application')
    expect(config?.stripPath).toBe(false)
  })

  it('should use custom domain configuration', () => {
    const inputs: ActionInputs = {
      ...mockInputs,
      domainHost: 'api.example.com',
      domainPath: '/api',
      applicationPort: 3000,
      domainHttps: false,
      sslCertificateType: 'custom',
      domainStripPath: true
    }

    const config = buildDomainConfig(inputs)

    expect(config?.host).toBe('api.example.com')
    expect(config?.path).toBe('/api')
    expect(config?.port).toBe(3000)
    expect(config?.https).toBe(false)
    expect(config?.certificateType).toBe('custom')
    expect(config?.stripPath).toBe(true)
  })

  it('should use targetPort when applicationPort not specified', () => {
    const inputs: ActionInputs = {
      ...mockInputs,
      domainHost: 'example.com',
      targetPort: 5000
    }

    const config = buildDomainConfig(inputs)

    expect(config?.port).toBe(5000)
  })
})

describe('parseEnvironmentVariables', () => {
  const mockInputs: ActionInputs = {
    dokployUrl: 'https://dokploy.example.com',
    apiKey: 'test-key',
    dockerImage: 'nginx:latest'
  }

  it('should return empty string when no env vars provided', () => {
    const result = parseEnvironmentVariables(mockInputs)
    expect(result).toBe('')
  })

  it('should parse env string directly', () => {
    const inputs: ActionInputs = {
      ...mockInputs,
      env: 'KEY1=value1\nKEY2=value2'
    }

    const result = parseEnvironmentVariables(inputs)
    expect(result).toBe('KEY1=value1\nKEY2=value2')
  })

  it('should parse JSON env vars', () => {
    const inputs: ActionInputs = {
      ...mockInputs,
      envFromJson: '{"KEY1":"value1","KEY2":"value2"}'
    }

    const result = parseEnvironmentVariables(inputs)
    expect(result).toContain('KEY1=value1')
    expect(result).toContain('KEY2=value2')
  })

  it('should prioritize envFromJson over env', () => {
    const inputs: ActionInputs = {
      ...mockInputs,
      env: 'OLD_KEY=old_value',
      envFromJson: '{"NEW_KEY":"new_value"}'
    }

    const result = parseEnvironmentVariables(inputs)
    expect(result).toContain('NEW_KEY=new_value')
    expect(result).not.toContain('OLD_KEY')
  })

  it('should throw error for invalid JSON', () => {
    const inputs: ActionInputs = {
      ...mockInputs,
      envFromJson: 'invalid json'
    }

    expect(() => parseEnvironmentVariables(inputs)).toThrow('Failed to parse env-from-json')
  })
})

