/**
 * Dokploy API Client
 * Comprehensive wrapper for all Dokploy API endpoints
 */

import * as core from '@actions/core'
import * as httpm from '@actions/http-client'
import type {
  DokployConfig,
  Project,
  Environment,
  Server,
  Application,
  Domain,
  Container,
  Deployment
} from '../types/dokploy'
import { debugLog, logApiRequest, logApiResponse } from '../utils/helpers'

export class DokployClient {
  private baseUrl: string
  private apiKey: string
  private client: httpm.HttpClient
  private config: DokployConfig

  constructor(config: DokployConfig) {
    this.config = config
    this.baseUrl = config.url.replace(/\/$/, '') // Remove trailing slash
    this.apiKey = config.apiKey
    this.client = new httpm.HttpClient('dokploy-github-action', undefined, {
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-key': config.apiKey
      }
    })
  }

  /**
   * Make a GET request to Dokploy API
   */
  async get<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    logApiRequest('GET', url)

    try {
      const response = await this.client.getJson<T>(url)
      logApiResponse(response.statusCode ?? 0, response.result)

      if (response.statusCode !== 200) {
        throw new Error(`GET ${endpoint} failed with status ${response.statusCode}`)
      }

      return response.result as T
    } catch (error) {
      core.error(`❌ GET request failed: ${endpoint}`)
      throw error
    }
  }

  /**
   * Make a POST request to Dokploy API
   */
  async post<T, B = unknown>(endpoint: string, body: B = {} as B): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    logApiRequest('POST', url, body)

    try {
      const response = await this.client.postJson<T>(url, body)
      logApiResponse(response.statusCode ?? 0, response.result)

      if (response.statusCode !== 200 && response.statusCode !== 201) {
        const errorMessage =
          (response.result as { message?: string })?.message ||
          (response.result as { error?: string })?.error ||
          'Unknown error'
        throw new Error(`POST ${endpoint} failed with status ${response.statusCode}: ${errorMessage}`)
      }

      return response.result as T
    } catch (error) {
      core.error(`❌ POST request failed: ${endpoint}`)
      throw error
    }
  }

  // ========================================================================
  // Project Management
  // ========================================================================

  async getAllProjects(): Promise<Project[]> {
    debugLog('Fetching all projects')
    return await this.get<Project[]>('/api/project.all')
  }

  async getProject(projectId: string): Promise<Project> {
    debugLog(`Fetching project: ${projectId}`)
    return await this.get<Project>(`/api/project.one?projectId=${projectId}`)
  }

  async findProjectByName(projectName: string): Promise<Project | undefined> {
    debugLog(`Finding project by name: ${projectName}`)
    const projects = await this.getAllProjects()
    return projects.find(p => p.name === projectName)
  }

  async createProject(name: string, description?: string): Promise<string> {
    core.info(`📋 Creating project: ${name}`)
    const project = await this.post<Project>('/api/project.create', {
      name,
      description: description || `Automated deployment project: ${name}`
    })

    // Log the full response for debugging
    debugLog('Project creation response', project)

    // Extract project ID from response
    const projectId = project.projectId || project.id || ''

    if (!projectId) {
      core.error('❌ Failed to get project ID from API response')
      core.error(`Response keys: ${Object.keys(project).join(', ')}`)
      core.error(`Full response: ${JSON.stringify(project, null, 2)}`)
      throw new Error('Failed to create project: No project ID in response')
    }

    core.info(`✅ Created project: ${name} (ID: ${projectId})`)
    return projectId
  }

  // ========================================================================
  // Environment Management
  // ========================================================================

  async createEnvironment(projectId: string, environmentName: string): Promise<string> {
    core.info(`🌍 Creating environment: ${environmentName}`)
    const environment = await this.post<Environment>('/api/environment.create', {
      projectId,
      name: environmentName
    })

    debugLog('Environment creation response', environment)

    const environmentId = environment.environmentId || environment.id || ''
    if (!environmentId) {
      core.error('❌ Failed to get environment ID from API response')
      core.error(`Full response: ${JSON.stringify(environment, null, 2)}`)
      throw new Error('Failed to create environment: No environment ID in response')
    }

    core.info(`✅ Created environment: ${environmentName} (ID: ${environmentId})`)
    return environmentId
  }

  async findEnvironmentInProject(
    projectId: string,
    environmentName: string
  ): Promise<Environment | undefined> {
    debugLog(`Finding environment "${environmentName}" in project ${projectId}`)
    const project = await this.getProject(projectId)
    const environments = project.environments || []
    return environments.find(env => env.name === environmentName)
  }

  // ========================================================================
  // Server Management
  // ========================================================================

  async getAllServers(): Promise<Server[]> {
    debugLog('Fetching all servers')
    return await this.get<Server[]>('/api/server.all')
  }

  async findServerByName(serverName: string): Promise<Server | undefined> {
    debugLog(`Finding server by name: ${serverName}`)
    const servers = await this.getAllServers()
    return servers.find(s => s.name === serverName)
  }

  async resolveServerId(serverId?: string, serverName?: string): Promise<string> {
    if (serverId) {
      debugLog(`Using provided server ID: ${serverId}`)
      return serverId
    }

    if (serverName) {
      const server = await this.findServerByName(serverName)
      if (!server) {
        throw new Error(`Server "${serverName}" not found`)
      }
      const id = server.serverId || server.id || ''
      core.info(`✅ Found server: ${serverName} (ID: ${id})`)
      return id
    }

    throw new Error('Either server-id or server-name must be provided')
  }

  // ========================================================================
  // Application Management
  // ========================================================================

  async getApplication(applicationId: string): Promise<Application> {
    debugLog(`Fetching application: ${applicationId}`)
    return await this.get<Application>(`/api/application.one?applicationId=${applicationId}`)
  }

  async createApplication(config: Partial<Application>): Promise<string> {
    core.info(`📦 Creating application: ${config.name}`)
    debugLog('Application configuration', config)

    const application = await this.post<Application>('/api/application.create', config)

    debugLog('Application creation response', application)

    const applicationId = application.applicationId || application.id || ''
    if (!applicationId) {
      core.error('❌ Failed to get application ID from API response')
      core.error(`Full response: ${JSON.stringify(application, null, 2)}`)
      throw new Error('Failed to create application: No application ID in response')
    }

    core.info(`✅ Created application: ${config.name} (ID: ${applicationId})`)
    return applicationId
  }

  async updateApplication(applicationId: string, config: Partial<Application>): Promise<void> {
    core.info(`🔄 Updating application: ${applicationId}`)
    debugLog('Update configuration', config)

    await this.post('/api/application.update', {
      applicationId,
      ...config
    })
    core.info(`✅ Updated application: ${applicationId}`)
  }

  // ========================================================================
  // Docker Provider Configuration
  // ========================================================================

  async saveDockerProvider(
    applicationId: string,
    dockerImage: string,
    registryUrl?: string,
    username?: string,
    password?: string
  ): Promise<void> {
    core.info(`🐳 Configuring Docker provider for application: ${applicationId}`)
    debugLog('Docker provider config', {
      applicationId,
      dockerImage,
      registryUrl,
      username: username ? '[SET]' : '[NOT SET]'
    })

    await this.post('/api/application.saveDockerProvider', {
      applicationId,
      dockerImage,
      registryUrl: registryUrl || 'ghcr.io',
      username,
      password
    })
    core.info(`✅ Docker provider configured: ${dockerImage}`)
  }

  // ========================================================================
  // Environment Variables
  // ========================================================================

  async saveEnvironment(applicationId: string, envString: string): Promise<void> {
    core.info(`🌍 Configuring environment variables for application: ${applicationId}`)
    const lineCount = envString ? envString.split('\n').length : 0
    debugLog(`Saving ${lineCount} environment variables`)

    await this.post('/api/application.saveEnvironment', {
      applicationId,
      env: envString
    })
    core.info(`✅ Environment variables configured (${lineCount} lines)`)
  }

  // ========================================================================
  // Domain Management
  // ========================================================================

  async createDomain(applicationId: string, domainConfig: Partial<Domain>): Promise<Domain> {
    core.info(`🌐 Creating domain: ${domainConfig.host}`)
    debugLog('Domain configuration', domainConfig)

    const result = await this.post<Domain>('/api/domain.create', {
      applicationId,
      ...domainConfig
    })
    core.info(`✅ Domain created: ${domainConfig.host} (SSL: ${domainConfig.certificateType})`)
    return result
  }

  async removeDomain(domainId: string): Promise<void> {
    core.info(`🗑️ Removing domain: ${domainId}`)
    await this.post('/api/domain.remove', { domainId })
    core.info(`✅ Domain removed: ${domainId}`)
  }

  async getDomains(applicationId: string): Promise<Domain[]> {
    debugLog(`Fetching domains for application: ${applicationId}`)
    const app = await this.getApplication(applicationId)
    return app.domains || []
  }

  // ========================================================================
  // Deployment
  // ========================================================================

  async stopApplication(applicationId: string): Promise<void> {
    core.info(`⏹️ Stopping application: ${applicationId}`)
    await this.post('/api/application.stop', { applicationId })
    core.info(`✅ Application stopped: ${applicationId}`)
  }

  async deployApplication(applicationId: string, title?: string, description?: string): Promise<Deployment> {
    core.info(`🚀 Deploying application: ${applicationId}`)
    debugLog('Deployment params', { applicationId, title, description })

    const result = await this.post<Deployment>('/api/application.deploy', {
      applicationId,
      title,
      description
    })
    core.info(`✅ Deployment triggered: ${applicationId}`)
    return result
  }

  // ========================================================================
  // Container Operations
  // ========================================================================

  async getContainers(applicationId: string): Promise<Container[]> {
    debugLog(`Fetching containers for application: ${applicationId}`)
    return await this.get<Container[]>(`/api/container.all?applicationId=${applicationId}`)
  }

  async removeContainer(containerName: string): Promise<void> {
    core.info(`🗑️ Removing container: ${containerName}`)
    await this.post('/api/container.remove', { containerName })
    core.info(`✅ Container removed: ${containerName}`)
  }
}
