# Azure Container Apps Deployment Guide

This guide walks you through deploying the OKR Framework application to Azure Container Apps.

## Overview

The deployment uses Azure Container Apps to host all services as containers:
- **Infrastructure Services**: PostgreSQL and Redis (containerized)
- **Application Services**: Core API, AI Service, Integration Service, Keycloak, API Gateway, Web App
- **Container Registry**: Azure Container Registry (ACR) for storing Docker images

## Prerequisites

- [ ] Azure account with access to the `vibe-code-test` resource group
- [ ] Azure CLI installed (`az --version`)
- [ ] Docker installed and running locally
- [ ] Environment variables documented (JWT_SECRET, API keys, etc.)
- [ ] Access to the repository

## Step 1: Azure CLI Setup and Authentication

### Quick Setup (Recommended)

Run the automated setup script:

```bash
cd azure
./setup-azure-cli.sh
```

This interactive script will:
- Check if Azure CLI is installed
- Guide you through Azure login
- Verify resource group access
- Install required Azure CLI extensions
- Check Docker installation

### Manual Setup

For detailed manual setup instructions, see [AZURE_CLI_SETUP.md](./AZURE_CLI_SETUP.md).

**Quick manual steps:**

```bash
# Install Azure CLI (if needed)
# macOS: brew install azure-cli
# Linux: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login to Azure
az login

# Set default subscription (if multiple)
az account set --subscription "YOUR_SUBSCRIPTION_ID"

# Install Container Apps extension
az extension add --name containerapp --upgrade

# Verify resource group access
az group show --name vibe-code-test
```

If the resource group doesn't exist, it will be created automatically during deployment.

## Step 2: Configure Environment Variables

1. Copy the example environment file:

```bash
cd azure
cp .env.example .env
```

2. Edit `.env` and fill in your values:

```bash
# Required values
RESOURCE_GROUP=vibe-code-test
LOCATION=eastus  # or your preferred Azure region
POSTGRES_PASSWORD=<strong-password>
JWT_SECRET=<generate-strong-secret>
KEYCLOAK_ADMIN_PASSWORD=<strong-password>
NEXTAUTH_SECRET=<generate-strong-secret>

# Optional but recommended
OPENAI_API_KEY=<your-openai-key>
ANTHROPIC_API_KEY=<your-anthropic-key>
```

**Important**: Generate strong secrets for production:
```bash
# Generate random secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For NEXTAUTH_SECRET
openssl rand -base64 32  # For POSTGRES_PASSWORD
```

## Step 3: Deploy Infrastructure

The deployment script will:
1. Create Azure Container Registry (ACR)
2. Create Log Analytics Workspace
3. Create Container Apps Environment
4. Optionally create Key Vault for secrets

Run the main deployment script:

```bash
cd azure
./deploy.sh
```

Or run steps individually:

```bash
# Step 1: Provision infrastructure
./infrastructure.sh

# Step 2: Build and push Docker images
./build-and-push.sh

# Step 3: Deploy infrastructure services (PostgreSQL, Redis)
./deploy-infrastructure.sh

# Step 4: Deploy application services
./deploy-services.sh
```

## Step 4: Database Migration

After deployment, run Prisma migrations:

```bash
# Set DATABASE_URL to your PostgreSQL container
export DATABASE_URL="postgresql://okr_user:YOUR_PASSWORD@okr-nexus-postgres:5432/okr_nexus?schema=public"

# Run migrations
cd services/core-api
npx prisma migrate deploy

# Optional: Seed database
npm run db:seed
```

**Note**: You'll need to connect to the PostgreSQL container from a pod or use Azure Cloud Shell with the Container Apps exec feature.

Alternatively, you can run migrations locally if you configure port forwarding:

```bash
# Get PostgreSQL container app name
az containerapp list --resource-group vibe-code-test --query "[?contains(name, 'postgres')].name" -o tsv

# Port forward (requires Azure CLI extension)
az containerapp exec --name okr-nexus-postgres --resource-group vibe-code-test --command "/bin/sh"
```

## Step 5: Verify Deployment

### Check Container Apps Status

```bash
az containerapp list --resource-group vibe-code-test --output table
```

### Get Service URLs

```bash
# API Gateway URL
az containerapp show \
    --name okr-nexus-api-gateway \
    --resource-group vibe-code-test \
    --query properties.configuration.ingress.fqdn -o tsv

# Web App URL
az containerapp show \
    --name okr-nexus-web \
    --resource-group vibe-code-test \
    --query properties.configuration.ingress.fqdn -o tsv
```

