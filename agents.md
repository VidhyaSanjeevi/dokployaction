# Dokploy GitHub Action - AI Agent Instructions

This document provides guidance for GitHub Copilot agents and other AI assistants working on the Dokploy GitHub Action repository.

## 🎯 Repository Overview

**Repository Type**: GitHub Action for Dokploy Deployment Automation  
**Technology Stack**: TypeScript, Node.js 20, GitHub Actions API, Dokploy REST API  
**Purpose**: Automate Dokploy deployments with health checks, rollback, zero-downtime, and comprehensive lifecycle management

## 📁 Repository Structure

```
dokployaction/
├── src/                          # Source TypeScript files
│   ├── index.ts                 # Main entry point
│   ├── inputs.ts                # Input parsing and validation
│   ├── outputs.ts               # Output handling
│   ├── config.ts                # Configuration builders
│   ├── health-check.ts          # Health check functionality
│   ├── client/
│   │   └── dokploy-client.ts   # Dokploy API client wrapper
│   ├── types/
│   │   └── dokploy.ts          # TypeScript type definitions
│   ├── utils/
│   │   └── helpers.ts          # Utility functions (parsing, logging)
│   └── __tests__/              # Unit tests
├── __tests__/                   # Additional test files
├── dist/                        # Compiled JavaScript (generated)
├── swagger/
│   └── dokploy-swagger.json    # Dokploy API specification
├── action.yml                   # GitHub Action metadata
├── package.json                 # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
└── jest.config.js              # Test configuration
```

## 🚨 Critical Guidelines for AI Agents

### 1. Always Consult the Swagger Documentation

**IMPORTANT**: The Dokploy API specification is the source of truth for all API interactions.

- **Location**: `swagger/dokploy-swagger.json`
- **When to use**: Before making ANY changes to API calls or data structures
- **What to check**:
  - Endpoint paths (e.g., `/api/application.update`, `/api/application.saveDockerProvider`)
  - Request body schemas (properties, types, required fields)
  - Data types (string vs number vs object)
  - Nested object structures (e.g., `restartPolicySwarm`, `healthCheckSwarm`)
  - Nullable fields and optional parameters

**Example**: Before updating resource limits, check the swagger to see:
```json
"memoryLimit": { "type": "string", "nullable": true }  // NOT a number!
"cpuLimit": { "type": "string", "nullable": true }      // NOT a number!
"replicas": { "type": "number" }                        // IS a number
```

### 2. Data Type Conversions

Dokploy API has specific type requirements that differ from common expectations:

#### Resource Limits (Must be Strings)
```typescript
// ✅ CORRECT
memoryLimit: '2048'       // String
cpuLimit: '1.0'          // String
memoryReservation: '1024' // String
cpuReservation: '0.5'    // String

// ❌ WRONG
memoryLimit: 2048        // Number - API will reject
cpuLimit: 1.0            // Number - API will reject
```

#### Replicas (Must be Number)
```typescript
// ✅ CORRECT
replicas: 3              // Number

// ❌ WRONG
replicas: '3'            // String - API will reject
```

#### Restart Policies (Must use Swarm Object Format)
```typescript
// ✅ CORRECT
restartPolicySwarm: {
  Condition: 'any'       // Maps from 'unless-stopped' or 'always'
}

// ❌ WRONG
restartPolicy: 'unless-stopped'  // Simple string - API doesn't recognize
```

**Restart Policy Mapping**:
- `unless-stopped` → `{ Condition: 'any' }`
- `always` → `{ Condition: 'any' }`
- `on-failure` → `{ Condition: 'on-failure' }`
- `no` → `{ Condition: 'none' }`

### 3. CPU Limit Parsing

The action supports multiple CPU limit formats:

```typescript
// Decimal format
'0.5'    → 0.5 CPU
'1.0'    → 1.0 CPU
'2.5'    → 2.5 CPU

// Millicpu format (Kubernetes-style)
'500m'   → 0.5 CPU   (500/1000)
'1000m'  → 1.0 CPU   (1000/1000)
'250m'   → 0.25 CPU  (250/1000)

// Integer format
'1'      → 1.0 CPU
'4'      → 4.0 CPU
```

