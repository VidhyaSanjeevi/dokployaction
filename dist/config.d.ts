/**
 * Configuration builders for applications and domains
 */
import type { ActionInputs, Application, Domain } from './types/dokploy';
export declare function buildApplicationConfig(name: string, projectId: string, environmentId: string, serverId: string, inputs: ActionInputs): Partial<Application>;
export declare function buildDomainConfig(inputs: ActionInputs): Partial<Domain> | null;
export declare function parseEnvironmentVariables(inputs: ActionInputs): string;
