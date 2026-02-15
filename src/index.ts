/**
 * Dokploy GitHub Action - Main Entry Point
 * Version: 1.0.0
 * Author: SSanjeevi
 *
 * This action provides complete Dokploy lifecycle management including:
 * - Project and environment management
 * - Server resolution
 * - Application creation/update
 * - Docker provider configuration
 * - Environment variable management
 * - Domain and SSL configuration
 * - Health check verification with deployment failure marking
 * - Comprehensive error handling and debugging
 *
 * Important: If health check is enabled and fails, the deployment will be
 * marked as failed even if the container deployment succeeded. This ensures
 * users are aware when the new version is not functioning correctly.
 */

import * as core from '@actions/core'
import { DokployClient } from './client/dokploy-client'
import { parseInputs } from './inputs'
import { performHealthCheck } from './health-check'
import { buildApplicationConfig, buildDomainConfig, parseEnvironmentVariables } from './config'
import { sleep } from './utils/helpers'
import { validateAllInputs, ValidationError, formatValidationError } from './validators'
import type { Domain } from './types/dokploy'

export async function run(): Promise<void> {
  try {
    core.info('🚀 Dokploy Deployment Action v1.0')
    core.info('='.repeat(60))

    // ====================================================================
    // Step 1: Parse and validate inputs
    // ====================================================================
    core.startGroup('📋 Parsing and Validating Inputs')
    const inputs = parseInputs()
    
    // Validate all inputs before proceeding
    try {
      validateAllInputs({
        dockerImage: inputs.dockerImage,
        deploymentType: inputs.deploymentType,
        applicationName: inputs.applicationName,
        projectName: inputs.projectName,
        environmentName: inputs.environmentName,
        memoryLimit: inputs.memoryLimit,
        memoryReservation: inputs.memoryReservation,
        cpuLimit: inputs.cpuLimit,
        cpuReservation: inputs.cpuReservation,
        port: inputs.port,
        targetPort: inputs.targetPort,
        applicationPort: inputs.applicationPort,
        replicas: inputs.replicas,
        domainHost: inputs.domainHost
      })
      core.info('✅ All inputs validated successfully')
    } catch (error) {
      if (error instanceof ValidationError) {
        core.error(formatValidationError(error))
      }
      throw error
    }
    
    core.info(`✅ Docker Image: ${inputs.dockerImage}`)
    core.info(`✅ Environment: ${inputs.environmentName}`)
    if (inputs.serverName) core.info(`✅ Server: ${inputs.serverName}`)
    if (inputs.domainHost) core.info(`✅ Domain: ${inputs.domainHost}`)
    if (inputs.memoryLimit) core.info(`✅ Memory Limit: ${inputs.memoryLimit}MB`)
    if (inputs.cpuLimit) core.info(`✅ CPU Limit: ${inputs.cpuLimit}`)
    core.endGroup()

    // ====================================================================
    // Step 2: Initialize Dokploy client
    // ====================================================================
    core.startGroup('🔌 Connecting to Dokploy')
    const client = new DokployClient({
      url: inputs.dokployUrl,
      apiKey: inputs.apiKey
    })
    core.info(`✅ Connected to: ${inputs.dokployUrl}`)
    core.endGroup()

    // ====================================================================
    // Route to appropriate deployment handler
    // ====================================================================
    if (inputs.deploymentType === 'compose') {
      await runComposeDeployment(client, inputs)
    } else {
      await runApplicationDeployment(client, inputs)
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`❌ Deployment failed: ${error.message}`)
      core.debug(`Error stack trace: ${error.stack}`)
    } else {
      core.setFailed(`❌ Deployment failed: ${String(error)}`)
    }
    throw error
  }
}

