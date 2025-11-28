# Azure App Service Deployment Guide

## Overview

This guide documents the deployment process for OKR Nexus to Azure App Service (Linux) without Docker. It covers all services: Web App (Next.js), Core API (NestJS), API Gateway, AI Service, and Integration Service.

## What Was Fixed

### 1. Static File Serving (Next.js)
- **Issue**: Static files (`/_next/static/*`) returning 404 errors
- **Fix**: 
  - Ensured entire `.next` directory structure is copied correctly
  - Created proper `startup.sh` script for correct working directory
  - Configured Azure App Service startup command correctly

### 2. Build System
- **Issue**: TypeScript compilation errors, workspace dependencies not resolving
- **Fix**:
  - Updated build scripts to handle both `dist/main.js` (NestJS webpack) and `dist/index.js` (API Gateway tsc)
  - Fixed workspace package resolution by copying `@okr-nexus/utils` and `@okr-nexus/types` after npm install
  - Removed `workspace:*` dependencies before npm install, then copied packages manually

### 3. Prisma Client Generation
- **Issue**: Prisma client not generated or wrong version (Prisma 7 vs 5.8.1)
- **Fix**:
  - Pinned Prisma to version 5.8.1 in `package.json`
  - Generate Prisma client locally before build
  - Copy Prisma client to deployment package
  - Created startup script that generates Prisma client if missing on Azure

### 4. Native Module Issues (bcrypt)
- **Issue**: `ERR_DLOPEN_FAILED` for bcrypt native module
- **Fix**: Replaced `bcrypt` with `bcryptjs` (pure JavaScript implementation)

### 5. Azure AD Authentication
- **Issue**: `Invalid value for clientID` error when Azure AD not configured
- **Fix**: Made Azure AD strategy optional - app starts even without Azure AD config

### 6. Database Schema Migration
- **Issue**: Missing `azureAdId` column in production database
- **Fix**: Created migration script to add column directly to Azure PostgreSQL

### 7. CORS Configuration
- **Issue**: CORS policy blocking requests from web app
- **Fix**: Enhanced CORS middleware in API Gateway with proper origin handling

## Deployment Process

### Prerequisites

1. **Azure CLI** installed and logged in:
   ```bash
   az login
   az account set --subscription <your-subscription-id>
   ```

2. **Environment Variables** configured in `azure/appservice/.env`:
   ```bash
   RESOURCE_GROUP=vibe-code-test
   APP_NAME_PREFIX=okr-nexus
   DATABASE_URL=postgresql://...
   # ... other variables
   ```

3. **Dependencies** installed at project root:
   ```bash
   npm install
   # or
   pnpm install
   ```

### Step-by-Step Deployment

#### 1. Build All Services

```bash
cd azure/appservice
./build-services.sh
```

This builds:
- `web` (Next.js standalone)
- `core-api` (NestJS with webpack)
- `api-gateway` (TypeScript compilation)
- `ai-service` (NestJS)
- `integration-service` (NestJS)

Build artifacts are created in `azure/appservice/build/` as ZIP files.

#### 2. Deploy Web App

```bash
./deploy-web.sh
```

This:
- Creates/updates Azure App Service
- Sets startup command to `./startup.sh`
- Configures environment variables
- Deploys the ZIP package

#### 3. Deploy Backend Services

Deploy all services:
```bash
./deploy-backend.sh
```

Or deploy a specific service:
```bash
./deploy-backend.sh core-api
./deploy-backend.sh api-gateway
./deploy-backend.sh ai-service
./deploy-backend.sh integration-service
```

#### 4. Run Database Migrations (if needed)

If you've added new Prisma migrations:

```bash
# Get DATABASE_URL from Azure
export DATABASE_URL=$(az webapp config appsettings list \
  --name okr-nexus-core-api \
  --resource-group vibe-code-test \
  --query "[?name=='DATABASE_URL'].value" -o tsv)

# Run migrations
cd services/core-api
npx prisma migrate deploy
```

