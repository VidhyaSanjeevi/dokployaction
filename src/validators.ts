/**
 * Input Validation Module for Dokploy Deployments
 * 
 * Validates all inputs before deployment to catch errors early
 * and provide helpful error messages to users.
 * 
 * Based on Dokploy API constraints:
 * - Memory: Minimum 4MiB (not 128MB or 256MB)
 * - CPU: Minimum 0.001 (not 1e-09)
 * - Names: Must be valid DNS names
 */

import * as core from '@actions/core'

/**
 * Validation error with detailed context
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown,
    public suggestion?: string
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Validate memory value (in MB)
 * Dokploy requires minimum 4MiB (4 MB)
 */
export function validateMemory(value: number | undefined, fieldName: string): void {
  if (value === undefined) {
    return // Optional field
  }

  const MIN_MEMORY_MB = 4

  if (value < MIN_MEMORY_MB) {
    throw new ValidationError(
      `${fieldName} must be at least ${MIN_MEMORY_MB}MiB (got ${value}MB)`,
      fieldName,
      value,
      `Set ${fieldName} to at least ${MIN_MEMORY_MB}MB. Common values: 128MB, 256MB, 512MB, 1024MB`
    )
  }

  if (value > 32768) {
    core.warning(
      `⚠️ ${fieldName} is very high (${value}MB). Consider if this is intentional.`
    )
  }
}

/**
 * Validate CPU value
 * Dokploy requires minimum 0.001 (1 millicpu)
 */
export function validateCpu(value: number | undefined, fieldName: string): void {
  if (value === undefined) {
    return // Optional field
  }

  const MIN_CPU = 0.001

  if (value < MIN_CPU) {
    throw new ValidationError(
      `${fieldName} must be at least ${MIN_CPU} (got ${value})`,
      fieldName,
      value,
      `Set ${fieldName} to at least ${MIN_CPU}. Common values: 0.1 (100m), 0.25 (250m), 0.5 (500m), 1.0 (1 CPU), 2.0 (2 CPUs)`
    )
  }

  if (value > 64) {
    core.warning(`⚠️ ${fieldName} is very high (${value} CPUs). Consider if this is intentional.`)
  }
}

/**
 * Validate DNS name component
 * Must follow RFC 1123: lowercase alphanumeric and hyphens, cannot start/end with hyphen
 */
export function validateDnsName(value: string | undefined, fieldName: string): void {
  if (!value) {
    return // Optional field
  }

  // RFC 1123 DNS label rules:
  // - Must contain only lowercase alphanumeric characters or '-'
  // - Must start with an alphanumeric character
  // - Must end with an alphanumeric character
  // - Maximum length 63 characters
  const dnsRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

  if (!dnsRegex.test(value)) {
    const issues: string[] = []

    if (value.length > 63) {
      issues.push('exceeds 63 character limit')
    }
    if (!/^[a-z0-9-]+$/.test(value)) {
      issues.push('contains invalid characters (only lowercase letters, numbers, and hyphens allowed)')
    }
    if (/^-/.test(value)) {
      issues.push('starts with a hyphen')
    }
    if (/-$/.test(value)) {
      issues.push('ends with a hyphen')
    }
    if (/[A-Z]/.test(value)) {
      issues.push('contains uppercase letters (must be lowercase)')
    }

    throw new ValidationError(
      `${fieldName} must be a valid DNS name: ${issues.join(', ')}`,
      fieldName,
      value,
      `Convert "${value}" to a valid DNS name. Example: "${value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').substring(0, 63)}"`
    )
  }
}

/**
 * Validate port number
 */
export function validatePort(value: number | undefined, fieldName: string): void {
  if (value === undefined) {
    return // Optional field
  }

  if (value < 1 || value > 65535) {
    throw new ValidationError(
      `${fieldName} must be between 1 and 65535 (got ${value})`,
      fieldName,
      value,
      'Use a valid port number between 1 and 65535. Common ports: 80 (HTTP), 443 (HTTPS), 3000, 8080'
    )
  }
}

/**
 * Validate replica count
 */
export function validateReplicas(value: number | undefined, fieldName: string): void {
  if (value === undefined) {
    return // Optional field
  }

  if (value < 0) {
    throw new ValidationError(
      `${fieldName} must be non-negative (got ${value})`,
      fieldName,
      value,
      'Set replicas to 0 to stop the application, or 1+ to run containers'
    )
  }

  if (value > 100) {
    core.warning(
      `⚠️ ${fieldName} is very high (${value}). This will create ${value} containers. Consider if this is intentional.`
    )
  }
}

/**
 * Validate domain host format
 */
