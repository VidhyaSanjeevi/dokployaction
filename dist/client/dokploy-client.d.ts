/**
 * Dokploy API Client
 * Comprehensive wrapper for all Dokploy API endpoints
 */
import type { DokployConfig, Project, Environment, Server, Application, Domain, Container, Deployment } from '../types/dokploy';
export declare class DokployClient {
    private baseUrl;
    private apiKey;
    private client;
    private config;
    constructor(config: DokployConfig);
    /**
     * Make a GET request to Dokploy API
     */
    get<T>(endpoint: string): Promise<T>;
    /**
     * Make a POST request to Dokploy API
     */
    post<T, B = unknown>(endpoint: string, body?: B): Promise<T>;
    getAllProjects(): Promise<Project[]>;
    getProject(projectId: string): Promise<Project>;
    findProjectByName(projectName: string): Promise<Project | undefined>;
    createProject(name: string, description?: string): Promise<{
        projectId: string;
        defaultEnvironmentId?: string;
    }>;
    createEnvironment(projectId: string, environmentName: string): Promise<string>;
    findEnvironmentInProject(projectId: string, environmentName: string): Promise<Environment | undefined>;
    getAllServers(): Promise<Server[]>;
    findServerByName(serverName: string): Promise<Server | undefined>;
    resolveServerId(serverId?: string, serverName?: string): Promise<string>;
    getApplication(applicationId: string): Promise<Application>;
    createApplication(config: Partial<Application>): Promise<string>;
    updateApplication(applicationId: string, config: Partial<Application>): Promise<void>;
    saveApplicationResources(applicationId: string, memoryLimit?: number, memoryReservation?: number, cpuLimit?: number, cpuReservation?: number, replicas?: number, restartPolicy?: string): Promise<void>;
    saveDockerProvider(applicationId: string, dockerImage: string, registryUrl?: string, username?: string, password?: string): Promise<void>;
    saveEnvironment(applicationId: string, envString: string): Promise<void>;
    createDomain(applicationId: string, domainConfig: Partial<Domain>): Promise<Domain>;
    removeDomain(domainId: string): Promise<void>;
    getDomains(applicationId: string): Promise<Domain[]>;
    stopApplication(applicationId: string): Promise<void>;
    deployApplication(applicationId: string, title?: string, description?: string): Promise<Deployment>;
    getContainers(applicationId: string): Promise<Container[]>;
    removeContainer(containerName: string): Promise<void>;
}
//# sourceMappingURL=dokploy-client.d.ts.map