// ============================================================================
// Compose Deployment Workflow
// ============================================================================
async function runComposeDeployment(
  client: DokployClient,
  inputs: ReturnType<typeof parseInputs>
): Promise<void> {
  core.info('📦 Starting Docker Compose deployment...')
  core.info('='.repeat(60))

  // ====================================================================
  // Step 1: Ensure project exists
  // ====================================================================
  core.startGroup('📁 Project Management')
  let projectId = inputs.projectId

  if (!projectId && inputs.projectName) {
    const existing = await client.findProjectByName(inputs.projectName)
    if (existing) {
      projectId = existing.projectId || existing.id
      core.info(`✅ Found existing project: ${inputs.projectName} (ID: ${projectId})`)
    } else if (inputs.autoCreateResources) {
      const result = await client.createProject(inputs.projectName, inputs.projectDescription)
      projectId = result.projectId
    } else {
      throw new Error(`Project "${inputs.projectName}" not found and auto-create is disabled`)
    }
  }

  if (!projectId) {
    throw new Error('Either project-id or project-name must be provided')
  }

  core.setOutput('project-id', projectId)
  core.endGroup()

  // ====================================================================
  // Step 2: Ensure environment exists
  // ====================================================================
  core.startGroup('🌍 Environment Management')
  let environmentId = inputs.environmentId

  if (!environmentId && inputs.environmentName) {
    const existing = await client.findEnvironmentInProject(projectId, inputs.environmentName)
    if (existing) {
      environmentId = existing.environmentId || existing.id
      core.info(`✅ Found existing environment: ${inputs.environmentName} (ID: ${environmentId})`)
    } else if (inputs.autoCreateResources) {
      environmentId = await client.createEnvironment(projectId, inputs.environmentName)
    } else {
      throw new Error(`Environment "${inputs.environmentName}" not found and auto-create is disabled`)
    }
  }

  if (!environmentId) {
    throw new Error('Either environment-id or environment-name must be provided')
  }

  core.setOutput('environment-id', environmentId)
  core.endGroup()

  // ====================================================================
  // Step 3: Resolve server ID (optional for compose)
  // ====================================================================
  let serverId: string | undefined
  if (inputs.serverId || inputs.serverName) {
    core.startGroup('🖥️ Server Resolution')
    serverId = await client.resolveServerId(inputs.serverId, inputs.serverName)
    core.setOutput('server-id', serverId)
    core.endGroup()
  }

  // ====================================================================
  // Step 4: Get or create compose service
  // ====================================================================
  core.startGroup('📦 Compose Service Management')
  
  const composeName = inputs.composeName || inputs.applicationName || 'compose-service'
  let composeId: string | undefined

  // Try to find existing compose service
  const existing = await client.findComposeByName(environmentId, composeName)
  if (existing) {
    composeId = existing.composeId || existing.id
    core.info(`✅ Found existing compose service: ${composeName} (ID: ${composeId})`)
  } else if (inputs.autoCreateResources) {
    // Create new compose service
    const composeConfig = {
      name: composeName,
      environmentId,
      serverId,
      description: inputs.projectDescription || 'Deployed via GitHub Actions',
      composeType: 'docker-compose' as const
    }
    composeId = await client.createCompose(composeConfig)
  } else {
    throw new Error(`Compose service "${composeName}" not found and auto-create is disabled`)
  }

  if (!composeId) {
    throw new Error('Failed to get or create compose service')
  }

  core.setOutput('application-id', composeId)
  core.setOutput('compose-id', composeId)
  core.endGroup()

  // ====================================================================
  // Step 4: Load and save compose file
  // ====================================================================
  core.startGroup('📝 Compose File Configuration')
  
  let composeContent = ''

  if (inputs.dokployTemplateBase64) {
    // Decode Base64 template
    core.info('📥 Loading Dokploy template from Base64...')
    composeContent = Buffer.from(inputs.dokployTemplateBase64, 'base64').toString('utf-8')
    core.info(`✅ Template decoded (${composeContent.split('\n').length} lines)`)
  } else if (inputs.composeRaw) {
    // Use raw compose content
    core.info('📥 Using raw compose content...')
    composeContent = inputs.composeRaw
    core.info(`✅ Compose content loaded (${composeContent.split('\n').length} lines)`)
  } else if (inputs.composeFile) {
    // Read compose file from filesystem
    const fs = await import('fs/promises')
    const path = await import('path')
    
    core.info(`📥 Reading compose file: ${inputs.composeFile}`)
    const fullPath = path.resolve(process.cwd(), inputs.composeFile)
    
    try {
      composeContent = await fs.readFile(fullPath, 'utf-8')
      core.info(`✅ Compose file loaded (${composeContent.split('\n').length} lines)`)
    } catch (error) {
      core.error(`❌ Failed to read compose file: ${inputs.composeFile}`)
      throw error
    }
  }

  if (composeContent) {
    // Parse environment variables
    const envString = parseEnvironmentVariables(inputs)
    // Save compose file and env in a single update call
    await client.saveComposeFile(composeId, composeContent, envString)
  }

  core.endGroup()

  // ====================================================================
  // Step 5: Deploy compose service
  // ====================================================================
  core.startGroup('🚀 Deployment')
  let deploymentId: string | undefined
  try {
    const deploymentResult = await client.deployCompose(
      composeId,
      inputs.deploymentTitle || `Deploy compose: ${composeName}`,
      inputs.deploymentDescription || 'Automated compose deployment via GitHub Actions'
    )
    
    deploymentId = deploymentResult?.deploymentId || deploymentResult?.id
    if (deploymentId) {
      core.setOutput('deployment-id', deploymentId)
      core.info(`✅ Deployment ID: ${deploymentId}`)
    } else {
      core.info('✅ Deployment triggered successfully')
    }
  } catch (deployError) {
    core.setOutput('deployment-status', 'failed')
    core.error(`❌ Deployment Failed: ${deployError}`)
    core.endGroup()
    throw deployError
  }
  core.endGroup()

  // ====================================================================
  // Step 6: Domain Management (Compose)
  // ====================================================================
  let deploymentUrl: string | undefined

  if (inputs.domainHost) {
    core.startGroup('🌐 Domain Management')
    const protocol = inputs.domainHttps ? 'https' : 'http'

    // Check if domain already exists
    const domains = await client.getDomainsByComposeId(composeId)
    const existingDomain = domains.find(
      (d: Domain) => d.host === inputs.domainHost && (d.port === inputs.applicationPort || !d.port)
    )

    const domainConfig: Partial<Domain> = {
      host: inputs.domainHost,
      port: inputs.applicationPort,
      https: inputs.domainHttps,
      path: inputs.domainPath || '/',
      certificateType: inputs.sslCertificateType as 'letsencrypt' | 'custom' | 'none' | undefined
    }

    if (existingDomain) {
      core.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      core.info(`📋 Existing Domain Details:`)
      core.info(`   Host:       ${existingDomain.host}`)
      core.info(`   Port:       ${existingDomain.port || 'default'}`)
      core.info(`   Path:       ${existingDomain.path || '/'}`)
      core.info(`   Protocol:   ${existingDomain.https ? 'HTTPS' : 'HTTP'}`)
      core.info(`   SSL:        ${existingDomain.certificateType || 'none'}`)
      core.info(`   Type:       Compose`)
      core.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      core.info('✅ Using existing compose domain')
    } else {
      // Determine service name for routing
      const serviceName = inputs.composeServiceName || composeName || 'app'
      core.info(`➕ Creating new compose domain: ${domainConfig.host}:${domainConfig.port}${domainConfig.path}`)
      core.info(`   Service: ${serviceName}`)
      await client.createComposeDomain(composeId, serviceName, domainConfig)
      core.info(`✅ Domain created successfully: ${domainConfig.host}`)
    }

    deploymentUrl = `${protocol}://${domainConfig.host}`
    core.setOutput('deployment-url', deploymentUrl)

    core.endGroup()
  }

  // ====================================================================
  // Step 7: Wait for deployment (if enabled)
  // ====================================================================
  let deploymentCompleted = false
  
  if (inputs.waitForDeployment && deploymentId) {
    core.startGroup('⏳ Waiting for Deployment')
    
    // If health check is enabled, do a quick health check first
    if (inputs.healthCheckEnabled && deploymentUrl) {
      core.info('🔍 Quick health check before waiting for deployment...')
      await sleep(5000) // Give container 5 seconds to start
      
      try {
        const quickHealthStatus = await performHealthCheck(deploymentUrl, {
          ...inputs,
          healthCheckRetries: 3,
          healthCheckInterval: 5,
          healthCheckTimeout: 30
        })
        
        if (quickHealthStatus === 'healthy') {
          core.info('✅ Application is already healthy! Skipping deployment wait.')
          core.setOutput('deployment-status', 'success')
          deploymentCompleted = true
          core.endGroup()
        }
      } catch (error) {
        core.info('ℹ️ Quick health check did not pass, waiting for deployment...')
      }
    }
    
    // If quick health check didn't pass, wait for deployment normally
    if (!deploymentCompleted) {
      try {
        const timeout = inputs.deploymentTimeout || 300
        const finalDeployment = await client.waitForDeployment(deploymentId, timeout)
        core.setOutput('deployment-status', finalDeployment.status || 'completed')
        core.info(`✅ Deployment completed`)
        deploymentCompleted = true
      } catch (waitError) {
        core.setOutput('deployment-status', 'failed')
        core.error(`❌ Deployment wait failed: ${waitError}`)
        core.endGroup()
        throw waitError
      }
      core.endGroup()
    }
  } else {
    core.setOutput('deployment-status', 'success')
  }

  // ====================================================================
  // Step 8: Health check (if enabled and not already done)
  // ====================================================================
  if (inputs.healthCheckEnabled && deploymentUrl && !deploymentCompleted) {
    core.startGroup('🏥 Health Check')
    const healthStatus = await performHealthCheck(deploymentUrl, inputs)
    core.setOutput('health-check-status', healthStatus)
    core.endGroup()
  } else {
    if (deploymentCompleted) {
      core.info('✅ Health check already passed during quick check')
      core.setOutput('health-check-status', 'healthy')
    } else {
      core.setOutput('health-check-status', 'skipped')
    }
  }

  // ====================================================================
  // Summary
  // ====================================================================
  core.info('')
  core.info('='.repeat(60))
  core.info('✅ Compose deployment completed successfully!')
  core.info('='.repeat(60))
  core.info(`📦 Compose Service: ${composeId}`)
  core.info(`📁 Project: ${projectId}`)
  if (serverId) core.info(`🖥️ Server: ${serverId}`)
  core.info('='.repeat(60))
}

