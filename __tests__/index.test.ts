/**
 * Tests for main action entry point
 */

import * as core from '@actions/core'
import { run } from '../src/index'
import { DokployClient } from '../src/client/dokploy-client'
import { parseInputs } from '../src/inputs'
import { performHealthCheck } from '../src/health-check'

// Mock all dependencies
jest.mock('@actions/core')
jest.mock('../src/client/dokploy-client')
jest.mock('../src/inputs')
jest.mock('../src/health-check')

describe('run', () => {
  const mockInfo = core.info as jest.MockedFunction<typeof core.info>
  const mockSetFailed = core.setFailed as jest.MockedFunction<typeof core.setFailed>
  const mockSetOutput = core.setOutput as jest.MockedFunction<typeof core.setOutput>
  const mockStartGroup = core.startGroup as jest.MockedFunction<typeof core.startGroup>
  const mockEndGroup = core.endGroup as jest.MockedFunction<typeof core.endGroup>

  const mockParseInputs = parseInputs as jest.MockedFunction<typeof parseInputs>
  const mockPerformHealthCheck = performHealthCheck as jest.MockedFunction<
    typeof performHealthCheck
  >

  const mockInputs = {
    dokployUrl: 'https://dokploy.example.com',
    apiKey: 'test-key',
    dockerImage: 'nginx:latest',
    projectId: 'proj-123',
    environmentId: 'env-456',
    applicationId: 'app-789',
    serverId: 'srv-001',
    healthCheckEnabled: false,
    waitForDeployment: false,
    cleanupOldContainers: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockParseInputs.mockReturnValue(mockInputs as any)
    mockPerformHealthCheck.mockResolvedValue('healthy')
  })

  it('should complete deployment successfully with all IDs provided', async () => {
    const mockClient = {
      resolveServerId: jest.fn().mockResolvedValue('srv-001'),
      saveDockerProvider: jest.fn().mockResolvedValue(undefined),
      saveEnvironment: jest.fn().mockResolvedValue(undefined),
      deployApplication: jest.fn().mockResolvedValue({ deploymentId: 'deploy-123' })
    }

    ;(DokployClient as jest.Mock).mockImplementation(() => mockClient)

    await run()

    expect(mockSetOutput).toHaveBeenCalledWith('project-id', 'proj-123')
    expect(mockSetOutput).toHaveBeenCalledWith('environment-id', 'env-456')
    expect(mockSetOutput).toHaveBeenCalledWith('server-id', 'srv-001')
    expect(mockSetOutput).toHaveBeenCalledWith('application-id', 'app-789')
    expect(mockSetOutput).toHaveBeenCalledWith('deployment-status', 'success')
    expect(mockSetFailed).not.toHaveBeenCalled()
  })

  it('should handle errors gracefully', async () => {
    const mockClient = {
      resolveServerId: jest.fn().mockRejectedValue(new Error('API Error'))
    }

    ;(DokployClient as jest.Mock).mockImplementation(() => mockClient)

    await expect(run()).rejects.toThrow('API Error')
    expect(mockSetFailed).toHaveBeenCalledWith(expect.stringContaining('API Error'))
  })

  it('should create project when project-name provided', async () => {
    const inputs = {
      ...mockInputs,
      projectId: undefined,
      projectName: 'new-project',
      autoCreateResources: true
    }
    mockParseInputs.mockReturnValue(inputs as any)

    const mockClient = {
      findProjectByName: jest.fn().mockResolvedValue(null),
      createProject: jest
        .fn()
        .mockResolvedValue({ projectId: 'new-proj-id', defaultEnvironmentId: 'env-default' }),
      findEnvironmentInProject: jest.fn().mockResolvedValue({ id: 'env-456' }),
      resolveServerId: jest.fn().mockResolvedValue('srv-001'),
      getProject: jest.fn().mockResolvedValue({
        environments: [
          {
            id: 'env-456',
            applications: [{ id: 'app-789', name: 'test-app' }]
          }
        ]
      }),
      saveDockerProvider: jest.fn().mockResolvedValue(undefined),
      saveEnvironment: jest.fn().mockResolvedValue(undefined),
      deployApplication: jest.fn().mockResolvedValue({ deploymentId: 'deploy-123' })
    }

    ;(DokployClient as jest.Mock).mockImplementation(() => mockClient)

    await run()

    expect(mockClient.createProject).toHaveBeenCalledWith('new-project', undefined)
    expect(mockSetOutput).toHaveBeenCalledWith('project-id', 'new-proj-id')
  })

  it('should throw error when project not found and auto-create disabled', async () => {
    const inputs = {
      ...mockInputs,
      projectId: undefined,
      projectName: 'missing-project',
      autoCreateResources: false
    }
    mockParseInputs.mockReturnValue(inputs as any)

    const mockClient = {
      findProjectByName: jest.fn().mockResolvedValue(null)
    }

    ;(DokployClient as jest.Mock).mockImplementation(() => mockClient)

    await expect(run()).rejects.toThrow('not found and auto-create is disabled')
  })

  it('should use groups for logging', async () => {
    const mockClient = {
      resolveServerId: jest.fn().mockResolvedValue('srv-001'),
      saveDockerProvider: jest.fn().mockResolvedValue(undefined),
      saveEnvironment: jest.fn().mockResolvedValue(undefined),
      deployApplication: jest.fn().mockResolvedValue({ deploymentId: 'deploy-123' })
    }

    ;(DokployClient as jest.Mock).mockImplementation(() => mockClient)

    await run()

    expect(mockStartGroup).toHaveBeenCalledWith(expect.stringContaining('Parsing and Validating Inputs'))
    expect(mockStartGroup).toHaveBeenCalledWith(expect.stringContaining('Connecting to Dokploy'))
    expect(mockEndGroup).toHaveBeenCalled()
  })
})

