# Azure Deployment Scripts

This directory contains scripts for deploying the OKR Framework application to Azure Container Apps.

## Quick Start

1. **Set up Azure CLI** (first time only):
   ```bash
   ./setup-azure-cli.sh
   ```
   This script will:
   - Check if Azure CLI is installed
   - Guide you through login
   - Verify resource group access
   - Install required extensions
   - Check Docker installation

2. **Configure environment variables**:
   ```bash
   # Option 1: Use migration script to copy from existing .env files
   ./migrate-env.sh
   
   # Option 2: Manual setup
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Run the deployment**:
   ```bash
   ./deploy.sh
   ```

## Scripts Overview

### `setup-azure-cli.sh`
Interactive script to set up and verify Azure CLI installation, login, and required extensions.

### `migrate-env.sh`
Migrates environment variables from your existing `.env` files to `azure/.env` format.

### `deploy.sh`
Main deployment script that orchestrates the entire deployment process.

### `infrastructure.sh`
Creates Azure infrastructure resources:
- Azure Container Registry (ACR)
- Log Analytics Workspace
- Container Apps Environment
- Key Vault (optional)

### `build-and-push.sh`
Builds Docker images for all services and pushes them to ACR.

### `deploy-infrastructure.sh`
Deploys infrastructure services:
- PostgreSQL container
- Redis container

### `deploy-services.sh`
Deploys application services:
- Core API
- AI Service
- Integration Service
- Keycloak
- API Gateway
- Web App

## Prerequisites

- Azure CLI installed and logged in
- Docker installed and running
- Access to `vibe-code-test` resource group
- Environment variables configured in `.env`

## Configuration

See `.env.example` for all available configuration options.

## Documentation

For detailed deployment instructions, see [docs/deployment/AZURE_DEPLOYMENT.md](../docs/deployment/AZURE_DEPLOYMENT.md).

## Troubleshooting

### Script Permission Errors

If you get permission errors, make scripts executable:
```bash
chmod +x *.sh
```

### Azure CLI Not Found

Run the setup script:
```bash
./setup-azure-cli.sh
```

Or install manually:
```bash
# macOS
brew install azure-cli

# Linux
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Windows
# Download from https://aka.ms/installazurecliwindows

# Then login
az login
```

### Docker Build Errors

Ensure Docker is running:
```bash
docker ps
```

### Environment Variable Errors

Ensure `.env` file exists and contains all required variables:
```bash
cp .env.example .env
# Edit .env with your values
```

## Manual Steps

After deployment, you may need to:

1. **Run database migrations**: See deployment docs for instructions
2. **Configure Keycloak**: Access Keycloak admin console and set up realm
3. **Update CORS settings**: Update API Gateway CORS origins with actual web app URL

## Cleanup

To remove all resources:
```bash
az group delete --name vibe-code-test --yes --no-wait
```

