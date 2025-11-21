/**
 * Utility functions for parsing and validating inputs
 */
export declare function parseIntInput(value: string | undefined, name: string): number | undefined;
export declare function parseBooleanInput(value: string | undefined): boolean | undefined;
export declare function parseOptionalStringInput(key: string): string | undefined;
export declare function parseCpuLimit(value: string | undefined): number | undefined;
export declare function sleep(ms: number): Promise<void>;
export declare function debugLog(message: string, data?: unknown): void;
export declare function logApiRequest(method: string, url: string, body?: unknown): void;
export declare function logApiResponse(status: number, response?: unknown): void;
export declare function sanitizeSecret(value: string): void;
//# sourceMappingURL=helpers.d.ts.map