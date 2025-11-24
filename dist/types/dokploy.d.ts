/**
 * Dokploy API Types
 * Generated from Dokploy Swagger/OpenAPI specification
 */
export interface DokployConfig {
    url: string;
    apiKey: string;
    debugMode?: boolean;
}
export interface Project {
    projectId?: string;
    id?: string;
    name: string;
    description?: string;
    createdAt?: string;
    environments?: Environment[];
}
export interface Environment {
    environmentId?: string;
    id?: string;
    name: string;
    projectId: string;
    applications?: Application[];
}
export interface Server {
    serverId?: string;
    id?: string;
    name: string;
    ipAddress?: string;
    status?: string;
}
export interface Application {
    applicationId?: string;
    id?: string;
    name: string;
    title?: string;
    description?: string;
    projectId: string;
    environmentId: string;
    serverId: string;
    dockerImage?: string;
    port?: number;
    targetPort?: number;
    status?: string;
    applicationStatus?: string;
    replicas?: number;
    memoryLimit?: number;
    memoryReservation?: number;
    cpuLimit?: number;
    cpuReservation?: number;
    restartPolicy?: string;
    appName?: string;
    env?: Record<string, string> | string;
    domains?: Domain[];
    containers?: Container[];
}
export interface Domain {
    domainId?: string;
    id?: string;
    host: string;
    path?: string;
    port?: number;
    https?: boolean;
    certificateType?: 'letsencrypt' | 'custom' | 'none';
    domainType?: string;
    stripPath?: boolean;
    createdAt?: string;
}
export interface Container {
    containerId?: string;
    id?: string;
    name: string;
    status?: string;
    image?: string;
    createdAt?: string;
    created?: string;
}
export interface Deployment {
    deploymentId?: string;
    id?: string;
    applicationId: string;
    title?: string;
    description?: string;
    status?: 'deploying' | 'completed' | 'failed' | 'pending';
    startedAt?: string;
    completedAt?: string;
    logs?: string;
}
export interface HealthCheck {
    url: string;
    maxRetries?: number;
    retryInterval?: number;
    expectedStatus?: number;
    timeout?: number;
}
export interface ActionInputs {
    dokployUrl: string;
    apiKey: string;
    dockerImage: string;
    projectId?: string;
    projectName?: string;
    projectDescription?: string;
    environmentId?: string;
    environmentName?: string;
    autoCreateResources?: boolean;
    applicationId?: string;
    applicationName?: string;
    applicationTitle?: string;
    applicationDescription?: string;
    containerName?: string;
    serverId?: string;
    serverName?: string;
    memoryLimit?: number;
    memoryReservation?: number;
    cpuLimit?: number;
    cpuReservation?: number;
    port?: number;
    targetPort?: number;
    restartPolicy?: string;
    replicas?: number;
    registryUrl?: string;
    registryUsername?: string;
    registryPassword?: string;
    env?: string;
    envFile?: string;
    envFromJson?: string;
    domainHost?: string;
    domainPath?: string;
    applicationPort?: number;
    domainHttps?: boolean;
    sslCertificateType?: string;
    domainStripPath?: boolean;
    forceDomainRecreation?: boolean;
    deploymentTitle?: string;
    deploymentDescription?: string;
    rollbackActive?: boolean;
    waitForDeployment?: boolean;
    deploymentTimeout?: number;
    cleanupOldContainers?: boolean;
    healthCheckEnabled?: boolean;
    healthCheckPath?: string;
    healthCheckTimeout?: number;
    healthCheckRetries?: number;
    healthCheckInterval?: number;
    failOnHealthCheckError?: boolean;
    debugMode?: boolean;
    logApiRequests?: boolean;
    logApiResponses?: boolean;
}
export interface ActionOutputs {
    applicationId?: string;
    projectId?: string;
    environmentId?: string;
    serverId?: string;
    deploymentUrl?: string;
    deploymentStatus?: string;
    healthCheckStatus?: string;
}
//# sourceMappingURL=dokploy.d.ts.map