### Test Services

```bash
# Test API Gateway
curl https://<api-gateway-url>/health

# Test Web App
curl https://<web-app-url>
```

### View Logs

```bash
# View logs for a specific service
az containerapp logs show \
    --name okr-nexus-core-api \
    --resource-group vibe-code-test \
    --follow
```

## Step 6: Update Environment Variables

After deployment, update your `.env` file with the actual service URLs:

```bash
# Get URLs
API_GATEWAY_URL=$(az containerapp show --name okr-nexus-api-gateway --resource-group vibe-code-test --query properties.configuration.ingress.fqdn -o tsv)
WEB_APP_URL=$(az containerapp show --name okr-nexus-web --resource-group vibe-code-test --query properties.configuration.ingress.fqdn -o tsv)

# Update .env
sed -i '' "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://$API_GATEWAY_URL|" .env
sed -i '' "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=https://$WEB_APP_URL|" .env
sed -i '' "s|CORS_ORIGINS=.*|CORS_ORIGINS=https://$WEB_APP_URL|" .env
```

Then update the web app container:

```bash
az containerapp update \
    --name okr-nexus-web \
    --resource-group vibe-code-test \
    --set-env-vars \
        NEXT_PUBLIC_API_URL="https://$API_GATEWAY_URL" \
        NEXTAUTH_URL="https://$WEB_APP_URL"
```

## Architecture

### Service Communication

```
Internet
  │
  ├─→ Web App (public) ──→ API Gateway (public)
  │                          │
  │                          ├─→ Core API (internal)
  │                          │   ├─→ PostgreSQL (internal)
  │                          │   └─→ Redis (internal)
  │                          │
  │                          ├─→ AI Service (internal)
  │                          │   └─→ Redis (internal)
  │                          │
  │                          ├─→ Integration Service (internal)
  │                          │   ├─→ PostgreSQL (internal)
  │                          │   └─→ Redis (internal)
  │                          │
  │                          └─→ Keycloak (internal)
  │                              └─→ PostgreSQL (internal)
```

### Internal DNS

Container Apps Environment provides internal DNS resolution. Services can communicate using their container app names:
- `okr-nexus-postgres:5432`
- `okr-nexus-redis:6379`
- `okr-nexus-core-api:3001`
- `okr-nexus-keycloak:8080`

## Environment Variables Reference

### Core API

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: JWT signing secret
- `KEYCLOAK_URL`: Keycloak server URL (internal)
- `KEYCLOAK_REALM`: Keycloak realm name
- `KEYCLOAK_CLIENT_ID`: Keycloak client ID
- `KEYCLOAK_CLIENT_SECRET`: Keycloak client secret

### AI Service

- `REDIS_URL`: Redis connection string
- `CORE_API_URL`: Core API URL (internal)
- `OPENAI_API_KEY`: OpenAI API key
- `ANTHROPIC_API_KEY`: Anthropic API key
- `AI_DEFAULT_PROVIDER`: Default LLM provider (openai/anthropic)

### API Gateway

- `CORE_API_URL`: Core API URL (internal)
- `AI_SERVICE_URL`: AI Service URL (internal)
- `INTEGRATION_SERVICE_URL`: Integration Service URL (internal)
- `KEYCLOAK_URL`: Keycloak URL (internal)
- `JWT_SECRET`: JWT verification secret
- `CORS_ORIGINS`: Allowed CORS origins

### Web App

- `NEXT_PUBLIC_API_URL`: API Gateway public URL
- `NEXTAUTH_URL`: NextAuth base URL
- `NEXTAUTH_SECRET`: NextAuth secret

## Troubleshooting

### Container App Not Starting

1. Check logs:
```bash
az containerapp logs show --name <app-name> --resource-group vibe-code-test --follow
```

2. Check container app status:
```bash
az containerapp show --name <app-name> --resource-group vibe-code-test --query properties.runningStatus
```

3. Check revision status:
```bash
az containerapp revision list --name <app-name> --resource-group vibe-code-test
```

### Database Connection Issues

1. Verify PostgreSQL is running:
```bash
az containerapp show --name okr-nexus-postgres --resource-group vibe-code-test
```

2. Check connection string format:
```
postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public
```

3. Verify internal DNS resolution (from within a container):
```bash
az containerapp exec --name okr-nexus-core-api --resource-group vibe-code-test --command "nslookup okr-nexus-postgres"
```

### Image Pull Errors

1. Verify ACR login:
```bash
az acr login --name <acr-name>
```

2. Check image exists:
```bash
az acr repository list --name <acr-name>
```

