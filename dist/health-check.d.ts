/**
 * Health check functionality
 */
import type { ActionInputs } from './types/dokploy';
export declare function performHealthCheck(deploymentUrl: string, inputs: ActionInputs): Promise<string>;
