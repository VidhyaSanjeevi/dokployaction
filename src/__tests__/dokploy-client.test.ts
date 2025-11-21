/**
 * DokployClient Unit Tests
 * Tests API client methods and response parsing
 */

import { DokployClient } from '../client/dokploy-client'
import type { DokployConfig, Project, Environment, Application } from '../types/dokploy'

// Mock @actions/core
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warning: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  getInput: jest.fn((name: string) => {
    if (name === 'debug-mode') return 'false'
    return ''
  })
}))

// Mock @actions/http-client
jest.mock('@actions/http-client')

describe('DokployClient', () => {
  let client: DokployClient
  let mockConfig: DokployConfig

  beforeEach(() => {
    mockConfig = {
      url: 'https://dokploy.example.com',
      apiKey: 'test-api-key',
      debugMode: true
    }
    client = new DokployClient(mockConfig)
  })

  describe('Constructor', () => {
    it('should initialize with config', () => {
      expect(client).toBeDefined()
    })

    it('should remove trailing slash from URL', () => {
      const configWithSlash: DokployConfig = {
        url: 'https://dokploy.example.com/',
        apiKey: 'test-key'
      }
      const clientWithSlash = new DokployClient(configWithSlash)
      expect(clientWithSlash).toBeDefined()
    })
  })

  describe('createProject', () => {
    it('should create project and return projectId', async () => {
      const mockProject: Project = {
        projectId: 'proj-123',
        name: 'test-project',
        description: 'Test description',
        createdAt: '2024-01-01T00:00:00Z'
      }

      // Mock the post method
      jest.spyOn(client as any, 'post').mockResolvedValue(mockProject)

      const projectId = await client.createProject('test-project', 'Test description')

      expect(projectId).toBe('proj-123')
      expect((client as any).post).toHaveBeenCalledWith('/api/project.create', {
        name: 'test-project',
        description: 'Test description'
      })
    })

    it('should handle project with id field instead of projectId', async () => {
      const mockProject: Project = {
        id: 'proj-456',
        name: 'test-project'
      }

      jest.spyOn(client as any, 'post').mockResolvedValue(mockProject)

      const projectId = await client.createProject('test-project')
      expect(projectId).toBe('proj-456')
    })

    it('should throw error if no project ID in response', async () => {
      const mockProject = {
        name: 'test-project'
        // Missing projectId and id
      }

      jest.spyOn(client as any, 'post').mockResolvedValue(mockProject)

      await expect(client.createProject('test-project')).rejects.toThrow(
        'Failed to create project: No project ID in response'
      )
    })

    it('should use default description if not provided', async () => {
      const mockProject: Project = {
        projectId: 'proj-789',
        name: 'test-project'
      }

      jest.spyOn(client as any, 'post').mockResolvedValue(mockProject)

      await client.createProject('test-project')

      expect((client as any).post).toHaveBeenCalledWith('/api/project.create', {
        name: 'test-project',
        description: 'Automated deployment project: test-project'
      })
    })
  })

  describe('createEnvironment', () => {
    it('should create environment and return environmentId', async () => {
      const mockEnvironment: Environment = {
        environmentId: 'env-123',
        name: 'production',
        projectId: 'proj-123'
      }

      jest.spyOn(client as any, 'post').mockResolvedValue(mockEnvironment)

      const envId = await client.createEnvironment('proj-123', 'production')

      expect(envId).toBe('env-123')
      expect((client as any).post).toHaveBeenCalledWith('/api/environment.create', {
        projectId: 'proj-123',
        name: 'production'
      })
    })

    it('should handle environment with id field', async () => {
      const mockEnvironment: Environment = {
        id: 'env-456',
        name: 'staging',
        projectId: 'proj-123'
      }

      jest.spyOn(client as any, 'post').mockResolvedValue(mockEnvironment)

      const envId = await client.createEnvironment('proj-123', 'staging')
      expect(envId).toBe('env-456')
    })

    it('should throw error if no environment ID in response', async () => {
      const mockEnvironment = {
        name: 'production',
        projectId: 'proj-123'
      }

      jest.spyOn(client as any, 'post').mockResolvedValue(mockEnvironment)

      await expect(client.createEnvironment('proj-123', 'production')).rejects.toThrow(
        'Failed to create environment: No environment ID in response'
      )
    })
  })

  describe('createApplication', () => {
    it('should create application and return applicationId', async () => {
      const mockApplication: Application = {
        applicationId: 'app-123',
        name: 'test-app',
        projectId: 'proj-123',
        environmentId: 'env-123',
        serverId: 'server-123'
      }

      jest.spyOn(client as any, 'post').mockResolvedValue(mockApplication)

      const appId = await client.createApplication({
        name: 'test-app',
        environmentId: 'env-123',
        serverId: 'server-123'
      })

      expect(appId).toBe('app-123')
    })

    it('should handle application with id field', async () => {
      const mockApplication: Application = {
        id: 'app-456',
        name: 'test-app',
        projectId: 'proj-123',
        environmentId: 'env-123',
        serverId: 'server-123'
      }

      jest.spyOn(client as any, 'post').mockResolvedValue(mockApplication)

      const appId = await client.createApplication({
        name: 'test-app',
        environmentId: 'env-123'
      })

      expect(appId).toBe('app-456')
    })

    it('should throw error if no application ID in response', async () => {
      const mockApplication = {
        name: 'test-app',
        environmentId: 'env-123'
      }

      jest.spyOn(client as any, 'post').mockResolvedValue(mockApplication)

      await expect(
        client.createApplication({
          name: 'test-app',
          environmentId: 'env-123'
        })
      ).rejects.toThrow('Failed to create application: No application ID in response')
    })
  })

  describe('Response Parsing', () => {
    it('should handle responses with projectId field', async () => {
      const response = { projectId: 'proj-123', name: 'test' }
      jest.spyOn(client as any, 'post').mockResolvedValue(response)

      const id = await client.createProject('test')
      expect(id).toBe('proj-123')
    })

    it('should handle responses with id field', async () => {
      const response = { id: 'proj-456', name: 'test' }
      jest.spyOn(client as any, 'post').mockResolvedValue(response)

      const id = await client.createProject('test')
      expect(id).toBe('proj-456')
    })

    it('should prefer projectId over id when both present', async () => {
      const response = { projectId: 'proj-primary', id: 'proj-secondary', name: 'test' }
      jest.spyOn(client as any, 'post').mockResolvedValue(response)

      const id = await client.createProject('test')
      expect(id).toBe('proj-primary')
    })
  })
})

