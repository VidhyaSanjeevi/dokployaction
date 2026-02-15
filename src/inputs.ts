/**
 * Parse GitHub Action inputs
 */

import * as core from '@actions/core'
import type { ActionInputs } from './types/dokploy'
import {
  parseOptionalStringInput,
  parseIntInput,
  parseBooleanInput,
  parseCpuLimit,
  sanitizeSecret
} from './utils/helpers'

export function parseInputs(): ActionInputs {
  // Core configuration with enhanced validation
  const dokployUrl = core.getInput('dokploy-url', { required: false })
  const apiKey = core.getInput('api-key', { required: false })
  const dockerImage = core.getInput('docker-image', { required: false })
  const deploymentType = core.getInput('deployment-type', { required: false }) || 'application'

  // Validate required inputs with helpful error messages
  if (!dokployUrl || dokployUrl.trim() === '') {
    core.error('❌ Missing required input: dokploy-url')
    core.error('')
    core.error('The dokploy-url input is required but was not provided or is empty.')
    core.error('')
    core.error('Possible causes:')
    core.error('  1. The secret DOKPLOY_URL is not set in your repository settings')
    core.error('  2. The secret is set at environment level but not repository level')
    core.error('  3. The secret is not being passed correctly in your workflow')
    core.error('')
    core.error('To fix this:')
    core.error('  1. Go to: Settings → Secrets and variables → Actions')
    core.error('  2. Add a repository secret named DOKPLOY_URL')
    core.error(
      '  3. Set the value to your Dokploy instance URL (e.g., https://dokploy.example.com)'
    )
    core.error('')
    core.error('In your workflow, use:')
    core.error('  with:')
    core.error('    dokploy-url: ${{ secrets.DOKPLOY_URL }}')
    core.error('')
    throw new Error('Required input dokploy-url is missing or empty')
  }

  if (!apiKey || apiKey.trim() === '') {
    core.error('❌ Missing required input: api-key')
    core.error('')
    core.error('The api-key input is required but was not provided or is empty.')
    core.error('')
    core.error('Possible causes:')
    core.error('  1. The secret DOKPLOY_API_TOKEN (or similar) is not set in your repository')
    core.error('  2. The secret is set at environment level but not repository level')
    core.error('  3. The secret is not being passed correctly in your workflow')
    core.error('')
    core.error('To fix this:')
    core.error('  1. Go to: Settings → Secrets and variables → Actions')
    core.error('  2. Add a repository secret named DOKPLOY_API_TOKEN')
    core.error('  3. Set the value to your Dokploy API key')
    core.error('')
    core.error('In your workflow, use:')
    core.error('  with:')
    core.error('    api-key: ${{ secrets.DOKPLOY_API_TOKEN }}')
    core.error('')
    throw new Error('Required input api-key is missing or empty')
  }

  // Docker image is required only for application deployments
  if (deploymentType === 'application' && (!dockerImage || dockerImage.trim() === '')) {
    core.error('❌ Missing required input: docker-image')
    core.error('')
    core.error('The docker-image input is required for application deployments.')
    core.error('')
    core.error('Possible causes:')
    core.error('  1. The docker-image input was not provided in your workflow')
    core.error('  2. The variable used to construct the image is empty')
    core.error('  3. A previous build step failed to produce the image')
    core.error('')
    core.error('To fix this:')
    core.error('  1. Ensure your build step outputs the image name')
    core.error('  2. Pass the image to this action:')
    core.error('     with:')
    core.error('       docker-image: ghcr.io/owner/repo:tag')
    core.error('')
    core.error('Or if using compose deployment:')
    core.error('     with:')
    core.error('       deployment-type: compose')
    core.error('       compose-file: path/to/docker-compose.yml')
    core.error('')
    throw new Error('Required input docker-image is missing or empty for application deployment')
  }

  // For compose deployments, require at least one compose source
  if (deploymentType === 'compose') {
    const composeFile = parseOptionalStringInput('compose-file')
    const composeRaw = parseOptionalStringInput('compose-raw')
    const dokployTemplateBase64 = parseOptionalStringInput('dokploy-template-base64')
    
    if (!composeFile && !composeRaw && !dokployTemplateBase64) {
      core.error('❌ Missing compose source for compose deployment')
      core.error('')
      core.error('When deployment-type is \"compose\", you must provide one of:')
      core.error('  • compose-file: Path to docker-compose.yml')
      core.error('  • compose-raw: Raw docker-compose.yml content')
      core.error('  • dokploy-template-base64: Base64-encoded Dokploy template')
      core.error('')
      throw new Error('Compose deployment requires compose-file, compose-raw, or dokploy-template-base64')
    }
  }

  // Validate URL format
  try {
    new URL(dokployUrl)
  } catch (error) {
    core.error('❌ Invalid dokploy-url format')
    core.error('')
    core.error(`The provided URL is not valid: ${dokployUrl}`)
    core.error('')
    core.error('Expected format: https://dokploy.example.com')
    core.error('Make sure to include the protocol (https://) and domain name.')
    core.error('')
    throw new Error(`Invalid dokploy-url format: ${dokployUrl}`)
  }

  // Mask secrets
  sanitizeSecret(apiKey)
  const registryPassword = parseOptionalStringInput('registry-password')
  if (registryPassword) {
    sanitizeSecret(registryPassword)
  }

  return {
    // Core
    dokployUrl,
    apiKey,
    dockerImage,

    // Deployment Type
    deploymentType: deploymentType as 'application' | 'compose',

    // Docker Compose
    composeFile: parseOptionalStringInput('compose-file'),
    composeRaw: parseOptionalStringInput('compose-raw'),
    composeName: parseOptionalStringInput('compose-name'),
    dokployTemplateBase64: parseOptionalStringInput('dokploy-template-base64'),

    // Project & Environment
    projectId: parseOptionalStringInput('project-id'),
    projectName: parseOptionalStringInput('project-name'),
    projectDescription: parseOptionalStringInput('project-description'),
    environmentId: parseOptionalStringInput('environment-id'),
    environmentName: parseOptionalStringInput('environment-name') || 'production',
    autoCreateResources:
      parseBooleanInput(parseOptionalStringInput('auto-create-resources')) ?? true,

    // Application
    applicationId: parseOptionalStringInput('application-id'),
    applicationName: parseOptionalStringInput('application-name'),
    applicationTitle: parseOptionalStringInput('application-title'),
    applicationDescription: parseOptionalStringInput('application-description'),
    containerName: parseOptionalStringInput('container-name'),

    // Server
    serverId: parseOptionalStringInput('server-id'),
    serverName: parseOptionalStringInput('server-name') || 'Hostinger-Server1',

    // Resources
    memoryLimit: parseIntInput(parseOptionalStringInput('memory-limit'), 'memory-limit'),
    memoryReservation: parseIntInput(
      parseOptionalStringInput('memory-reservation'),
      'memory-reservation'
    ),
    cpuLimit: parseCpuLimit(parseOptionalStringInput('cpu-limit')),
    cpuReservation: parseCpuLimit(parseOptionalStringInput('cpu-reservation')),
    port: parseIntInput(parseOptionalStringInput('port'), 'port'),
    targetPort: parseIntInput(parseOptionalStringInput('target-port'), 'target-port'),
    restartPolicy: parseOptionalStringInput('restart-policy'),

    // Docker Advanced
    volumes: parseOptionalStringInput('volumes'),
    groupAdd: parseOptionalStringInput('group-add'),

    // Scaling
    replicas: parseIntInput(parseOptionalStringInput('replicas'), 'replicas'),

    // Registry
    registryUrl: parseOptionalStringInput('registry-url') || 'ghcr.io',
    registryUsername: parseOptionalStringInput('registry-username'),
    registryPassword,

    // Environment Variables
    env: parseOptionalStringInput('env'),
    envFile: parseOptionalStringInput('env-file'),
    envFromJson: parseOptionalStringInput('env-from-json'),

    // Domain & SSL
    domainHost: parseOptionalStringInput('domain-host'),
    domainPath: parseOptionalStringInput('domain-path'),
    applicationPort: parseIntInput(
      parseOptionalStringInput('application-port'),
      'application-port'
    ),
    domainHttps: parseBooleanInput(parseOptionalStringInput('domain-https')) ?? true,
    sslCertificateType: parseOptionalStringInput('ssl-certificate-type'),
    domainStripPath: parseBooleanInput(parseOptionalStringInput('domain-strip-path')),
    forceDomainRecreation: parseBooleanInput(parseOptionalStringInput('force-domain-recreation')),

    // Deployment
    deploymentTitle: parseOptionalStringInput('deployment-title'),
    deploymentDescription: parseOptionalStringInput('deployment-description'),
    rollbackActive: parseBooleanInput(parseOptionalStringInput('rollback-active')),
    waitForDeployment: parseBooleanInput(parseOptionalStringInput('wait-for-deployment')) ?? true,
    deploymentTimeout: parseIntInput(parseOptionalStringInput('timeout'), 'timeout'),
    cleanupOldContainers: parseBooleanInput(parseOptionalStringInput('cleanup-old-containers')),

    // Health Check
    healthCheckEnabled: parseBooleanInput(parseOptionalStringInput('health-check-enabled')) ?? true,
    healthCheckPath: parseOptionalStringInput('health-check-path'),
    healthCheckTimeout: parseIntInput(
      parseOptionalStringInput('health-check-timeout'),
      'health-check-timeout'
    ),
    healthCheckRetries: parseIntInput(
      parseOptionalStringInput('health-check-retries'),
      'health-check-retries'
    ),
    healthCheckInterval: parseIntInput(
      parseOptionalStringInput('health-check-interval'),
      'health-check-interval'
    ),
    failOnHealthCheckError:
      parseBooleanInput(parseOptionalStringInput('fail-on-health-check-error')) ?? true,

    // Debug
    debugMode: parseBooleanInput(parseOptionalStringInput('debug-mode')),
    logApiRequests: parseBooleanInput(parseOptionalStringInput('log-api-requests')),
    logApiResponses: parseBooleanInput(parseOptionalStringInput('log-api-responses'))
  }
}
