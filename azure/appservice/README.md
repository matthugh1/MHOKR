# Azure App Service Deployment (No Docker)

This directory contains scripts for deploying the OKR Framework to Azure App Service **without Docker**. This approach provides:

- ✅ Faster deployments (no image builds)
- ✅ Easier troubleshooting (streaming logs, SSH access)
- ✅ Lower complexity (no container registry needed)
- ✅ Built-in Node.js runtime management

## Prerequisites

- Azure CLI installed and logged in (`az login`)
- Node.js 20+ installed locally
- Access to resource group with managed PostgreSQL and Redis

## Quick Start

```bash
cd azure/appservice

# 1. Configure environment
cp .env.example .env
# Edit .env with your values (managed database/redis URLs, secrets, etc.)

# 2. Run full deployment
./deploy.sh
```

## Scripts Overview

| Script | Purpose |
|--------|---------|
| `deploy.sh` | Main orchestration - runs all deployment steps |
| `create-plan.sh` | Creates App Service Plan |
| `build-services.sh` | Builds all Node.js services locally |
| `deploy-backend.sh` | Deploys Core API, AI, Integration, API Gateway |
| `deploy-web.sh` | Deploys Next.js frontend |
| `configure-env.sh` | Sets environment variables on all apps |

## Architecture

```
                    ┌─────────────────┐
                    │   Azure DNS     │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
     ┌────────▼────────┐          ┌────────▼────────┐
     │   Web App       │          │   API Gateway   │
     │   (Next.js)     │─────────▶│   (Express)     │
     │   Static+SSR    │          │   Port 3000     │
     └─────────────────┘          └────────┬────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
           ┌────────▼────────┐    ┌────────▼────────┐    ┌────────▼────────┐
           │   Core API      │    │   AI Service    │    │ Integration Svc │
           │   (NestJS)      │    │   (NestJS)      │    │   (NestJS)      │
           │   Port 3001     │    │   Port 3002     │    │   Port 3003     │
           └────────┬────────┘    └────────┬────────┘    └─────────────────┘
                    │                      │
           ┌────────▼────────┐    ┌────────▼────────┐
           │  PostgreSQL     │    │  Redis Cache    │
           │  (Managed)      │    │  (Managed)      │
           └─────────────────┘    └─────────────────┘
```

## Deployment Approach

### Backend Services (NestJS)
- Built with `nest build` locally
- Deployed as ZIP packages
- Uses `node dist/main.js` startup command

### Frontend (Next.js)
- Built with `next build` locally  
- Uses standalone output mode
- Deployed as ZIP package

## Environment Variables

All services are configured via App Service Configuration. Key variables:

### Shared
- `NODE_ENV`: production
- `REDIS_URL`: Azure Cache for Redis connection string

### Core API
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing key
- `KEYCLOAK_*`: Identity provider settings

### AI Service
- `OPENAI_API_KEY`: OpenAI API key
- `ANTHROPIC_API_KEY`: Anthropic API key

### Web
- `NEXT_PUBLIC_API_URL`: API Gateway public URL
- `NEXTAUTH_SECRET`: NextAuth signing key

## Updating Services

### Update a Single Service
```bash
# Rebuild and redeploy just Core API
./deploy-backend.sh core-api
```

### Update All Services
```bash
./deploy.sh
```

### Update Environment Variables Only
```bash
./configure-env.sh
```

## Troubleshooting

### View Logs
```bash
# Stream live logs
az webapp log tail --name okr-nexus-core-api --resource-group vibe-code-test

# Download log files
az webapp log download --name okr-nexus-core-api --resource-group vibe-code-test
```

### SSH Into App
```bash
az webapp ssh --name okr-nexus-core-api --resource-group vibe-code-test
```

### Check App Status
```bash
az webapp show --name okr-nexus-core-api --resource-group vibe-code-test --query state
```

### Restart App
```bash
az webapp restart --name okr-nexus-core-api --resource-group vibe-code-test
```

## Cost Estimate

| Resource | SKU | Monthly Cost |
|----------|-----|--------------|
| App Service Plan | B1 (shared) | ~$13 |
| Additional Web Apps | Included in plan | $0 |
| PostgreSQL Flexible | B1ms | ~$15 |
| Redis Cache | C0 Basic | ~$16 |
| **Total** | | **~$44/month** |

*Costs may vary by region. Consider P1v2 (~$75/month) for production workloads.*

## Cleanup

```bash
# Delete all App Service resources
az webapp delete --name okr-nexus-web --resource-group vibe-code-test
az webapp delete --name okr-nexus-api-gateway --resource-group vibe-code-test
az webapp delete --name okr-nexus-core-api --resource-group vibe-code-test
az webapp delete --name okr-nexus-ai-service --resource-group vibe-code-test
az webapp delete --name okr-nexus-integration-service --resource-group vibe-code-test
az appservice plan delete --name okr-nexus-plan --resource-group vibe-code-test

# Or delete everything (including managed services)
az group delete --name vibe-code-test --yes
```



