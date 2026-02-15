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
/**
 * Validation error with detailed context
 */
export declare class ValidationError extends Error {
    field: string;
    value: unknown;
    suggestion?: string | undefined;
    constructor(message: string, field: string, value: unknown, suggestion?: string | undefined);
}
/**
 * Validate memory value (in MB)
 * Dokploy requires minimum 4MiB (4 MB)
 */
export declare function validateMemory(value: number | undefined, fieldName: string): void;
/**
 * Validate CPU value
 * Dokploy requires minimum 0.001 (1 millicpu)
 */
export declare function validateCpu(value: number | undefined, fieldName: string): void;
/**
 * Validate DNS name component
 * Must follow RFC 1123: lowercase alphanumeric and hyphens, cannot start/end with hyphen
 */
export declare function validateDnsName(value: string | undefined, fieldName: string): void;
/**
 * Validate port number
 */
export declare function validatePort(value: number | undefined, fieldName: string): void;
/**
 * Validate replica count
 */
export declare function validateReplicas(value: number | undefined, fieldName: string): void;
/**
 * Validate domain host format
 */
export declare function validateDomainHost(value: string | undefined, fieldName: string): void;
/**
 * Validate Docker image format
 */
export declare function validateDockerImage(value: string | undefined, fieldName: string): void;
/**
 * Validate all inputs before deployment
 * Throws ValidationError if any validation fails
 */
export declare function validateAllInputs(inputs: {
    dockerImage: string;
    deploymentType?: string;
    applicationName?: string;
    projectName?: string;
    environmentName?: string;
    memoryLimit?: number;
    memoryReservation?: number;
    cpuLimit?: number;
    cpuReservation?: number;
    port?: number;
    targetPort?: number;
    applicationPort?: number;
    replicas?: number;
    domainHost?: string;
}): void;
/**
 * Format validation errors for user-friendly display
 */
export declare function formatValidationError(error: ValidationError): string;