Or use the migration script:
```bash
cd azure/appservice
export DATABASE_URL=$(az webapp config appsettings list \
  --name okr-nexus-core-api \
  --resource-group vibe-code-test \
  --query "[?name=='DATABASE_URL'].value" -o tsv)
./run-migration.sh
```

### Quick Deploy (All Services)

```bash
cd azure/appservice

# Build everything
./build-services.sh

# Deploy web app
./deploy-web.sh

# Deploy all backend services
./deploy-backend.sh

# Restart services (optional, but recommended)
az webapp restart --name okr-nexus-web --resource-group vibe-code-test
az webapp restart --name okr-nexus-core-api --resource-group vibe-code-test
az webapp restart --name okr-nexus-api-gateway --resource-group vibe-code-test
```

## Service-Specific Details

### Web App (Next.js)

- **Build Output**: `apps/web/.next/standalone/`
- **Startup Command**: `./startup.sh`
- **Port**: 5173
- **Key Files**:
  - `server.js` - Next.js standalone server
  - `.next/BUILD_ID` - Required for static file resolution
  - `.next/static/` - Static assets

### Core API (NestJS)

- **Build Output**: `dist/main.js` (webpack bundle)
- **Startup Command**: `node dist/main.js`
- **Port**: 3001
- **Dependencies**:
  - Prisma client must be generated before build
  - Workspace packages (`@okr-nexus/utils`, `@okr-nexus/types`) copied manually
  - `bcryptjs` used instead of `bcrypt`

### API Gateway

- **Build Output**: `dist/index.js` (TypeScript compilation)
- **Startup Command**: `node dist/index.js`
- **Port**: 3000
- **Configuration**: Uses `tsconfig.build.json` for compilation

### AI Service & Integration Service

- **Build Output**: `dist/main.js` (NestJS webpack)
- **Startup Command**: `node dist/main.js`
- **Ports**: 3002 (AI), 3003 (Integration)

## Environment Variables

### Required for Core API

```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
CORS_ORIGINS=https://okr-nexus-web.azurewebsites.net
```

### Required for API Gateway

```bash
CORE_API_URL=https://okr-nexus-core-api.azurewebsites.net
AI_SERVICE_URL=https://okr-nexus-ai-service.azurewebsites.net
INTEGRATION_SERVICE_URL=https://okr-nexus-integration-service.azurewebsites.net
CORS_ORIGINS=https://okr-nexus-web.azurewebsites.net
```

### Required for Web App

```bash
NEXT_PUBLIC_API_URL=https://okr-nexus-api-gateway.azurewebsites.net
NODE_ENV=production
PORT=5173
HOSTNAME=0.0.0.0
```

Set these via Azure Portal or Azure CLI:
```bash
az webapp config appsettings set \
  --name <app-name> \
  --resource-group vibe-code-test \
  --settings KEY=value
```

## Troubleshooting

### Build Failures

1. **Workspace dependencies not found**:
   - Ensure `packages/utils` and `packages/types` are built first
   - Check that `dist/` directories exist in workspace packages

2. **Prisma client not generated**:
   - Run `npx prisma generate` in `services/core-api` before building
   - Ensure Prisma version is 5.8.1 (not 7.x)

3. **TypeScript errors**:
   - Check `tsconfig.build.json` exists for API Gateway
   - Ensure all dependencies are installed

### Runtime Errors

1. **503 Service Unavailable**:
   - Check application logs: `az webapp log tail --name <app-name> --resource-group vibe-code-test`
   - Verify startup command is correct
   - Check environment variables are set

2. **Static files 404**:
   - Verify `.next/BUILD_ID` exists in deployment
   - Check `startup.sh` sets correct working directory
   - Ensure `.next/static/` directory is present

3. **Database connection errors**:
   - Verify `DATABASE_URL` is set correctly
   - Check Azure PostgreSQL firewall rules
   - Ensure SSL mode is `require` in connection string