3. Verify container app has ACR access:
```bash
az containerapp registry list --name <app-name> --resource-group vibe-code-test
```

### Service Communication Issues

1. Verify services are in the same Container Apps Environment:
```bash
az containerapp list --resource-group vibe-code-test --query "[].{Name:name, Environment:properties.environmentId}" -o table
```

2. Check ingress configuration:
```bash
az containerapp show --name <app-name> --resource-group vibe-code-test --query properties.configuration.ingress
```

### Keycloak Issues

1. Check Keycloak logs:
```bash
az containerapp logs show --name okr-nexus-keycloak --resource-group vibe-code-test --follow
```

2. Verify database connection:
```bash
az containerapp exec --name okr-nexus-keycloak --resource-group vibe-code-test --command "echo \$KC_DB_URL"
```

3. Access Keycloak admin console (if ingress is configured):
```bash
# Get Keycloak URL
az containerapp show --name okr-nexus-keycloak --resource-group vibe-code-test --query properties.configuration.ingress.fqdn -o tsv
```

## Scaling

Container Apps automatically scales based on traffic. You can configure scaling:

```bash
# Update scaling configuration
az containerapp update \
    --name okr-nexus-core-api \
    --resource-group vibe-code-test \
    --min-replicas 2 \
    --max-replicas 10
```

## Updating Services

### Update a Single Service

1. Build and push new image:
```bash
cd azure
./build-and-push.sh
```

2. Update container app:
```bash
az containerapp update \
    --name okr-nexus-core-api \
    --resource-group vibe-code-test \
    --image <acr-login-server>/okr-nexus-core-api:latest
```

### Rolling Update

Container Apps automatically performs rolling updates when you update the image. Monitor the update:

```bash
az containerapp revision list --name <app-name> --resource-group vibe-code-test --output table
```

## Cost Estimation

Approximate monthly costs (pay-as-you-go):

- **Container Apps Environment**: ~$0.01/hour (~$7/month base)
- **Container Apps** (per vCPU/hour): ~$0.000012/vCPU-second
- **ACR Basic**: ~$5/month
- **Log Analytics**: ~$2.30/GB ingested
- **Data Transfer**: First 5GB free, then ~$0.05/GB

**Example for small deployment**:
- 6 container apps × 1 vCPU average × 730 hours = ~$52/month
- ACR: $5/month
- Log Analytics: ~$5/month
- **Total**: ~$70/month

**Note**: Costs vary based on traffic, scaling, and data transfer. Monitor usage in Azure Portal.

## Backup and Recovery

### PostgreSQL Backup

PostgreSQL data is stored in container volumes. For production, consider:

1. **Automated backups**: Use Azure Backup or scheduled pg_dump
2. **Point-in-time recovery**: Not available with containerized PostgreSQL (consider Azure Database for PostgreSQL)
3. **Manual backup**:
```bash
az containerapp exec --name okr-nexus-postgres --resource-group vibe-code-test --command "pg_dump -U okr_user okr_nexus > /tmp/backup.sql"
```

### Redis Backup

Redis AOF persistence is enabled. For production, consider:
- Azure Cache for Redis (managed service) for automatic backups
- Scheduled RDB snapshots

## Security Best Practices

1. **Use Key Vault for secrets**: Store sensitive values in Azure Key Vault
2. **Enable HTTPS**: Container Apps provides HTTPS by default
3. **Network isolation**: Use internal ingress for backend services
4. **Regular updates**: Keep container images updated
5. **Monitor access**: Enable Azure Monitor and set up alerts
6. **Strong passwords**: Use strong, randomly generated passwords
7. **Least privilege**: Use managed identities where possible

## Cleanup

To remove all resources:

```bash
# Delete resource group (removes everything)
az group delete --name vibe-code-test --yes --no-wait
```

Or delete individual resources:

```bash
# Delete container apps
az containerapp delete --name <app-name> --resource-group vibe-code-test

# Delete ACR
az acr delete --name <acr-name> --resource-group vibe-code-test
```

## Additional Resources

- [Azure Container Apps Documentation](https://docs.microsoft.com/azure/container-apps/)
- [Azure CLI Container Apps Reference](https://docs.microsoft.com/cli/azure/containerapp)
- [Container Apps Pricing](https://azure.microsoft.com/pricing/details/container-apps/)

## Support

For issues or questions:
1. Check logs: `az containerapp logs show`
2. Review Azure Portal: Container Apps → Your App → Logs
3. Check Azure Service Health: https://status.azure.com/

