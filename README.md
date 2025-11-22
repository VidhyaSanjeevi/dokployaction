# Dokploy GitHub Actions

> **GitHub Actions for automated Dokploy deployments with health checks and lifecycle management**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Dokploy](https://img.shields.io/badge/Dokploy-Compatible-blue)](https://dokploy.com)
[![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-Ready-green)](https://github.com/features/actions)
[![Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-Published-blue)](https://github.com/marketplace/actions/dokploy-deployment-suite)

Deploy to Dokploy from GitHub Actions with automated project, environment, and application management. Includes health checks, container cleanup, and modular composite actions.

## ⚡ Quick Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Dokploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: SSanjeevi/dokployaction@v1
        with:
          dokploy-url: ${{ secrets.DOKPLOY_URL }}
          api-key: ${{ secrets.DOKPLOY_API_KEY }}
          application-id: 'your-app-id'
          docker-image: 'ghcr.io/user/app:latest'
          enable-health-check: true
          health-check-path: '/health'
          cleanup-old-containers: true
```

That's it! Your application will be deployed with health checks and optional container cleanup.

## 🚀 Features

### ✨ Core Functionality

- **🎯 Simple Deployment**: Deploy Docker images to Dokploy with a single action
- **🧩 Modular Actions**: Use individual composite actions for custom workflows
- **📦 Lifecycle Management**: Automated project, environment, and application management
- **🔒 Secure**: Uses GitHub Secrets for API keys and registry credentials

### 🏥 Health & Monitoring

- **Health Checks**: Configurable health verification after deployment
- **Retry Logic**: Automatic retries with configurable intervals
- **Deployment Validation**: Marks deployment as failed if health check fails
- **Flexible Error Handling**: Option to continue deployment even if health check fails for manual verification
- **Container Cleanup**: Optional cleanup of old containers before deployment
- **Deployment Status**: Clear success/failure reporting

### 📦 Configuration Options

- **Docker Registry**: Support for private registries with authentication
- **Environment Variables**: Configure application environment variables
- **Domain Setup**: Optional domain and SSL configuration
- **Flexible Inputs**: Extensive configuration options for customization

### 🎓 Developer Friendly

- **TypeScript Implementation**: Type-safe, well-tested codebase
- **Composite Actions**: Reusable actions for specific tasks
- **Clear Documentation**: Quick start guide and feature documentation
- **GitHub Marketplace**: Easy installation from Marketplace

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Repository Structure](#repository-structure)
- [Composite Actions](#composite-actions)
- [Configuration](#configuration)
- [Security Best Practices](#security-best-practices)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Quick Start

### 1. Prerequisites

- Dokploy instance running and accessible
- GitHub repository with your application
- Dokploy API key (generate from Dokploy dashboard)
- Docker image registry (GitHub Container Registry, Docker Hub, etc.)

### 2. Setup Secrets

Add these secrets to your GitHub repository (`Settings` → `Secrets and variables` → `Actions`):

```yaml
Required Secrets:
  DOKPLOY_URL: https://your-dokploy-instance.com
  DOKPLOY_API_KEY: your-api-key-here

Optional Secrets (for private registries):
  REGISTRY_USERNAME: your-registry-username
  REGISTRY_PASSWORD: your-registry-token
```

### 3. Create Your Workflow

**Option A: Use the Main Action (Recommended)**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Dokploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: SSanjeevi/dokployaction@v1
        with:
          dokploy-url: ${{ secrets.DOKPLOY_URL }}
          api-key: ${{ secrets.DOKPLOY_API_KEY }}
          application-id: 'your-app-id'
          docker-image: 'ghcr.io/user/app:latest'
          enable-health-check: true
          health-check-path: '/health'
          cleanup-old-containers: true
```

**Option B: Use Composite Actions (More Control)**
```yaml
steps:
  - name: Deploy
    uses: SSanjeevi/dokployaction/actions/deploy@v1
    with:
      dokploy-url: ${{ secrets.DOKPLOY_URL }}
      api-key: ${{ secrets.DOKPLOY_API_KEY }}
      application-id: 'app_123'
      docker-image: 'ghcr.io/user/app:latest'

  - name: Health Check
    uses: SSanjeevi/dokployaction/actions/health-check@v1
    with:
      health-check-path: '/health'
```

See [QUICK_START.md](QUICK_START.md) for more detailed examples and configuration options.

## 📁 Repository Structure

```
dokployaction/
├── action.yml                             # 🎯 Main action metadata
├── src/                                   # 💻 TypeScript source code
│   ├── index.ts                           # Main entry point
│   ├── client/                            # Dokploy API client
│   ├── types/                             # TypeScript type definitions
│   ├── inputs.ts                          # Input parsing
│   ├── config.ts                          # Configuration builders
│   ├── health-check.ts                    # Health check logic
│   ├── outputs.ts                         # Output handling
│   └── utils/                             # Helper utilities
├── dist/                                  # 📦 Compiled JavaScript (bundled)
│   └── index.js                           # Built action for GitHub Actions
├── actions/                               # 🧩 Composite actions
│   ├── deploy/                            # Deploy action
│   ├── health-check/                      # Health check action
│   ├── cleanup-containers/                # Container cleanup action
│   ├── setup-ssl/                         # SSL setup action
│   ├── configure-domain/                  # Domain configuration action
│   └── rollback/                          # Rollback action
├── __tests__/                             # 🧪 Unit tests
├── .github/
│   └── workflows/
│       ├── test-actions.yml               # Test and validate actions
│       └── publish-release.yml            # Publish to marketplace
├── QUICK_START.md                         # Quick start guide
├── FEATURES.md                            # Feature documentation
├── CHANGELOG.md                           # Version history
├── CONTRIBUTING.md                        # Contribution guidelines
└── README.md                              # This file
```

## 🧩 Composite Actions

Modular composite actions you can use in any workflow for specific tasks.

### Available Actions

| Action | Description | Usage |
|--------|-------------|-------|
| **deploy** | Deploy Docker image to Dokploy | `uses: SSanjeevi/dokployaction/actions/deploy@v1` |
| **health-check** | Verify application health with retries | `uses: SSanjeevi/dokployaction/actions/health-check@v1` |
| **cleanup-containers** | Remove old containers | `uses: SSanjeevi/dokployaction/actions/cleanup-containers@v1` |
| **setup-ssl** | Configure SSL/TLS certificates | `uses: SSanjeevi/dokployaction/actions/setup-ssl@v1` |
| **configure-domain** | Set up custom domain | `uses: SSanjeevi/dokployaction/actions/configure-domain@v1` |
| **rollback** | Rollback to previous deployment | `uses: SSanjeevi/dokployaction/actions/rollback@v1` |

### Example: Using Composite Actions

```yaml
steps:
  - name: Deploy Application
    uses: SSanjeevi/dokployaction/actions/deploy@v1
    with:
      dokploy-url: ${{ secrets.DOKPLOY_URL }}
      api-key: ${{ secrets.DOKPLOY_API_KEY }}
      application-id: 'app_123'
      docker-image: 'ghcr.io/user/app:latest'

  - name: Verify Health
    uses: SSanjeevi/dokployaction/actions/health-check@v1
    with:
      health-check-path: '/health'
      max-retries: 10
      retry-interval: 6

  - name: Cleanup Old Containers
    uses: SSanjeevi/dokployaction/actions/cleanup-containers@v1
    with:
      dokploy-url: ${{ secrets.DOKPLOY_URL }}
      api-key: ${{ secrets.DOKPLOY_API_KEY }}
      application-id: 'app_123'
      keep-count: 2
```

📖 **Full documentation**: [actions/README.md](actions/README.md)

---

## ⚙️ Configuration

### Main Action Inputs

The main action (`SSanjeevi/dokployaction@v1`) supports the following inputs:

#### Required Inputs
- `dokploy-url`: Your Dokploy instance URL (e.g., `https://dokploy.example.com`)
- `api-key`: Dokploy API key for authentication
- `application-id`: ID of the application to deploy
- `docker-image`: Docker image to deploy (e.g., `ghcr.io/user/app:v1.0.0`)

#### Optional Inputs
- `wait-for-completion`: Wait for deployment to complete (default: `true`)
- `timeout`: Deployment timeout in seconds (default: `300`)
- `memory-limit`: Maximum memory limit in MB (e.g., `512` for 512MB)
- `memory-reservation`: Soft memory reservation in MB (e.g., `256` for 256MB)
- `cpu-limit`: Maximum CPU limit (e.g., `1.0` for 1 CPU, `0.5` for half CPU)
- `cpu-reservation`: CPU reservation/guaranteed allocation (e.g., `0.25`)
- `restart-policy`: Container restart policy: `always`, `unless-stopped`, `on-failure`, `no` (default: `unless-stopped`)
- `replicas`: Number of container replicas (Docker Swarm) (default: `1`)
- `enable-health-check`: Enable health check after deployment (default: `true`)
- `health-check-path`: Health check endpoint path (e.g., `/health` or `/`)
- `health-check-retries`: Number of health check retries (default: `10`)
- `health-check-interval`: Interval between retries in seconds (default: `6`)
- `fail-on-health-check-error`: Fail deployment if health check fails (default: `true`)
- `expected-status-code`: Expected HTTP status code (default: `200`)
- `cleanup-old-containers`: Cleanup old containers before deployment (default: `false`)
- `container-prefix`: Container name prefix for filtering
- `keep-container-count`: Number of old containers to keep (default: `1`)
- `rollback-on-failure`: Enable rollback on failure (default: `true`)
- `application-port`: Container port the application listens on (default: `80`)

### Outputs

- `deployment-id`: The deployment ID from Dokploy
- `deployment-status`: Deployment status (`success`/`failed`/`timeout`)
- `health-status`: Health check status (`healthy`/`unhealthy`/`skipped`)
- `containers-cleaned`: Number of old containers cleaned up

### Example with All Options

```yaml
- uses: SSanjeevi/dokployaction@v1
  with:
    # Required
    dokploy-url: ${{ secrets.DOKPLOY_URL }}
    api-key: ${{ secrets.DOKPLOY_API_KEY }}
    application-id: 'app_abc123'
    docker-image: 'ghcr.io/myorg/myapp:v1.2.3'

    # Deployment control
    wait-for-completion: true
    timeout: 600

    # Resource limits
    memory-limit: 512  # 512MB max memory
    memory-reservation: 256  # 256MB soft limit
    cpu-limit: 1.0  # Max 1 CPU core
    cpu-reservation: 0.5  # Reserve 0.5 CPU cores
    restart-policy: 'unless-stopped'

    # Scaling (Docker Swarm)
    replicas: 3  # Run 3 instances

    # Health checks
    enable-health-check: true
    health-check-path: '/health'
    health-check-retries: 15
    health-check-interval: 10
    fail-on-health-check-error: true  # Set to false to continue even if health check fails
    expected-status-code: 200

    # Container management
    cleanup-old-containers: true
    container-prefix: 'myapp-prod'
    keep-container-count: 2

    # Rollback
    rollback-on-failure: true
```

---

## 🔐 Security Best Practices

1. **Use GitHub Secrets**: Store `DOKPLOY_URL` and `DOKPLOY_API_KEY` as repository secrets
2. **Private Registry Credentials**: Use secrets for `REGISTRY_USERNAME` and `REGISTRY_PASSWORD`
3. **API Key Rotation**: Rotate Dokploy API keys periodically
4. **Least Privilege**: Use API keys with minimum required permissions
5. **Review Logs**: Monitor GitHub Actions logs for deployment activity
6. **Environment Protection**: Use GitHub environment protection rules for production deployments

## 📚 Documentation

- [Quick Start Guide](QUICK_START.md) - Get started quickly with examples
- [Features Documentation](FEATURES.md) - Detailed feature descriptions
- [Contributing Guide](CONTRIBUTING.md) - How to contribute to this project
- [Changelog](CHANGELOG.md) - Version history and changes
- [Composite Actions](actions/README.md) - Documentation for individual actions

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Reporting bugs
- Suggesting features
- Submitting pull requests
- Running tests locally

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Dokploy](https://dokploy.com) - The deployment platform this action integrates with
- [GitHub Actions](https://github.com/features/actions) - The CI/CD platform
- All contributors who help improve this project

## 📞 Support

- **Documentation**: [Dokploy Docs](https://docs.dokploy.com)
- **Issues**: [GitHub Issues](https://github.com/SSanjeevi/dokployaction/issues)
- **Discussions**: [GitHub Discussions](https://github.com/SSanjeevi/dokployaction/discussions)
- **Dokploy Community**: [Dokploy Discord](https://discord.gg/dokploy)

---

**Made with ❤️ for the Dokploy community**