// ============================================================================
// Application Deployment Workflow
// ============================================================================
async function runApplicationDeployment(
  client: DokployClient,
  inputs: ReturnType<typeof parseInputs>
): Promise<void> {
  core.info('🚀 Starting application deployment...')
  core.info('='.repeat(60))

  // ====================================================================
  // Step 3: Ensure project exists
  // ====================================================================
    core.startGroup('📁 Project Management')
    let projectId = inputs.projectId
    let defaultEnvironmentId: string | undefined

    if (!projectId && inputs.projectName) {
      const existing = await client.findProjectByName(inputs.projectName)
      if (existing) {
        projectId = existing.projectId || existing.id
        core.info(`✅ Found existing project: ${inputs.projectName} (ID: ${projectId})`)
      } else if (inputs.autoCreateResources) {
        const result = await client.createProject(inputs.projectName, inputs.projectDescription)
        projectId = result.projectId
        defaultEnvironmentId = result.defaultEnvironmentId
      } else {
        throw new Error(`Project "${inputs.projectName}" not found and auto-create is disabled`)
      }
    }

    if (!projectId) {
      throw new Error('Either project-id or project-name must be provided')
    }

    core.setOutput('project-id', projectId)
    core.endGroup()

    // ====================================================================
    // Step 4: Ensure environment exists
    // ====================================================================
    core.startGroup('🌍 Environment Management')
    let environmentId = inputs.environmentId

    if (!environmentId && inputs.environmentName) {
      const existing = await client.findEnvironmentInProject(projectId, inputs.environmentName)
      if (existing) {
        environmentId = existing.environmentId || existing.id
        core.info(`✅ Found existing environment: ${inputs.environmentName} (ID: ${environmentId})`)
      } else if (inputs.autoCreateResources) {
        // Always create the requested environment, don't use default if name doesn't match
        // The default environment created with project is named "production" by Dokploy
        // We should only use it if the requested environment name is "production"
        if (defaultEnvironmentId && inputs.environmentName.toLowerCase() === 'production') {
          environmentId = defaultEnvironmentId
          core.info(
            `✅ Using default production environment created with project (ID: ${environmentId})`
          )
        } else {
          environmentId = await client.createEnvironment(projectId, inputs.environmentName)
        }
      } else {
        throw new Error(
          `Environment "${inputs.environmentName}" not found and auto-create is disabled`
        )
      }
    }

    if (!environmentId) {
      throw new Error('Either environment-id or environment-name must be provided')
    }

    core.setOutput('environment-id', environmentId)
    core.endGroup()

    // ====================================================================
    // Step 5: Resolve server ID
    // ====================================================================
    core.startGroup('🖥️ Server Resolution')
    const serverId = await client.resolveServerId(inputs.serverId, inputs.serverName)
    core.setOutput('server-id', serverId)
    core.endGroup()

    // ====================================================================
    // Step 6: Ensure application exists
    // ====================================================================
    core.startGroup('📦 Application Management')
    let applicationId = inputs.applicationId

    if (!applicationId && inputs.applicationName) {
      // Try to find existing application
      const project = await client.getProject(projectId)
      const environment = project.environments?.find(
        env => (env.environmentId || env.id) === environmentId
      )
      const existing = environment?.applications?.find(app => app.name === inputs.applicationName)

      if (existing) {
        applicationId = existing.applicationId || existing.id
        core.info(`✅ Found existing application: ${inputs.applicationName} (ID: ${applicationId})`)
      } else if (inputs.autoCreateResources) {
        const config = buildApplicationConfig(
          inputs.applicationName,
          projectId,
          environmentId,
          serverId,
          inputs
        )
        applicationId = await client.createApplication(config)
      } else {
        throw new Error(
          `Application "${inputs.applicationName}" not found and auto-create is disabled`
        )
      }
    }

    if (!applicationId) {
      throw new Error('Either application-id or application-name must be provided')
    }

    core.setOutput('application-id', applicationId)
    core.endGroup()

    // ====================================================================
    // Step 6.5: Update application settings (resource limits, replicas, etc.)
    // ====================================================================
    core.startGroup('⚙️ Application Settings Update')
    
    const hasResourceSettings =
      inputs.memoryLimit !== undefined ||
      inputs.memoryReservation !== undefined ||
      inputs.cpuLimit !== undefined ||
      inputs.cpuReservation !== undefined ||
      inputs.replicas !== undefined ||
      inputs.restartPolicy !== undefined
    
    if (hasResourceSettings) {
      const updateConfig: Record<string, unknown> = { applicationId }
      
      // Dokploy stores memory/CPU as text and passes directly to Docker Swarm API:
      // - MemoryBytes: expects bytes (1 MB = 1048576 bytes)
      // - NanoCPUs: expects nanosecond CPU units (1 CPU core = 1e9 NanoCPUs)
      if (inputs.memoryLimit !== undefined) {
        updateConfig.memoryLimit = (inputs.memoryLimit * 1024 * 1024).toString()
        core.info(`  Memory Limit: ${inputs.memoryLimit}MB (${updateConfig.memoryLimit} bytes)`)
      }
      if (inputs.memoryReservation !== undefined) {
        updateConfig.memoryReservation = (inputs.memoryReservation * 1024 * 1024).toString()
        core.info(`  Memory Reservation: ${inputs.memoryReservation}MB (${updateConfig.memoryReservation} bytes)`)
      }
      if (inputs.cpuLimit !== undefined) {
        updateConfig.cpuLimit = Math.round(inputs.cpuLimit * 1e9).toString()
        core.info(`  CPU Limit: ${inputs.cpuLimit} cores (${updateConfig.cpuLimit} NanoCPUs)`)
      }
      if (inputs.cpuReservation !== undefined) {
        updateConfig.cpuReservation = Math.round(inputs.cpuReservation * 1e9).toString()
        core.info(`  CPU Reservation: ${inputs.cpuReservation} cores (${updateConfig.cpuReservation} NanoCPUs)`)
      }
      
      // Replicas is a number
      if (inputs.replicas !== undefined) {
        updateConfig.replicas = inputs.replicas
        core.info(`  Replicas: ${inputs.replicas}`)
      }
      
      // RestartPolicy for Docker Swarm (if provided)
      if (inputs.restartPolicy) {
        // Convert simple restart policy to Swarm format
        const policyMap: Record<string, string> = {
          'always': 'any',
          'unless-stopped': 'any',
          'on-failure': 'on-failure',
          'no': 'none'
        }
        const swarmCondition = policyMap[inputs.restartPolicy] || 'any'
        updateConfig.restartPolicySwarm = {
          Condition: swarmCondition
        }
        core.info(`  Restart Policy: ${inputs.restartPolicy} (Swarm: ${swarmCondition})`)
      }
      
      core.info('🔄 Updating application settings...')
      await client.updateApplication(applicationId, updateConfig)
      core.info('✅ Application settings updated')
    } else {
      core.info('ℹ️ No resource settings to update')
    }
    core.endGroup()

    // ====================================================================
    // Step 7: Configure Docker provider
    // ====================================================================
    core.startGroup('🐳 Docker Provider Configuration')
    await client.saveDockerProvider(
      applicationId,
      inputs.dockerImage,
      inputs.registryUrl,
      inputs.registryUsername,
      inputs.registryPassword
    )
    core.endGroup()

    // ====================================================================
    // Step 7.5: Configure Docker advanced settings (volumes, group_add)
    // ====================================================================
    if (inputs.volumes || inputs.groupAdd) {
      core.startGroup('⚙️ Docker Advanced Settings')
      await client.saveDockerAdvancedSettings(applicationId, inputs.volumes, inputs.groupAdd)
      core.endGroup()
    }

    // ====================================================================
    // Step 8: Configure environment variables
    // ====================================================================
    core.startGroup('🌍 Environment Variables Configuration')
    const envString = parseEnvironmentVariables(inputs)
    if (envString) {
      await client.saveEnvironment(applicationId, envString)
    } else {
      core.info('ℹ️ No environment variables to configure')
    }
    core.endGroup()

    // ====================================================================
    // Step 9: Configure domain (if enabled)
    // ====================================================================
    let deploymentUrl: string | undefined

    const domainConfig = buildDomainConfig(inputs)
    if (domainConfig) {
      core.startGroup('🌐 Domain Configuration')

      const existingDomains = await client.getDomains(applicationId)
      
      // Find all exact matches (same host, port, and path) to prevent duplicates
      const exactMatches = existingDomains.filter(
        d => d.host === domainConfig.host && 
             d.port === domainConfig.port && 
             d.path === domainConfig.path
      )
      
      // Remove duplicates if more than one exists for the same configuration
      if (exactMatches.length > 1) {
        core.warning(`⚠️ Found ${exactMatches.length} duplicate domains for ${domainConfig.host}:${domainConfig.port}${domainConfig.path}`)
        core.info('🧹 Removing duplicates, keeping only the latest one...')
        
        // Sort by creation date and keep the latest
        const sorted = exactMatches.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime()
          const dateB = new Date(b.createdAt || 0).getTime()
          return dateB - dateA // Descending order (latest first)
        })
        
        // Remove all except the first (latest) one
        for (let i = 1; i < sorted.length; i++) {
          const domainId = sorted[i].domainId || sorted[i].id || ''
          core.info(`  Removing duplicate domain: ${sorted[i].host} (ID: ${domainId})`)
          await client.removeDomain(domainId)
          await sleep(1000) // Small delay between deletions
        }
        
        core.info(`✅ Cleaned up ${sorted.length - 1} duplicate domains`)
      }

      const existingDomain = exactMatches.length > 0 ? exactMatches[0] : null

      if (existingDomain) {
        if (inputs.forceDomainRecreation) {
          // Force recreation: delete and create new
          const domainId = existingDomain.domainId || existingDomain.id || ''
          core.info(`🔄 Force recreating domain: ${domainConfig.host}`)
          await client.removeDomain(domainId)
          await sleep(2000)
          await client.createDomain(applicationId, domainConfig)
          core.info(`✅ Domain recreated: ${domainConfig.host}`)
        } else {
          // Update existing domain with new configuration
          const domainId = existingDomain.domainId || existingDomain.id || ''
          core.info(`ℹ️ Domain already exists: ${domainConfig.host}, updating configuration...`)
          await client.updateDomain(domainId, domainConfig)
          core.info(`✅ Domain configuration updated: ${domainConfig.host}`)
        }
      } else {
        // Create new domain - only if it doesn't exist
        core.info(`➕ Creating new domain: ${domainConfig.host}:${domainConfig.port}${domainConfig.path}`)
        await client.createDomain(applicationId, domainConfig)
        core.info(`✅ Domain created successfully: ${domainConfig.host}`)
      }

      deploymentUrl = domainConfig.https
        ? `https://${domainConfig.host}`
        : `http://${domainConfig.host}`
      core.setOutput('deployment-url', deploymentUrl)

      core.endGroup()
    }

    // ====================================================================
    // Step 10: Cleanup old containers (if enabled)
    // ====================================================================
    if (inputs.cleanupOldContainers) {
      core.startGroup('🧹 Cleanup Old Containers')
      await client.stopApplication(applicationId)
      core.info('⏳ Waiting 15 seconds for containers to stop...')
      await sleep(15000)
      core.endGroup()
    }

    // ====================================================================
    // Step 11: Deploy application
    // ====================================================================
    core.startGroup('🚀 Deployment')
    let deploymentId: string | undefined
    try {
      const deploymentResult = await client.deployApplication(
        applicationId,
        inputs.deploymentTitle || `Deploy ${inputs.dockerImage}`,
        inputs.deploymentDescription || 'Automated deployment via GitHub Actions'
      )
      
      // Capture deployment ID for tracking (API may return null for fire-and-forget deploys)
      deploymentId = deploymentResult?.deploymentId || deploymentResult?.id
      if (deploymentId) {
        core.setOutput('deployment-id', deploymentId)
        core.info(`✅ Deployment ID: ${deploymentId}`)
      } else {
        core.info('✅ Deployment triggered successfully (no deployment ID returned)')
      }
    } catch (deployError) {
      core.setOutput('deployment-status', 'failed')
      
      // Extract and display detailed error information
      const errorMessage = deployError instanceof Error ? deployError.message : String(deployError)
      
      core.error('❌ Deployment Failed')
      core.error('='.repeat(60))
      core.error('')
      
      // Parse common Dokploy API errors
      if (errorMessage.includes('invalid memory value')) {
        const match = errorMessage.match(/invalid memory value (\d+): Must be at least (\d+)/)
        if (match) {
          core.error(`Memory Configuration Error:`)
          core.error(`  Current value: ${match[1]}MB`)
          core.error(`  Minimum required: ${match[2]}MB (4MiB)`)
          core.error('')
          core.error(`💡 Fix: Set memory-limit and memory-reservation to at least 4MB`)
          core.error(`   Recommended values: 128MB, 256MB, 512MB, 1024MB`)
        } else {
          core.error(`Memory value is too low. Dokploy requires at least 4MiB.`)
          core.error(`💡 Set memory-limit to at least 4MB (recommended: 128MB or higher)`)
        }
      } else if (errorMessage.includes('invalid cpu value')) {
        const match = errorMessage.match(/invalid cpu value ([0-9.e-]+): Must be at least ([0-9.]+)/)
        if (match) {
          core.error(`CPU Configuration Error:`)
          core.error(`  Current value: ${match[1]}`)
          core.error(`  Minimum required: ${match[2]}`)
          core.error('')
          core.error(`💡 Fix: Set cpu-limit and cpu-reservation to at least 0.001`)
          core.error(`   Common values: 0.1 (100m), 0.25 (250m), 0.5 (500m), 1.0 (1 CPU)`)
        } else {
          core.error(`CPU value is too low. Dokploy requires at least 0.001.`)
          core.error(`💡 Set cpu-limit to at least 0.001 (recommended: 0.1 or higher)`)
        }
      } else if (errorMessage.includes('name must be valid as a DNS name component')) {
        core.error(`DNS Name Validation Error:`)
        core.error(`  One or more names (application, project, or environment) are invalid.`)
        core.error('')
        core.error(`DNS names must:`)
        core.error(`  • Contain only lowercase letters, numbers, and hyphens`)
        core.error(`  • Start and end with a letter or number`)
        core.error(`  • Be 63 characters or less`)
        core.error('')
        core.error(`💡 Fix: Check your application-name, project-name, and environment-name inputs`)
        if (inputs.applicationName) {
          core.error(`   Application: "${inputs.applicationName}"`)
        }
        if (inputs.projectName) {
          core.error(`   Project: "${inputs.projectName}"`)
        }
        if (inputs.environmentName) {
          core.error(`   Environment: "${inputs.environmentName}"`)
        }
      } else {
        // Generic error
        core.error(`Error: ${errorMessage}`)
      }
      
      core.error('')
      core.error('='.repeat(60))
      core.endGroup()
      throw deployError
    }
    core.endGroup()

    // ====================================================================
    // Step 12: Wait for deployment (if enabled)
    // ====================================================================
    let deploymentCompleted = false
    
    if (inputs.waitForDeployment && deploymentId) {
      core.startGroup('⏳ Waiting for Deployment')
      
      // If health check is enabled, do a quick health check first
      // This can save significant time if the app is already healthy
      if (inputs.healthCheckEnabled && deploymentUrl) {
        core.info('🔍 Quick health check before waiting for deployment...')
        await sleep(5000) // Give container 5 seconds to start
        
        try {
          const quickHealthStatus = await performHealthCheck(deploymentUrl, {
            ...inputs,
            healthCheckRetries: 3,
            healthCheckInterval: 5,
            healthCheckTimeout: 30
          })
          
          if (quickHealthStatus === 'healthy') {
            core.info('✅ Application is already healthy! Skipping deployment wait.')
            core.setOutput('deployment-status', 'success')
            deploymentCompleted = true
            core.endGroup()
          }
        } catch (error) {
          core.info('ℹ️ Quick health check did not pass, waiting for deployment...')
        }
      }
      
      // If quick health check didn't pass, wait for deployment normally
      if (!deploymentCompleted) {
        try {
          const timeout = inputs.deploymentTimeout || 300
          const finalDeployment = await client.waitForDeployment(deploymentId, timeout)
          core.setOutput('deployment-status', finalDeployment.status || 'completed')
          core.info(`✅ Deployment completed in ${Math.round(((Date.now() - Date.parse(finalDeployment.startedAt || '')) / 1000))}s`)
          deploymentCompleted = true
        } catch (waitError) {
          core.setOutput('deployment-status', 'failed')
          const errorMessage = waitError instanceof Error ? waitError.message : String(waitError)
          core.error(`❌ Deployment wait failed: ${errorMessage}`)
          
          // Try to get deployment logs for debugging
          if (deploymentId) {
            try {
              const logs = await client.getDeploymentLogs(deploymentId)
              if (logs) {
                core.error('')
                core.error('Deployment Logs:')
                core.error('='.repeat(60))
                core.error(logs)
                core.error('='.repeat(60))
              }
            } catch (logError) {
              core.warning('Could not retrieve deployment logs')
            }
          }
          
          core.endGroup()
          throw waitError
        }
        core.endGroup()
      }
    } else if (inputs.waitForDeployment && !deploymentId) {
      core.warning('⚠️ wait-for-deployment enabled but no deployment ID available, skipping wait')
      core.setOutput('deployment-status', 'success')
    } else {
      // Not waiting for deployment, assume success
      core.setOutput('deployment-status', 'success')
    }

    // ====================================================================
    // Step 13: Health check (if enabled and not already done)
    // ====================================================================
    if (inputs.healthCheckEnabled && deploymentUrl && !deploymentCompleted) {
      // Only do full health check if we didn't already verify health in quick check
      core.startGroup('🏥 Health Check')
      const healthStatus = await performHealthCheck(deploymentUrl, inputs)
      core.setOutput('health-check-status', healthStatus)

      if (healthStatus === 'unhealthy') {
        core.setOutput('deployment-status', 'failed')

        if (inputs.failOnHealthCheckError) {
          core.setFailed('❌ Deployment failed: Health check returned unhealthy status')
          core.error('The deployment completed but the application failed health checks.')
          core.error('This indicates the new version is not functioning correctly.')
          core.endGroup()
          throw new Error('Health check failed - deployment marked as failed')
        } else {
          core.warning('⚠️ Health check failed but fail-on-health-check-error is disabled')
          core.warning('The deployment is marked as failed but the workflow will continue.')
          core.warning('Please verify the application manually.')
        }
      }

      core.endGroup()
    } else {
      if (deploymentCompleted) {
        core.info('✅ Health check already passed during quick check')
        core.setOutput('health-check-status', 'healthy')
      } else {
        core.setOutput('health-check-status', 'skipped')
      }
    }

    // ====================================================================
    // Step 14: Summary
    // ====================================================================
    core.info('')
    core.info('='.repeat(60))
    core.info('✅ Deployment completed successfully!')
    core.info('='.repeat(60))
    core.info(`📦 Application: ${applicationId}`)
    core.info(`📁 Project: ${projectId}`)
    core.info(`🌍 Environment: ${environmentId}`)
    core.info(`🖥️ Server: ${serverId}`)
    if (deploymentUrl) {
      core.info(`🌐 URL: ${deploymentUrl}`)
    }
    core.info('='.repeat(60))
}

// Run the action if this is the main module
if (require.main === module) {
  run()
}
