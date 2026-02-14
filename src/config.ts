/**
 * Configuration builders for applications and domains
 */

import type { ActionInputs, Application, Domain } from './types/dokploy'

export function buildApplicationConfig(
  name: string,
  projectId: string,
  environmentId: string,
  serverId: string,
  inputs: ActionInputs
): Partial<Application> {
  const config: Partial<Application> = {
    name,
    projectId,
    environmentId,
    serverId,
    applicationStatus: 'idle',
    title: inputs.applicationTitle || name,
    description: inputs.applicationDescription || `Automated deployment: ${name}`,
    port: inputs.port || 8080,
    targetPort: inputs.targetPort || 8080,
    restartPolicy: inputs.restartPolicy || 'unless-stopped'
  }

  if (inputs.containerName) {
    // Support template variables: {app}, {version}, {env}
    let containerName = inputs.containerName
    
    // Extract version from docker image (e.g., "ghcr.io/user/app:v1.0.0" -> "v1.0.0")
    const imageVersion = inputs.dockerImage?.split(':')[1] || 'latest'
    
    // Replace template variables
    containerName = containerName
      .replace(/{app}/g, name)
      .replace(/{version}/g, imageVersion)
      .replace(/{env}/g, inputs.environmentName || 'production')
    
    // Docker container name constraints:
    // - Max 63 characters (DNS label limit)
    // - Only alphanumeric, dash, underscore, period
    // - Cannot start with dash or period
    
    // Sanitize: replace invalid characters with dash
    containerName = containerName
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/^[.-]+/, '') // Remove leading dashes/periods
      .replace(/[.-]+$/, '') // Remove trailing dashes/periods
    
    // Truncate to 63 characters (DNS label limit)
    const MAX_LENGTH = 63
    if (containerName.length > MAX_LENGTH) {
      // Try to preserve the version suffix if present
      const parts = containerName.split('-')
      const lastPart = parts[parts.length - 1]
      
      // If last part looks like a version (starts with v or contains dots), preserve it
      if (lastPart && (/^v\d/.test(lastPart) || /\d+\.\d+/.test(lastPart))) {
        const prefixMaxLength = MAX_LENGTH - lastPart.length - 1 // -1 for the dash
        const prefix = containerName.substring(0, prefixMaxLength)
        containerName = `${prefix}-${lastPart}`
      } else {
        containerName = containerName.substring(0, MAX_LENGTH)
      }
      
      // Clean up any trailing dashes from truncation
      containerName = containerName.replace(/[.-]+$/, '')
    }
    
    config.appName = containerName
  }

  if (inputs.memoryLimit) {
    config.memoryLimit = inputs.memoryLimit
  }

  if (inputs.memoryReservation) {
    config.memoryReservation = inputs.memoryReservation
  }

  if (inputs.cpuLimit) {
    // Dokploy passes CPU values directly to Docker's NanoCPUs field (1 CPU = 1e9 NanoCPUs)
    config.cpuLimit = Math.round(inputs.cpuLimit * 1e9)
  }

  if (inputs.cpuReservation) {
    config.cpuReservation = Math.round(inputs.cpuReservation * 1e9)
  }

  if (inputs.replicas) {
    config.replicas = inputs.replicas
  }

  return config
}

export function buildDomainConfig(inputs: ActionInputs): Partial<Domain> | null {
  if (!inputs.domainHost) {
    return null
  }

  const applicationPort = inputs.applicationPort || inputs.targetPort || 8080

  return {
    host: inputs.domainHost,
    path: inputs.domainPath || '/',
    port: applicationPort,
    https: inputs.domainHttps !== false,
    certificateType:
      (inputs.sslCertificateType as 'letsencrypt' | 'custom' | 'none') || 'letsencrypt',
    domainType: 'application',
    stripPath: inputs.domainStripPath || false
  }
}

export function parseEnvironmentVariables(inputs: ActionInputs): string {
  // Priority: env-from-json > env-file > env

  // Try JSON format first
  if (inputs.envFromJson) {
    try {
      const obj = JSON.parse(inputs.envFromJson)
      return Object.entries(obj)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n')
    } catch (error) {
      throw new Error(
        `Failed to parse env-from-json: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // Use direct string format
  if (inputs.env) {
    return inputs.env
  }

  return ''
}
