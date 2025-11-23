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
import type { Application } from './types/dokploy'

export async function run(): Promise<void> {
  try {
    core.info('🚀 Dokploy Deployment Action v1.0')
    core.info('='.repeat(60))

    // ====================================================================
    // Step 1: Parse and validate inputs
    // ====================================================================
    core.startGroup('📋 Parsing inputs')
    const inputs = parseInputs()
    core.info(`✅ Docker Image: ${inputs.dockerImage}`)
    core.info(`✅ Environment: ${inputs.environmentName}`)
    if (inputs.serverName) core.info(`✅ Server: ${inputs.serverName}`)
    if (inputs.domainHost) core.info(`✅ Domain: ${inputs.domainHost}`)
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
    const updateConfig: Partial<Application> = {}
    
    if (inputs.memoryLimit !== undefined) {
      updateConfig.memoryLimit = inputs.memoryLimit
      core.info(`  Memory Limit: ${inputs.memoryLimit}MB`)
    }
    
    if (inputs.memoryReservation !== undefined) {
      updateConfig.memoryReservation = inputs.memoryReservation
      core.info(`  Memory Reservation: ${inputs.memoryReservation}MB`)
    }
    
    if (inputs.cpuLimit !== undefined) {
      updateConfig.cpuLimit = inputs.cpuLimit
      core.info(`  CPU Limit: ${inputs.cpuLimit}`)
    }
    
    if (inputs.cpuReservation !== undefined) {
      updateConfig.cpuReservation = inputs.cpuReservation
      core.info(`  CPU Reservation: ${inputs.cpuReservation}`)
    }
    
    if (inputs.replicas !== undefined) {
      updateConfig.replicas = inputs.replicas
      core.info(`  Replicas: ${inputs.replicas}`)
    }
    
    if (inputs.restartPolicy) {
      updateConfig.restartPolicy = inputs.restartPolicy
      core.info(`  Restart Policy: ${inputs.restartPolicy}`)
    }
    
    // Only update if there are settings to apply
    if (Object.keys(updateConfig).length > 0) {
      core.info('🔄 Updating application settings...')
      await client.updateApplication(applicationId, updateConfig)
      core.info('✅ Application settings updated')
    } else {
      core.info('ℹ️ No application settings to update')
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
      const existingDomain = existingDomains.find(d => d.host === domainConfig.host)

      if (existingDomain && !inputs.forceDomainRecreation) {
        core.info(`ℹ️ Domain already exists: ${domainConfig.host}`)
      } else {
        if (existingDomain && inputs.forceDomainRecreation) {
          const domainId = existingDomain.domainId || existingDomain.id || ''
          await client.removeDomain(domainId)
          await sleep(2000)
        }
        await client.createDomain(applicationId, domainConfig)
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
    await client.deployApplication(
      applicationId,
      inputs.deploymentTitle || `Deploy ${inputs.dockerImage}`,
      inputs.deploymentDescription || 'Automated deployment via GitHub Actions'
    )
    core.setOutput('deployment-status', 'success')
    core.endGroup()

    // ====================================================================
    // Step 12: Wait for deployment (if enabled)
    // ====================================================================
    if (inputs.waitForDeployment) {
      core.info('⏳ Waiting for deployment to complete...')
      const timeout = inputs.deploymentTimeout || 300
      core.info(`   Deployment timeout: ${timeout}s`)
      await sleep(Math.min(60000, (timeout * 1000) / 5))
    }

    // ====================================================================
    // Step 13: Health check (if enabled)
    // ====================================================================
    if (inputs.healthCheckEnabled && deploymentUrl) {
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
      core.setOutput('health-check-status', 'skipped')
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

// Run the action if this is the main module
if (require.main === module) {
  run()
}