4. **Module not found errors**:
   - Check workspace packages are copied to `node_modules/@okr-nexus/`
   - Verify Prisma client is generated
   - Check native modules (use `bcryptjs` not `bcrypt`)

### Viewing Logs

```bash
# Stream logs
az webapp log tail --name <app-name> --resource-group vibe-code-test

# Download logs
az webapp log download --name <app-name> --resource-group vibe-code-test

# View in Azure Portal
# App Service > Monitoring > Log stream
```

## Database Migrations

### Adding New Migrations

1. Create migration locally:
   ```bash
   cd services/core-api
   npx prisma migrate dev --name your_migration_name
   ```

2. Test locally:
   ```bash
   npm run dev
   ```

3. Deploy to production:
   ```bash
   # Get DATABASE_URL
   export DATABASE_URL=$(az webapp config appsettings list \
     --name okr-nexus-core-api \
     --resource-group vibe-code-test \
     --query "[?name=='DATABASE_URL'].value" -o tsv)
   
   # Run migrations
   cd services/core-api
   npx prisma migrate deploy
   ```

### Manual SQL Migrations

For one-off migrations (like adding columns), use the migration script:

```bash
cd azure/appservice
export DATABASE_URL=$(az webapp config appsettings list \
  --name okr-nexus-core-api \
  --resource-group vibe-code-test \
  --query "[?name=='DATABASE_URL'].value" -o tsv)
./run-migration.sh
```

Or create a custom script in `azure/appservice/add-azure-ad-column-prisma.js` and run it.

## Best Practices

1. **Always test locally first** - Run `npm run dev` and test changes before deploying

2. **Build before deploying** - Never deploy without rebuilding:
   ```bash
   ./build-services.sh
   ```

3. **Deploy in order**:
   - Backend services first (Core API, AI Service, Integration Service)
   - API Gateway second
   - Web App last

4. **Check logs after deployment** - Always verify services started correctly:
   ```bash
   az webapp log tail --name <app-name> --resource-group vibe-code-test
   ```

5. **Run migrations before deploying** - If schema changes, run migrations first

6. **Use environment variables** - Never hardcode secrets or URLs

7. **Version control** - Commit all changes before deploying

## File Structure Reference

```
azure/appservice/
├── build-services.sh          # Build all services
├── deploy-web.sh              # Deploy web app
├── deploy-backend.sh          # Deploy backend services
├── run-migration.sh           # Run database migrations
├── add-azure-ad-column-prisma.js  # Migration script template
├── startup-core-api.sh        # Startup script for Core API
├── build/                     # Build artifacts (ZIP files)
│   ├── web.zip
│   ├── core-api.zip
│   ├── api-gateway.zip
│   └── ...
└── .env                       # Environment configuration (not in git)
```

## Quick Reference Commands

```bash
# Build all
./build-services.sh

# Deploy web
./deploy-web.sh

# Deploy backend
./deploy-backend.sh [service-name]

# Restart service
az webapp restart --name <app-name> --resource-group vibe-code-test

# View logs
az webapp log tail --name <app-name> --resource-group vibe-code-test

# Get environment variable
az webapp config appsettings list \
  --name <app-name> \
  --resource-group vibe-code-test \
  --query "[?name=='KEY'].value" -o tsv

# Set environment variable
az webapp config appsettings set \
  --name <app-name> \
  --resource-group vibe-code-test \
  --settings KEY=value
```

## Summary

The deployment process is now streamlined and reliable. Key improvements:

- ✅ Static files serve correctly
- ✅ All services build and deploy successfully
- ✅ Prisma client generation is automated
- ✅ Workspace dependencies are handled correctly
- ✅ Database migrations can be run easily
- ✅ Native module issues resolved (bcryptjs)
- ✅ Azure AD authentication is optional

For future deployments, follow the "Quick Deploy" section above. For issues, refer to the "Troubleshooting" section.
