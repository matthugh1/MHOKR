# Azure Deployment Audit Report

**Date**: 2025-01-XX  
**Issue**: Frontend trying to connect to `http://localhost:3001/auth/login` instead of Azure API Gateway  
**Error**: `POST http://localhost:3001/auth/login net::ERR_CONNECTION_REFUSED`

## Critical Issues Found

### 1. **Web App Build Failure** 🔴 CRITICAL
- **Location**: `apps/web/Dockerfile` line 46
- **Error**: TypeScript compilation error in `AttentionDrawer.tsx:254`
- **Issue**: `RefObject<HTMLDivElement | null>` type mismatch with SheetContent ref prop
- **Impact**: Web app cannot be built and deployed to Azure
- **Status**: BLOCKING deployment

### 2. **NEXT_PUBLIC_API_URL Not Set at Build Time** 🔴 CRITICAL
- **Location**: `azure/build-and-push.sh` lines 60-64
- **Issue**: Docker build does not pass `NEXT_PUBLIC_API_URL` as build argument
- **Impact**: Next.js bakes environment variables at build time. Without this, the app defaults to `http://localhost:3001`
- **Root Cause**: 
  - `NEXT_PUBLIC_*` variables must be available at build time, not runtime
  - The Dockerfile accepts `ARG NEXT_PUBLIC_API_URL` but it's never passed during build
  - `deploy-services.sh` tries to set it at runtime, which doesn't work for Next.js
- **Status**: BLOCKING correct API endpoint configuration

### 3. **Deployment Order Issue** 🟡 HIGH
- **Location**: `azure/deploy-services.sh` lines 211-251
- **Issue**: Script tries to get `API_GATEWAY_URL` before deploying API Gateway
- **Impact**: `$API_GATEWAY_URL` may be empty when deploying web app
- **Status**: CAUSES incorrect configuration

### 4. **Missing Environment Variable Template** 🟡 MEDIUM
- **Location**: `azure/.env.example` (does not exist)
- **Issue**: No template file to guide environment variable configuration
- **Impact**: Users may miss required variables
- **Status**: DOCUMENTATION gap

## Architecture Analysis

### Current Flow (Broken)
```
1. Build web app WITHOUT NEXT_PUBLIC_API_URL
   → Builds with default: http://localhost:3001
2. Deploy API Gateway
   → Gets URL: https://okr-nexus-api-gateway.xxx.azurecontainerapps.io
3. Try to set NEXT_PUBLIC_API_URL at runtime
   → FAILS: Next.js already baked localhost:3001 into the build
4. User accesses web app
   → Frontend tries to connect to localhost:3001
   → ERR_CONNECTION_REFUSED
```

### Expected Flow (Fixed)
```
1. Deploy API Gateway first
   → Get URL: https://okr-nexus-api-gateway.xxx.azurecontainerapps.io
2. Build web app WITH NEXT_PUBLIC_API_URL=https://okr-nexus-api-gateway.xxx.azurecontainerapps.io
   → Next.js bakes correct URL into build
3. Deploy web app
   → Frontend connects to correct API Gateway URL
```

## Files Requiring Changes

### 1. `apps/web/src/components/okr/AttentionDrawer.tsx`
- **Issue**: TypeScript type error on line 254
- **Fix**: Remove ref prop or fix type definition

### 2. `azure/build-and-push.sh`
- **Issue**: Missing `--build-arg NEXT_PUBLIC_API_URL` for web app build
- **Fix**: Add build argument when building web app image

### 3. `azure/deploy.sh`
- **Issue**: Deployment order doesn't account for API Gateway URL dependency
- **Fix**: Deploy API Gateway first, then rebuild web app with correct URL

### 4. `azure/deploy-services.sh`
- **Issue**: Tries to use API Gateway URL before it exists
- **Fix**: Deploy API Gateway first, capture URL, then rebuild web app

## Recommended Fix Strategy

### Phase 1: Fix Build Error (Immediate)
1. Fix TypeScript error in `AttentionDrawer.tsx`
2. Verify build succeeds locally

### Phase 2: Fix API URL Configuration (Critical)
1. Modify deployment scripts to:
   - Deploy API Gateway first
   - Capture API Gateway URL
   - Rebuild web app with `NEXT_PUBLIC_API_URL` build arg
   - Push updated web app image
   - Deploy web app

### Phase 3: Improve Deployment Process
1. Create `.env.example` template
2. Add validation for required environment variables
3. Add better error messages

## Testing Checklist

After fixes:
- [ ] Web app builds successfully
- [ ] API Gateway deploys and is accessible
- [ ] Web app is built with correct `NEXT_PUBLIC_API_URL`
- [ ] Frontend can connect to API Gateway
- [ ] Login flow works end-to-end
- [ ] All API calls go through API Gateway, not localhost

## Additional Observations

### Environment Variable Handling
- Next.js `NEXT_PUBLIC_*` variables are embedded at build time
- Runtime environment variables won't work for `NEXT_PUBLIC_*`
- Need to rebuild image if API Gateway URL changes

### Alternative Solutions Considered
1. **Runtime Configuration**: Use Next.js runtime config (deprecated in Next.js 13+)
2. **API Proxy**: Use Next.js rewrites (already implemented but not sufficient)
3. **Build-time Configuration**: Pass URL as build arg (RECOMMENDED)

### Current API Configuration
- `apps/web/src/lib/api.ts`: Uses `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'`
- `apps/web/next.config.js`: Has rewrites but they're not used in production
- `apps/web/src/app/api/[...path]/route.ts`: Uses same fallback

## Fixes Applied

### ✅ Fixed: API URL Configuration
- **Modified**: `azure/build-and-push.sh`
  - Added support for `NEXT_PUBLIC_API_URL` build argument
  - Allows building web app with API Gateway URL when provided
  
- **Modified**: `azure/deploy-services.sh`
  - Changed deployment order: Deploy API Gateway first
  - After API Gateway deployment, rebuilds web app with correct `NEXT_PUBLIC_API_URL`
  - Removed runtime `NEXT_PUBLIC_API_URL` (doesn't work for Next.js)
  
- **Created**: `azure/rebuild-web-app.sh`
  - Standalone script to rebuild web app after API Gateway URL changes
  - Useful for updating web app when API Gateway URL changes

### ✅ Fixed: Environment Variable Template
- **Created**: `azure/.env.example`
  - Comprehensive template with all required variables
  - Includes comments explaining each variable
  - Provides guidance on generating secrets

## Next Steps

1. ✅ **Fixed**: API URL configuration in deployment scripts
2. ✅ **Fixed**: Created `.env.example` template
3. **Pending**: Test end-to-end deployment with fixes
4. **Pending**: Verify TypeScript error is resolved (may have been fixed already)
5. **Nice to have**: Add deployment validation and better error messages

## Deployment Process (Updated)

### Correct Deployment Flow
1. **Initial Build**: Build all services (web app built without API URL)
2. **Deploy Infrastructure**: PostgreSQL, Redis
3. **Deploy Backend Services**: Core API, AI Service, Integration Service, Keycloak
4. **Deploy API Gateway**: Get public URL
5. **Rebuild Web App**: Build with `NEXT_PUBLIC_API_URL` pointing to API Gateway
6. **Deploy Web App**: Deploy rebuilt image

### Manual Rebuild (if needed)
If API Gateway URL changes, rebuild web app:
```bash
cd azure
./rebuild-web-app.sh https://your-api-gateway-url.azurecontainerapps.io
az containerapp update \
    --name okr-nexus-web \
    --resource-group vibe-code-test \
    --image okrnexusregistry.azurecr.io/okr-nexus-web:latest
```

