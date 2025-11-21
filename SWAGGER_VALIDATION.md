# Swagger API Validation & Model Mapping

## Overview

This document describes the Swagger/OpenAPI validation system implemented for the Dokploy GitHub Action. The system ensures that our TypeScript types and API client methods match the official Dokploy API specification.

## Files Added

### 1. `swagger/dokploy-swagger.json`
- Official Dokploy OpenAPI 3.0.3 specification
- Contains all API endpoint definitions, request schemas, and parameters
- Source of truth for API contracts

### 2. `src/__tests__/swagger-validation.test.ts`
- Automated tests that validate our implementation against the Swagger spec
- Validates request schemas for all major endpoints
- Ensures required fields and types match the specification
- Helps catch API changes and mismatches early

### 3. `src/__tests__/dokploy-client.test.ts`
- Comprehensive unit tests for the DokployClient class
- Tests response parsing logic for all create operations
- Validates error handling when API responses are malformed
- Ensures ID extraction works correctly

## Key Changes to Existing Files

### `src/client/dokploy-client.ts`

#### Fixed Bug: Missing Config Storage
**Before:**
```typescript
constructor(config: DokployConfig) {
  this.baseUrl = config.url.replace(/\/$/, '')
  this.apiKey = config.apiKey
  // config was not stored, causing this.config.debugMode to fail
}
```

**After:**
```typescript
private config: DokployConfig

constructor(config: DokployConfig) {
  this.config = config  // ✅ Now stored
  this.baseUrl = config.url.replace(/\/$/, '')
  this.apiKey = config.apiKey
}
```

#### Improved Response Parsing
**Before:**
```typescript
async createProject(name: string, description?: string): Promise<string> {
  const result = await this.post<any>('/api/project.create', {...})
  const projectId = result.projectId || result.id || result.data?.projectId || result.data?.id || ''
  // Tried too many field variations, unclear what the actual response structure is
}
```

**After:**
```typescript
async createProject(name: string, description?: string): Promise<string> {
  const project = await this.post<Project>('/api/project.create', {...})
  debugLog('Project creation response', project)
  
  const projectId = project.projectId || project.id || ''
  if (!projectId) {
    core.error('❌ Failed to get project ID from API response')
    core.error(`Full response: ${JSON.stringify(project, null, 2)}`)
    throw new Error('Failed to create project: No project ID in response')
  }
  return projectId
}
```

**Benefits:**
- ✅ Strongly typed response (Project instead of any)
- ✅ Better error messages with full response logging
- ✅ Clearer logic - expects full object, not nested data
- ✅ Consistent pattern across all create methods

#### Similar Improvements for Other Methods
- `createEnvironment()` - Now returns typed Environment object
- `createApplication()` - Now returns typed Application object
- All methods now have better error handling and logging

### `src/types/dokploy.ts`

#### Added debugMode to DokployConfig
```typescript
export interface DokployConfig {
  url: string
  apiKey: string
  debugMode?: boolean  // ✅ Added to fix config.debugMode reference
}
```

## Swagger Validation Tests

### What They Validate

#### 1. Project API Endpoints
- ✅ `/project.create` request schema (name required, description optional)
- ✅ `/project.one` query parameters (projectId required)
- ✅ `/project.all` endpoint exists

#### 2. Environment API Endpoints
- ✅ `/environment.create` request schema (name and projectId required)

#### 3. Application API Endpoints
- ✅ `/application.create` request schema (name and environmentId required)
- ✅ Optional fields: appName, description, serverId

#### 4. API Coverage
- ✅ Validates all project endpoints are documented
- ✅ Validates all environment endpoints are documented
- ✅ Validates all application endpoints are documented

### Running the Tests

```bash
# Run all tests
npm test

# Run only Swagger validation tests
npm test swagger-validation

# Run with coverage
npm test:coverage
```

## DokployClient Unit Tests

### What They Test

#### 1. Constructor
- ✅ Initializes with config
- ✅ Removes trailing slash from URL

#### 2. createProject()
- ✅ Creates project and returns projectId
- ✅ Handles response with `id` field instead of `projectId`
- ✅ Throws error if no ID in response
- ✅ Uses default description if not provided

#### 3. createEnvironment()
- ✅ Creates environment and returns environmentId
- ✅ Handles response with `id` field
- ✅ Throws error if no ID in response

#### 4. createApplication()
- ✅ Creates application and returns applicationId
- ✅ Handles response with `id` field
- ✅ Throws error if no ID in response

#### 5. Response Parsing
- ✅ Handles responses with specific ID field (projectId, environmentId, etc.)
- ✅ Handles responses with generic `id` field
- ✅ Prefers specific ID field over generic `id` when both present

## API Response Structure (Based on Swagger)

### Important Note
The Swagger spec defines all responses as:
```json
"responses": {
  "200": { 
    "description": "Successful response", 
    "content": { "application/json": {} }
  }
}
```

The empty `{}` means response schemas are not explicitly defined. Based on REST API conventions and testing, we assume:

- **Create endpoints** return the full created object
- **Get endpoints** return the requested object or array
- **Update endpoints** return the updated object or void
- **Delete endpoints** return void or success message

### Expected Response Patterns

```typescript
// POST /api/project.create
{
  projectId: "proj-123",
  name: "my-project",
  description: "Project description",
  createdAt: "2024-01-01T00:00:00Z"
}

// POST /api/environment.create
{
  environmentId: "env-456",
  name: "production",
  projectId: "proj-123"
}

// POST /api/application.create
{
  applicationId: "app-789",
  name: "my-app",
  environmentId: "env-456",
  projectId: "proj-123",
  serverId: "server-123"
}
```

## Future Improvements

1. **Response Schema Validation**: If Dokploy adds response schemas to their Swagger spec, update tests to validate response structures
2. **More Endpoint Coverage**: Add validation tests for domain, deployment, and other endpoints
3. **Integration Tests**: Add tests that call actual Dokploy API (with test instance)
4. **Schema Generation**: Consider generating TypeScript types directly from Swagger spec

## Troubleshooting

### Test Failures

If Swagger validation tests fail:
1. Check if Dokploy API has changed
2. Update `swagger/dokploy-swagger.json` with latest spec
3. Update TypeScript types in `src/types/dokploy.ts`
4. Update tests to match new schema

### API Response Parsing Errors

If you see "No project ID in response" errors:
1. Enable debug mode: `debug-mode: true`
2. Check the full response logged in error messages
3. Update ID extraction logic in DokployClient if response structure changed
4. Update unit tests to match new response structure

## Maintenance

### Updating Swagger Spec

```bash
# Download latest Swagger spec from Dokploy instance
curl https://your-dokploy-instance.com/api/settings.getOpenApiDocument > swagger/dokploy-swagger.json

# Run validation tests
npm test swagger-validation

# Fix any failures by updating types and client code
```

### Adding New Endpoints

1. Add endpoint to Swagger spec (if not already there)
2. Add validation test in `swagger-validation.test.ts`
3. Add TypeScript types if needed
4. Add client method in `dokploy-client.ts`
5. Add unit tests in `dokploy-client.test.ts`

---

**Last Updated**: 2024-11-21  
**Swagger Spec Version**: 1.0.0 (OpenAPI 3.0.3)  
**Test Coverage**: 83 tests passing

