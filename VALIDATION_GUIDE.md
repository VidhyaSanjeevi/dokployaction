# Input Validation & Error Troubleshooting Guide

This guide helps you understand and fix common validation errors when using the Dokploy GitHub Action.

## Table of Contents
- [Common Errors](#common-errors)
  - [Memory Configuration Errors](#memory-configuration-errors)
  - [CPU Configuration Errors](#cpu-configuration-errors)
  - [DNS Name Validation Errors](#dns-name-validation-errors)
  - [Port Configuration Errors](#port-configuration-errors)
  - [Docker Image Errors](#docker-image-errors)
- [Validation Rules Reference](#validation-rules-reference)
- [Best Practices](#best-practices)

---

## Common Errors

### Memory Configuration Errors

#### Error Message
```
❌ Deployment Failed
============================================================

Memory Configuration Error:
  Current value: 128MB
  Minimum required: 4MB (4MiB)

💡 Fix: Set memory-limit and memory-reservation to at least 4MB
   Recommended values: 128MB, 256MB, 512MB, 1024MB
```

or during validation:

```
❌ Validation failed with the following errors:

1. memory-limit must be at least 4MiB (got 2MB)
   💡 Suggestion: Set memory-limit to at least 4MB. Common values: 128MB, 256MB, 512MB, 1024MB
```

#### Cause
Dokploy requires memory limits to be at least **4 MiB** (4 megabytes). Values like 1, 2, or 3 are too low.

#### Solution
Set `memory-limit` and `memory-reservation` to at least 4MB:

```yaml
with:
  memory-limit: 128        # 128MB - good for small apps
  memory-reservation: 64   # 64MB soft limit
```

**Recommended Values:**
- **Small apps**: 128MB - 256MB
- **Medium apps**: 512MB - 1024MB (1GB)
- **Large apps**: 2048MB (2GB) or more

---

### CPU Configuration Errors

#### Error Message
```
❌ Deployment Failed
============================================================

CPU Configuration Error:
  Current value: 1e-09
  Minimum required: 0.001

💡 Fix: Set cpu-limit and cpu-reservation to at least 0.001
   Common values: 0.1 (100m), 0.25 (250m), 0.5 (500m), 1.0 (1 CPU)
```

or during validation:

```
❌ Validation failed with the following errors:

1. cpu-limit must be at least 0.001 (got 0.0001)
   💡 Suggestion: Set cpu-limit to at least 0.001. Common values: 0.1 (100m), 0.25 (250m), 0.5 (500m), 1.0 (1 CPU), 2.0 (2 CPUs)
```

#### Cause
Dokploy requires CPU limits to be at least **0.001** (1 millicpu). Scientific notation values like `1e-09` are too low.

#### Solution
Set `cpu-limit` and `cpu-reservation` to at least 0.001:

```yaml
with:
  cpu-limit: 1.0          # 1 full CPU core
  cpu-reservation: 0.5    # Reserve 0.5 CPU cores
```

**Recommended Values:**
- **Small apps**: 0.1 (100m) - 0.25 (250m)
- **Medium apps**: 0.5 (500m) - 1.0 (1 CPU)
- **Large apps**: 2.0 (2 CPUs) or more

**CPU Value Formats:**
- Decimal: `1.0` = 1 CPU, `0.5` = half CPU
- Millicpu: `500m` = 0.5 CPU, `1000m` = 1 CPU (converted automatically)

---

### DNS Name Validation Errors

#### Error Message
```
❌ Deployment Failed
============================================================

DNS Name Validation Error:
  One or more names (application, project, or environment) are invalid.

DNS names must:
  • Contain only lowercase letters, numbers, and hyphens
  • Start and end with a letter or number
  • Be 63 characters or less

💡 Fix: Check your application-name, project-name, and environment-name inputs
   Application: "My_App-Staging"
   Project: "my-project"
   Environment: "staging"
```

or during validation:

```
❌ Validation failed with the following errors:

1. application-name must be a valid DNS name: contains invalid characters (only lowercase letters, numbers, and hyphens allowed), contains uppercase letters (must be lowercase)
   💡 Suggestion: Convert "My_App-Staging" to a valid DNS name. Example: "my-app-staging"
```

#### Cause
Dokploy requires names to be valid DNS labels following RFC 1123:
- Only lowercase alphanumeric and hyphens
- Must start and end with alphanumeric
- Cannot exceed 63 characters

Common violations:
- ❌ Uppercase letters: `My-App`
- ❌ Underscores: `my_app`
- ❌ Dots: `my.app`
- ❌ Special characters: `my-app!`
- ❌ Starting/ending with hyphen: `-my-app-`

#### Solution

Convert invalid names to valid DNS names:

**Invalid Examples → Fixed:**
```yaml
# ❌ WRONG
application-name: 'My_App-Staging'
application-name: 'billing-Frontend'
application-name: 'app.production'
application-name: '-my-app-'

# ✅ CORRECT
application-name: 'my-app-staging'
application-name: 'billing-frontend'
application-name: 'app-production'
application-name: 'my-app'
```

**Valid Examples:**
```yaml
with:
  application-name: 'billing-api'      # ✅ Good
  project-name: 'my-project'           # ✅ Good
  environment-name: 'staging'          # ✅ Good
  application-name: 'app123'           # ✅ Good
  application-name: 'frontend-v2'      # ✅ Good
```

---

### Port Configuration Errors

#### Error Message
```
❌ Validation failed with the following errors:

1. port must be between 1 and 65535 (got 100000)
   💡 Suggestion: Use a valid port number between 1 and 65535. Common ports: 80 (HTTP), 443 (HTTPS), 3000, 8080
```

#### Cause
Port numbers must be in the valid range: 1-65535.

#### Solution
Use a valid port number:

```yaml
with:
  port: 8080              # External port
  target-port: 3000       # Container port
  application-port: 80    # Application listening port
```

**Common Ports:**
- **80**: HTTP
- **443**: HTTPS
- **3000**: Node.js apps
- **8080**: Alternative HTTP
- **5000**: Flask/Python apps
- **8000**: Django/FastAPI

---

### Docker Image Errors

#### Error Message
```
❌ Validation failed with the following errors:

1. docker-image format is invalid
   💡 Suggestion: Use format: registry/repository:tag (example: ghcr.io/myorg/myapp:v1.0.0)
```

#### Cause
Docker image must be in the format: `registry/repository:tag`

#### Solution

Use proper Docker image format:

**Invalid Examples → Fixed:**
```yaml
# ❌ WRONG
docker-image: 'myapp'                    # Missing tag
docker-image: 'myapp:latest'             # Missing registry/repo
docker-image: 'ghcr.io/user/app'         # Missing tag

# ✅ CORRECT
docker-image: 'ghcr.io/user/myapp:latest'
docker-image: 'ghcr.io/myorg/app:v1.0.0'
docker-image: 'docker.io/library/nginx:alpine'
```

**Valid Examples:**
```yaml
with:
  docker-image: 'ghcr.io/myorg/myapp:v1.0.0'     # ✅ GitHub Container Registry
  docker-image: 'docker.io/library/nginx:latest' # ✅ Docker Hub
  docker-image: 'registry.io/org/repo:tag'       # ✅ Custom registry
```

---

## Validation Rules Reference

### Memory Limits

| Parameter | Minimum | Recommended | Maximum |
|-----------|---------|-------------|---------|
| `memory-limit` | 4 MB | 128MB - 1024MB | No hard limit |
| `memory-reservation` | 4 MB | 64MB - 512MB | Must be ≤ memory-limit |

**Units**: Megabytes (MB)

### CPU Limits

| Parameter | Minimum | Recommended | Maximum |
|-----------|---------|-------------|---------|
| `cpu-limit` | 0.001 | 0.1 - 2.0 | No hard limit |
| `cpu-reservation` | 0.001 | 0.05 - 1.0 | Must be ≤ cpu-limit |

**Units**: CPU cores (1.0 = 1 core, 0.5 = half core)

### DNS Names

| Rule | Description | Example Valid | Example Invalid |
|------|-------------|---------------|-----------------|
| Characters | Lowercase letters, numbers, hyphens only | `my-app-v2` | `My_App` |
| Start/End | Must be alphanumeric | `app123` | `-app-` |
| Length | Maximum 63 characters | `my-application-name` | (64+ chars) |
| No special | No underscores, dots, etc. | `my-app` | `my_app`, `my.app` |

**Applies to**: `application-name`, `project-name`, `environment-name`

### Ports

| Parameter | Minimum | Maximum | Common Values |
|-----------|---------|---------|---------------|
| `port` | 1 | 65535 | 80, 443, 8080 |
| `target-port` | 1 | 65535 | 3000, 8000 |
| `application-port` | 1 | 65535 | 80, 3000, 8080 |

### Replicas

| Parameter | Minimum | Recommended | Notes |
|-----------|---------|-------------|-------|
| `replicas` | 0 | 1-5 | 0 = stop app, 1+ = running |

### Domain Host

Must be a valid fully-qualified domain name (FQDN):
- ✅ `app.example.com`
- ✅ `api.subdomain.example.com`
- ❌ `invalid` (not FQDN)
- ❌ `http://example.com` (no protocol)

---

## Best Practices

### 1. Resource Allocation

**Development/Staging:**
```yaml
with:
  memory-limit: 256        # 256MB
  memory-reservation: 128  # 128MB
  cpu-limit: 0.5           # 0.5 CPU cores
  cpu-reservation: 0.25    # 0.25 CPU cores
```

**Production (Small App):**
```yaml
with:
  memory-limit: 512        # 512MB
  memory-reservation: 256  # 256MB
  cpu-limit: 1.0           # 1 CPU core
  cpu-reservation: 0.5     # 0.5 CPU cores
```

**Production (Medium App):**
```yaml
with:
  memory-limit: 1024       # 1GB
  memory-reservation: 512  # 512MB
  cpu-limit: 2.0           # 2 CPU cores
  cpu-reservation: 1.0     # 1 CPU core
```

### 2. Naming Conventions

Use consistent, descriptive, lowercase names with hyphens:

```yaml
with:
  application-name: 'billing-api-staging'
  project-name: 'billing-system'
  environment-name: 'staging'
```

**Good naming patterns:**
- `{service}-{component}-{environment}`: `billing-api-prod`
- `{project}-{environment}`: `myapp-staging`
- `{component}-{version}`: `frontend-v2`

### 3. Port Assignments

Use conventional port numbers:

```yaml
with:
  # Backend API
  port: 8080              # External access
  target-port: 3000       # Container port
  application-port: 3000  # App listens on 3000

  # Frontend
  port: 80                # External HTTP
  target-port: 80         # Container Nginx
  application-port: 80    # Nginx listens on 80
```

### 4. Docker Images

Always use specific tags, never `latest` in production:

```yaml
# Development
docker-image: 'ghcr.io/myorg/app:develop'

# Staging
docker-image: 'ghcr.io/myorg/app:v1.2.3-rc.1'

# Production
docker-image: 'ghcr.io/myorg/app:v1.2.3'
```

### 5. Health Checks

Always enable health checks with appropriate timeouts:

```yaml
with:
  health-check-enabled: true
  health-check-path: '/health'
  health-check-retries: 15
  health-check-interval: 10
  fail-on-health-check-error: true
```

---

## Quick Checklist

Before deploying, verify:

- [ ] Memory limits ≥ 4MB (recommended: 128MB+)
- [ ] CPU limits ≥ 0.001 (recommended: 0.1+)
- [ ] All names are lowercase with no special characters
- [ ] Names don't start or end with hyphens
- [ ] Port numbers are in range 1-65535
- [ ] Docker image has registry, repository, and tag
- [ ] Health check path is correct (e.g., `/health`)
- [ ] Environment variables are set correctly

---

## Need Help?

If you're still encountering validation errors:

1. **Check the error message**: It includes specific field, current value, and suggested fix
2. **Review this guide**: Find your error type above
3. **Check examples**: Use the provided valid examples
4. **Enable debug mode**: Set `debug-mode: true` for detailed logs
5. **Open an issue**: If the error persists, [create an issue](https://github.com/SSanjeevi/dokployaction/issues)

---

**Last Updated**: November 24, 2025  
**Action Version**: v1.1.0+