export function validateDomainHost(value: string | undefined, fieldName: string): void {
  if (!value) {
    return // Optional field
  }

  // Basic domain validation (not exhaustive, but catches common errors)
  const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

  if (!domainRegex.test(value)) {
    throw new ValidationError(
      `${fieldName} is not a valid domain name`,
      fieldName,
      value,
      'Use a valid fully-qualified domain name. Example: app.example.com, api.mydomain.com'
    )
  }
}

/**
 * Validate Docker image format
 */
export function validateDockerImage(value: string | undefined, fieldName: string): void {
  if (!value) {
    throw new ValidationError(
      `${fieldName} is required`,
      fieldName,
      value,
      'Provide a Docker image in format: registry/repo:tag (example: ghcr.io/user/app:latest)'
    )
  }

  // Basic Docker image format: [registry/]repository[:tag]
  // Allow alphanumeric, dots, hyphens, slashes, underscores, colons
  const imageRegex = /^[a-z0-9._/-]+:[a-z0-9._-]+$/i

  if (!imageRegex.test(value)) {
    throw new ValidationError(
      `${fieldName} format is invalid`,
      fieldName,
      value,
      'Use format: registry/repository:tag (example: ghcr.io/myorg/myapp:v1.0.0)'
    )
  }
}

/**
 * Validate all inputs before deployment
 * Throws ValidationError if any validation fails
 */
export function validateAllInputs(inputs: {
  dockerImage: string
  deploymentType?: string
  applicationName?: string
  projectName?: string
  environmentName?: string
  memoryLimit?: number
  memoryReservation?: number
  cpuLimit?: number
  cpuReservation?: number
  port?: number
  targetPort?: number
  applicationPort?: number
  replicas?: number
  domainHost?: string
}): void {
  const errors: ValidationError[] = []

  // Only validate docker-image for application deployments
  // Compose deployments define the image in docker-compose.yml
  if (inputs.deploymentType !== 'compose') {
    try {
      validateDockerImage(inputs.dockerImage, 'docker-image')
    } catch (e) {
      if (e instanceof ValidationError) errors.push(e)
    }
  }

  try {
    validateDnsName(inputs.applicationName, 'application-name')
  } catch (e) {
    if (e instanceof ValidationError) errors.push(e)
  }

  try {
    validateDnsName(inputs.projectName, 'project-name')
  } catch (e) {
    if (e instanceof ValidationError) errors.push(e)
  }

  try {
    validateDnsName(inputs.environmentName, 'environment-name')
  } catch (e) {
    if (e instanceof ValidationError) errors.push(e)
  }

  try {
    validateMemory(inputs.memoryLimit, 'memory-limit')
  } catch (e) {
    if (e instanceof ValidationError) errors.push(e)
  }

  try {
    validateMemory(inputs.memoryReservation, 'memory-reservation')
  } catch (e) {
    if (e instanceof ValidationError) errors.push(e)
  }

  try {
    validateCpu(inputs.cpuLimit, 'cpu-limit')
  } catch (e) {
    if (e instanceof ValidationError) errors.push(e)
  }

  try {
    validateCpu(inputs.cpuReservation, 'cpu-reservation')
  } catch (e) {
    if (e instanceof ValidationError) errors.push(e)
  }

  try {
    validatePort(inputs.port, 'port')
  } catch (e) {
    if (e instanceof ValidationError) errors.push(e)
  }

  try {
    validatePort(inputs.targetPort, 'target-port')
  } catch (e) {
    if (e instanceof ValidationError) errors.push(e)
  }

  try {
    validatePort(inputs.applicationPort, 'application-port')
  } catch (e) {
    if (e instanceof ValidationError) errors.push(e)
  }

  try {
    validateReplicas(inputs.replicas, 'replicas')
  } catch (e) {
    if (e instanceof ValidationError) errors.push(e)
  }

  try {
    validateDomainHost(inputs.domainHost, 'domain-host')
  } catch (e) {
    if (e instanceof ValidationError) errors.push(e)
  }

  if (errors.length > 0) {
    core.error('❌ Validation failed with the following errors:')
    core.error('')

    errors.forEach((error, index) => {
      core.error(`${index + 1}. ${error.message}`)
      if (error.suggestion) {
        core.error(`   💡 Suggestion: ${error.suggestion}`)
      }
      core.error('')
    })

    throw new Error(
      `Input validation failed with ${errors.length} error${errors.length > 1 ? 's' : ''}. See details above.`
    )
  }
}

/**
 * Format validation errors for user-friendly display
 */
export function formatValidationError(error: ValidationError): string {
  let message = `❌ Validation Error: ${error.message}\n`
  message += `   Field: ${error.field}\n`
  message += `   Value: ${JSON.stringify(error.value)}\n`
  if (error.suggestion) {
    message += `   💡 Suggestion: ${error.suggestion}\n`
  }
  return message
}
