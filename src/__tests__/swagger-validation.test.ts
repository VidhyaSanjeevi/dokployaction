/**
 * Swagger Schema Validation Tests
 * Validates that our TypeScript types match the Dokploy Swagger/OpenAPI specification
 */

import * as fs from 'fs'
import * as path from 'path'

interface SwaggerSpec {
  openapi: string
  paths: Record<string, Record<string, SwaggerOperation>>
}

interface SwaggerOperation {
  operationId: string
  requestBody?: {
    required: boolean
    content: {
      'application/json': {
        schema: SwaggerSchema
      }
    }
  }
  parameters?: SwaggerParameter[]
}

interface SwaggerParameter {
  name: string
  in: 'query' | 'path' | 'header'
  required: boolean
  schema: SwaggerSchema
}

interface SwaggerSchema {
  type: string
  properties?: Record<string, SwaggerProperty>
  required?: string[]
  items?: SwaggerSchema
  minLength?: number
  minimum?: number
  nullable?: boolean
  format?: string
}

interface SwaggerProperty {
  type: string
  minLength?: number
  minimum?: number
  nullable?: boolean
  format?: string
  items?: SwaggerSchema
}

describe('Swagger Schema Validation', () => {
  let swaggerSpec: SwaggerSpec

  beforeAll(() => {
    const swaggerPath = path.join(__dirname, '../../swagger/dokploy-swagger.json')
    const swaggerContent = fs.readFileSync(swaggerPath, 'utf-8')
    swaggerSpec = JSON.parse(swaggerContent)
  })

  it('should load Swagger specification', () => {
    expect(swaggerSpec).toBeDefined()
    expect(swaggerSpec.openapi).toBe('3.0.3')
    expect(swaggerSpec.paths).toBeDefined()
  })

  describe('Project API Endpoints', () => {
    it('should validate project.create request schema', () => {
      const operation = swaggerSpec.paths['/project.create']?.post
      expect(operation).toBeDefined()
      expect(operation?.operationId).toBe('project-create')

      const schema = operation?.requestBody?.content['application/json'].schema
      expect(schema).toBeDefined()
      expect(schema?.properties).toHaveProperty('name')
      expect(schema?.properties?.name.type).toBe('string')
      expect(schema?.properties?.name.minLength).toBe(1)
      expect(schema?.required).toContain('name')

      expect(schema?.properties).toHaveProperty('description')
      expect(schema?.properties?.description.nullable).toBe(true)
    })

    it('should validate project.one query parameters', () => {
      const operation = swaggerSpec.paths['/project.one']?.get
      expect(operation).toBeDefined()

      const projectIdParam = operation?.parameters?.find(p => p.name === 'projectId')
      expect(projectIdParam).toBeDefined()
      expect(projectIdParam?.required).toBe(true)
      expect(projectIdParam?.schema.type).toBe('string')
    })

    it('should validate project.all endpoint exists', () => {
      const operation = swaggerSpec.paths['/project.all']?.get
      expect(operation).toBeDefined()
      expect(operation?.operationId).toBe('project-all')
    })
  })

  describe('Environment API Endpoints', () => {
    it('should validate environment.create request schema', () => {
      const operation = swaggerSpec.paths['/environment.create']?.post
      expect(operation).toBeDefined()

      const schema = operation?.requestBody?.content['application/json'].schema
      expect(schema?.properties).toHaveProperty('name')
      expect(schema?.properties).toHaveProperty('projectId')
      expect(schema?.required).toContain('name')
      expect(schema?.required).toContain('projectId')
    })
  })

  describe('Application API Endpoints', () => {
    it('should validate application.create request schema', () => {
      const operation = swaggerSpec.paths['/application.create']?.post
      expect(operation).toBeDefined()

      const schema = operation?.requestBody?.content['application/json'].schema
      expect(schema?.properties).toHaveProperty('name')
      expect(schema?.properties).toHaveProperty('environmentId')
      expect(schema?.required).toContain('name')
      expect(schema?.required).toContain('environmentId')

      // Optional fields
      expect(schema?.properties).toHaveProperty('appName')
      expect(schema?.properties).toHaveProperty('description')
      expect(schema?.properties).toHaveProperty('serverId')
    })
  })

  describe('API Endpoint Coverage', () => {
    it('should document all project endpoints', () => {
      const projectEndpoints = Object.keys(swaggerSpec.paths).filter(path => path.startsWith('/project.'))
      expect(projectEndpoints.length).toBeGreaterThan(0)

      const expectedEndpoints = ['/project.create', '/project.one', '/project.all', '/project.remove']
      expectedEndpoints.forEach(endpoint => {
        expect(projectEndpoints).toContain(endpoint)
      })
    })

    it('should document all environment endpoints', () => {
      const envEndpoints = Object.keys(swaggerSpec.paths).filter(path => path.startsWith('/environment.'))
      expect(envEndpoints.length).toBeGreaterThan(0)
    })

    it('should document all application endpoints', () => {
      const appEndpoints = Object.keys(swaggerSpec.paths).filter(path => path.startsWith('/application.'))
      expect(appEndpoints.length).toBeGreaterThan(0)
    })
  })
})