**Implementation**: See `src/utils/helpers.ts` → `parseCpuLimit()`
- Uses `parseFloat()` not `parseInt()` (to handle decimals)
- Converts millicpu to decimal by dividing by 1000
- Case-insensitive for 'm' suffix

### 4. Dokploy API Endpoint Patterns

Dokploy uses consistent naming patterns:

```
/api/application.create         - Create new application
/api/application.update         - Update application settings (general)
/api/application.one            - Get single application
/api/application.deploy         - Trigger deployment

/api/application.saveDockerProvider  - Configure Docker registry
/api/application.saveEnvironment     - Set environment variables
/api/application.saveBuildType       - Configure build method
/api/application.saveGithubProvider  - Configure GitHub integration
/api/application.stop                - Stop application

/api/project.create             - Create project
/api/project.one                - Get project details
/api/project.all                - List all projects

/api/environment.create         - Create environment
/api/environment.one            - Get environment details

/api/domain.create              - Add domain
/api/domain.byApplicationId     - List domains for app
/api/domain.delete              - Remove domain
```

**Pattern**: `/{resource}.{action}` or `/{resource}.{propertyName}`

### 5. Development Workflow

#### Before Making Changes
1. **Read the relevant section** of `swagger/dokploy-swagger.json`
2. **Check existing types** in `src/types/dokploy.ts`
3. **Review existing tests** in `__tests__/` and `src/__tests__/`
4. **Search for similar patterns** in the codebase

#### After Making Changes
1. **Build**: `npm run build` (compiles TypeScript with ncc)
2. **Test**: `npm test` (runs Jest test suite)
3. **Lint**: `npm run lint` (ESLint validation)
4. **All three must pass** before committing

#### Build Process
```bash
npm run build
# Uses @vercel/ncc to bundle TypeScript into single dist/index.js
# Generates source maps: dist/index.js.map
# Creates TypeScript declarations: dist/*.d.ts
```

#### Testing
```bash
npm test                 # Run all tests
npm test -- --watch     # Watch mode
npm test helpers.test   # Run specific test file
```

### 6. Common Pitfalls and Solutions

#### ❌ Problem: "Input validation failed" error
**Cause**: Sending wrong data types or invalid fields to Dokploy API  
**Solution**: Check `swagger/dokploy-swagger.json` for exact schema

#### ❌ Problem: "404 Not Found" on API endpoint
**Cause**: Using non-existent endpoint or wrong endpoint name  
**Solution**: Search swagger for correct endpoint path

#### ❌ Problem: CPU limit parsing to 0
**Cause**: Using `parseInt()` on decimal values like "0.5"  
**Solution**: Use `parseFloat()` in `parseCpuLimit()`

#### ❌ Problem: ESLint errors about `let` vs `const`
**Cause**: Variable declared with `let` but never reassigned  
**Solution**: Change to `const` (ESLint rule: `prefer-const`)

#### ❌ Problem: Tests failing after API changes
**Cause**: Mock data or expectations don't match new API contract  
**Solution**: Update test expectations to match swagger schema

### 7. Type Definitions

All Dokploy types are in `src/types/dokploy.ts`. When adding new features:

1. **Check swagger first** for the exact structure
2. **Add TypeScript interface** matching swagger schema
3. **Use nullable fields** where swagger shows `"nullable": true`
4. **Match property names exactly** (case-sensitive)

Example:
```typescript
// From swagger
"restartPolicySwarm": {
  "type": "object",
  "properties": {
    "Condition": { "type": "string" },
    "Delay": { "type": "number" }
  }
}

// TypeScript interface
interface RestartPolicySwarm {
  Condition?: string
  Delay?: number
  MaxAttempts?: number
  Window?: number
}
```

### 8. API Client Pattern

The `DokployClient` class in `src/client/dokploy-client.ts` wraps all API calls:

```typescript
// Pattern for GET endpoints
async getApplication(applicationId: string): Promise<Application> {
  return await this.get<Application>(`/api/application.one?applicationId=${applicationId}`)
}

// Pattern for POST endpoints
async saveEnvironment(applicationId: string, envString: string): Promise<void> {
  await this.post('/api/application.saveEnvironment', {
    applicationId,
    env: envString
  })
}
```

