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
  Deployment,
  Compose
} from '../types/dokploy'
import { debugLog, logApiRequest, logApiResponse, sleep } from '../utils/helpers'

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
        throw new Error(
          `POST ${endpoint} failed with status ${response.statusCode}: ${errorMessage}`
        )
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

  async createProject(
    name: string,
    description?: string
  ): Promise<{ projectId: string; defaultEnvironmentId?: string }> {
    core.info(`📋 Creating project: ${name}`)
    const response = await this.post<{
      project?: Project
      environment?: Environment
      projectId?: string
      id?: string
    }>('/api/project.create', {
      name,
      description: description || `Automated deployment project: ${name}`
    })

    // Log the full response for debugging
    debugLog('Project creation response', response)

    // Dokploy API returns nested structure: { project: {...}, environment: {...} }
    // The API automatically creates a default "production" environment
    const project = response.project || response
    const projectId = project.projectId || project.id || ''

    if (!projectId) {
      core.error('❌ Failed to get project ID from API response')
      core.error(`Response keys: ${Object.keys(response).join(', ')}`)
      core.error(`Full response: ${JSON.stringify(response, null, 2)}`)
      throw new Error('Failed to create project: No project ID in response')
    }

    // Extract default environment ID if created
    let defaultEnvironmentId: string | undefined
    if (response.environment) {
      defaultEnvironmentId = response.environment.environmentId || response.environment.id
      if (defaultEnvironmentId) {
        core.info(
          `✅ Default environment created: ${response.environment.name} (ID: ${defaultEnvironmentId})`
        )
      }
    }

    core.info(`✅ Created project: ${name} (ID: ${projectId})`)
    return { projectId, defaultEnvironmentId }
  }

  // ========================================================================
  // Environment Management
  // ========================================================================

  async createEnvironment(projectId: string, environmentName: string): Promise<string> {
    core.info(`🌍 Creating environment: ${environmentName}`)
    const response = await this.post<{
      environment?: Environment
      environmentId?: string
      id?: string
    }>('/api/environment.create', {
      projectId,
      name: environmentName
    })

    debugLog('Environment creation response', response)

    // Dokploy API may return nested structure or direct object
    const environment = response.environment || response
    const environmentId = environment.environmentId || environment.id || ''

    if (!environmentId) {
      core.error('❌ Failed to get environment ID from API response')
      core.error(`Full response: ${JSON.stringify(response, null, 2)}`)
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
    // Case-insensitive lookup to handle DNS-compliant lowercase names
    return servers.find(s => s.name.toLowerCase() === serverName.toLowerCase())
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

    const response = await this.post<{
      application?: Application
      applicationId?: string
      id?: string
    }>('/api/application.create', config)

    debugLog('Application creation response', response)

    // Dokploy API may return nested structure or direct object
    const application = response.application || response
    const applicationId = application.applicationId || application.id || ''

    if (!applicationId) {
      core.error('❌ Failed to get application ID from API response')
      core.error(`Full response: ${JSON.stringify(response, null, 2)}`)
      throw new Error('Failed to create application: No application ID in response')
    }

    core.info(`✅ Created application: ${config.name} (ID: ${applicationId})`)
    return applicationId
  }

  async updateApplication(
    applicationId: string,
    config: Record<string, unknown>
  ): Promise<void> {
    core.info(`🔄 Updating application: ${applicationId}`)
    debugLog('Update configuration', config)

    await this.post('/api/application.update', config)
    core.info(`✅ Updated application: ${applicationId}`)
  }

  async saveApplicationResources(
    applicationId: string,
    memoryLimit?: number,
    memoryReservation?: number,
    cpuLimit?: number,
    cpuReservation?: number,
    replicas?: number,
    restartPolicy?: string
  ): Promise<void> {
    core.info(`⚙️ Updating application resources: ${applicationId}`)
    debugLog('Resource configuration', {
      memoryLimit,
      memoryReservation,
      cpuLimit,
      cpuReservation,
      replicas,
      restartPolicy
    })

    const payload: Record<string, unknown> = { applicationId }
    
    if (memoryLimit !== undefined) payload.memoryLimit = memoryLimit
    if (memoryReservation !== undefined) payload.memoryReservation = memoryReservation
    if (cpuLimit !== undefined) payload.cpuLimit = cpuLimit
    if (cpuReservation !== undefined) payload.cpuReservation = cpuReservation
    if (replicas !== undefined) payload.replicas = replicas
    if (restartPolicy !== undefined) payload.restartPolicy = restartPolicy

    await this.post('/api/application.saveAdvanced', payload)
    core.info(`✅ Application resources updated`)
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

  /**
   * Configure Docker advanced settings (volumes, group_add)
   * Uses the mounts.create API for bind mounts/volumes
   * These settings are passed directly to Docker/Docker Swarm
   */
  async saveDockerAdvancedSettings(
    applicationId: string,
    volumes?: string,
    groupAdd?: string
  ): Promise<void> {
    if (!volumes && !groupAdd) {
      return // Nothing to configure
    }

    core.info(`⚙️ Configuring Docker advanced settings for application: ${applicationId}`)

    // Parse volumes and create mounts using mounts.create API
    if (volumes) {
      const volumeList = volumes
        .split('\n')
        .map(v => v.trim())
        .filter(v => v.length > 0)
      
      if (volumeList.length > 0) {
        core.info(`  Volumes: ${volumeList.length} mount(s)`)
        
        for (const vol of volumeList) {
          // Parse volume string: host_path:container_path[:ro]
          const parts = vol.split(':')
          if (parts.length >= 2) {
            const hostPath = parts[0]
            const mountPath = parts[1]
            core.info(`    - ${hostPath}:${mountPath}`)
            
            // Create mount using mounts.create API
            await this.post('/api/mounts.create', {
              serviceId: applicationId,
              mountPath,
              hostPath,
              type: 'bind',
              serviceType: 'application'
            })
          }
        }
      }
    }

    // Note: group_add is not directly supported by Dokploy API
    // It would need to be configured via Docker Compose or custom Swarm settings
    if (groupAdd) {
      core.warning(`⚠️ group-add parameter is not directly supported by Dokploy API`)
      core.warning(`   Consider using Docker Compose deployment type for full group_add support`)
      core.info(`   Requested groups: ${groupAdd}`)
    }

    core.info(`✅ Docker advanced settings configured`)
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

  async updateDomain(domainId: string, domainConfig: Partial<Domain>): Promise<Domain> {
    core.info(`🔄 Updating domain: ${domainConfig.host}`)
    debugLog('Domain update configuration', domainConfig)

    const result = await this.post<Domain>('/api/domain.update', {
      domainId,
      ...domainConfig
    })
    core.info(`✅ Domain updated: ${domainConfig.host} (SSL: ${domainConfig.certificateType})`)
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

  async deployApplication(
    applicationId: string,
    title?: string,
    description?: string
  ): Promise<Deployment | null> {
    core.info(`🚀 Deploying application: ${applicationId}`)
    debugLog('Deployment params', { applicationId, title, description })

    const result = await this.post<Deployment | null>('/api/application.deploy', {
      applicationId,
      title,
      description
    })
    core.info(`✅ Deployment triggered: ${applicationId}`)
    if (!result) {
      core.info('ℹ️ Deploy API returned no deployment object (fire-and-forget mode)')
    }
    return result
  }

  async getDeployment(deploymentId: string): Promise<Deployment> {
    debugLog(`Fetching deployment: ${deploymentId}`)
    return await this.get<Deployment>(`/api/deployment.one?deploymentId=${deploymentId}`)
  }

  async getDeploymentLogs(deploymentId: string): Promise<string> {
    debugLog(`Fetching deployment logs: ${deploymentId}`)
    const deployment = await this.getDeployment(deploymentId)
    return deployment.logs || ''
  }

  async waitForDeployment(
    deploymentId: string,
    timeoutSeconds: number = 300,
    pollIntervalSeconds: number = 5
  ): Promise<Deployment> {
    core.info(`⏳ Waiting for deployment to complete (timeout: ${timeoutSeconds}s)`)
    const startTime = Date.now()
    const timeoutMs = timeoutSeconds * 1000
    const pollIntervalMs = pollIntervalSeconds * 1000

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const deployment = await this.getDeployment(deploymentId)
      const status = deployment.status

      if (status === 'completed') {
        core.info(`✅ Deployment completed successfully`)
        return deployment
      }

      if (status === 'failed') {
        core.error(`❌ Deployment failed`)
        if (deployment.logs) {
          core.error('Deployment logs:')
          core.error(deployment.logs)
        }
        throw new Error('Deployment failed - check logs above for details')
      }

      const elapsed = Date.now() - startTime
      if (elapsed >= timeoutMs) {
        throw new Error(
          `Deployment timeout after ${timeoutSeconds}s (status: ${status})`
        )
      }

      core.info(`  Status: ${status} (${Math.round(elapsed / 1000)}s elapsed)`)
      await sleep(pollIntervalMs)
    }
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

  // ========================================================================
  // Docker Compose Operations
  // ========================================================================

  /**
   * Create a new Compose service
   */
  async createCompose(config: Partial<Compose>): Promise<string> {
    core.info(`📦 Creating compose service: ${config.name}`)
    debugLog('Compose configuration', config)

    const response = await this.post<{
      compose?: Compose
      composeId?: string
      id?: string
    }>('/api/compose.create', config)

    debugLog('Compose creation response', response)

    const compose = response.compose || response
    const composeId = compose.composeId || compose.id || ''

    if (!composeId) {
      core.error('❌ Failed to get compose ID from API response')
      core.error(`Full response: ${JSON.stringify(response, null, 2)}`)
      throw new Error('Failed to create compose service: No compose ID in response')
    }

    core.info(`✅ Created compose service: ${config.name} (ID: ${composeId})`)
    return composeId
  }

  /**
   * Get all compose services for a project
   */
  async getAllCompose(): Promise<Compose[]> {
    debugLog('Fetching all compose services')
    return await this.get<Compose[]>('/api/compose.all')
  }

  /**
   * Get a specific compose service
   */
  async getCompose(composeId: string): Promise<Compose> {
    debugLog(`Fetching compose service: ${composeId}`)
    return await this.get<Compose>(`/api/compose.one?composeId=${composeId}`)
  }

  /**
   * Find compose service by name in a project
   */
  async findComposeByName(projectId: string, composeName: string): Promise<Compose | undefined> {
    debugLog(`Finding compose service by name: ${composeName} in project ${projectId}`)
    const allCompose = await this.getAllCompose()
    return allCompose.find(c => c.name === composeName && c.projectId === projectId)
  }

  /**
   * Update compose service configuration
   */
  async updateCompose(composeId: string, config: Record<string, unknown>): Promise<void> {
    core.info(`🔄 Updating compose service: ${composeId}`)
    debugLog('Update configuration', config)

    await this.post('/api/compose.update', { composeId, ...config })
    core.info(`✅ Updated compose service: ${composeId}`)
  }

  /**
   * Deploy a compose service
   */
  async deployCompose(
    composeId: string,
    title?: string,
    description?: string
  ): Promise<Deployment> {
    core.info(`🚀 Deploying compose service: ${composeId}`)
    debugLog('Deployment config', { composeId, title, description })

    const response = await this.post<Deployment>('/api/compose.deploy', {
      composeId,
      title: title || 'Automated compose deployment',
      description: description || 'Deployed via GitHub Actions'
    })

    const deploymentId = response.deploymentId || response.id || ''
    if (deploymentId) {
      core.info(`✅ Deployment started (ID: ${deploymentId})`)
    } else {
      core.info(`✅ Deployment triggered`)
    }

    return response
  }

  /**
   * Save compose file content
   */
  async saveComposeFile(composeId: string, composeFile: string): Promise<void> {
    core.info(`📝 Saving compose file for service: ${composeId}`)
    const lineCount = composeFile ? composeFile.split('\n').length : 0
    debugLog(`Saving compose file (${lineCount} lines)`)

    await this.post('/api/compose.saveComposeFile', {
      composeId,
      composeFile
    })
    core.info(`✅ Compose file saved (${lineCount} lines)`)
  }

  /**
   * Save environment variables for compose service
   */
  async saveComposeEnvironment(composeId: string, envString: string): Promise<void> {
    core.info(`🌍 Configuring environment variables for compose service: ${composeId}`)
    const lineCount = envString ? envString.split('\n').length : 0
    debugLog(`Saving ${lineCount} environment variables`)

    await this.post('/api/compose.saveEnvironment', {
      composeId,
      env: envString
    })
    core.info(`✅ Environment variables configured (${lineCount} lines)`)
  }
}