**Best Practices**:
- Use typed responses (`Promise<Application>` not `Promise<any>`)
- Include logging with `core.info()` for visibility
- Use `debugLog()` for detailed debugging (controlled by debug-mode input)
- Sanitize sensitive data in logs (passwords, tokens, keys)

### 9. Input Validation

All inputs are parsed in `src/inputs.ts`:

```typescript
export function parseInputs(): ActionInputs {
  return {
    // Required inputs
    url: core.getInput('dokploy-url', { required: true }),
    apiKey: core.getInput('api-key', { required: true }),
    
    // Optional with defaults
    timeout: parseIntInput(core.getInput('timeout'), 'timeout') || 300,
    
    // Optional without defaults
    memoryLimit: parseIntInput(core.getInput('memory-limit'), 'memory-limit'),
    
    // Special parsing for CPU (supports decimals and millicpu)
    cpuLimit: parseCpuLimit(core.getInput('cpu-limit')),
  }
}
```

### 10. Debugging

Enable debug mode in workflows:
```yaml
- uses: SSanjeevi/dokplayaction@main
  with:
    debug-mode: 'true'
    # Shows detailed API requests/responses
```

Debug logging helpers:
```typescript
debugLog('Message', data)           // Only logs if debug-mode enabled
logApiRequest('POST', url, body)    // Logs API requests (sanitized)
logApiResponse(statusCode, response) // Logs API responses
```

### 11. Version Management

- **Package version**: Defined in `package.json`
- **Action version**: Tagged in Git (e.g., `v1.0.0`)
- **Node version**: 20.x (specified in `action.yml`)
- **TypeScript**: 5.9.3 (latest compatible version)

### 12. Dependencies

Key dependencies and their purposes:

```json
{
  "@actions/core": "^1.11.1",        // GitHub Actions SDK
  "@actions/http-client": "^2.2.3",  // HTTP client for API calls
  "@vercel/ncc": "^0.38.4",          // Bundle TypeScript to single file
  "typescript": "^5.9.3",             // TypeScript compiler
  "jest": "^29.7.0",                  // Testing framework
  "eslint": "^9.20.0"                 // Code linting
}
```

## 📚 Additional Resources

### Swagger Documentation
- **Primary source**: `swagger/dokploy-swagger.json`
- **When to reference**: Before ANY API call changes
- **How to search**: Use text search for endpoint names (e.g., "application.update")
- **Pay attention to**:
  - Required vs optional fields
  - Nullable fields
  - Exact data types (string vs number)
  - Nested object structures

### GitHub Actions Documentation
- [GitHub Actions Toolkit](https://github.com/actions/toolkit)
- [Creating JavaScript Actions](https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action)
- [Action Metadata Syntax](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions)

### Testing
- Test files must match pattern: `*.test.ts`
- Use Jest mocking for `@actions/core` and API calls
- Maintain >80% code coverage
- All 87 tests must pass before commit

## 🎯 Key Takeaways for AI Agents

1. **Swagger is truth**: Always check `swagger/dokploy-swagger.json` before API changes
2. **Type carefully**: Strings for memory/CPU limits, numbers for replicas
3. **Test everything**: Run `npm run build && npm test && npm run lint`
4. **Parse correctly**: Use `parseFloat()` for CPU limits (supports decimals and millicpu)
5. **Map policies**: Convert simple restart policies to Swarm format
6. **Debug wisely**: Use debug-mode for detailed logging without cluttering normal runs
7. **Follow patterns**: Consistent code style and API client patterns throughout

## ⚠️ Critical Reminders

- **Never assume data types** - always verify in swagger
- **Never skip tests** - they catch API contract violations
- **Never commit without building** - ensures dist/ is up to date
- **Never modify swagger** - it's the Dokploy API source of truth
- **Always convert types correctly** - string vs number matters to API validation

---

**Version**: 1.0  
**Last Updated**: November 23, 2025  
**Repository**: dokployaction  
**Purpose**: AI agent guidance for Dokploy GitHub Action development
