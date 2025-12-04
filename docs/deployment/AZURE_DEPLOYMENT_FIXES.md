# Azure Deployment Fixes Summary

## Problem
Frontend was trying to connect to `http://localhost:3001/auth/login` instead of the Azure API Gateway, resulting in `ERR_CONNECTION_REFUSED`.

## Root Cause
**Next.js `NEXT_PUBLIC_*` environment variables are baked into the build at build time, not runtime.**

The deployment process was:
1. Building web app WITHOUT `NEXT_PUBLIC_API_URL` → defaults to `http://localhost:3001`
2. Deploying API Gateway → gets URL like `https://okr-nexus-api-gateway.xxx.azurecontainerapps.io`
3. Trying to set `NEXT_PUBLIC_API_URL` at runtime → **FAILS** because Next.js already baked `localhost:3001` into the build

## Fixes Applied

### 1. Fixed Deployment Scripts ✅

**`azure/deploy-services.sh`**:
- Now deploys API Gateway FIRST
- After API Gateway is deployed, REBUILDS the web app with the correct `NEXT_PUBLIC_API_URL`
- Removed runtime `NEXT_PUBLIC_API_URL` (doesn't work for Next.js)

**`azure/build-and-push.sh`**:
- Added support for `NEXT_PUBLIC_API_URL` build argument
- Can now build web app with API Gateway URL when provided

### 2. Created Rebuild Script ✅

**`azure/rebuild-web-app.sh`**:
- Standalone script to rebuild web app after API Gateway URL changes
- Usage: `./rebuild-web-app.sh <api-gateway-url>`
- Useful for updating web app when API Gateway URL changes

### 3. Created Environment Template ✅

**`azure/.env.example`**:
- Comprehensive template with all required variables
- Includes comments explaining each variable
- Provides guidance on generating secrets

## Updated Deployment Flow

### Correct Process:
1. **Initial Build**: Build all services (web app built without API URL - this is OK for initial build)
2. **Deploy Infrastructure**: PostgreSQL, Redis
3. **Deploy Backend Services**: Core API, AI Service, Integration Service, Keycloak
4. **Deploy API Gateway**: Get public URL
5. **Rebuild Web App**: Build with `NEXT_PUBLIC_API_URL` pointing to API Gateway ✅ **NEW**
6. **Deploy Web App**: Deploy rebuilt image ✅ **FIXED**

## Testing the Fix

After deploying, verify:
1. API Gateway is accessible: `curl https://<api-gateway-url>/health`
2. Web app is accessible: `curl https://<web-app-url>`
3. Frontend connects to API Gateway (check browser console - should NOT see localhost:3001)
4. Login flow works end-to-end

## Manual Rebuild (if needed)

If API Gateway URL changes, rebuild web app:
```bash
cd azure
./rebuild-web-app.sh https://your-api-gateway-url.azurecontainerapps.io
az containerapp update \
    --name okr-nexus-web \
    --resource-group vibe-code-test \
    --image okrnexusregistry.azurecr.io/okr-nexus-web:latest
```

## Files Changed

1. ✅ `azure/build-and-push.sh` - Added build arg support
2. ✅ `azure/deploy-services.sh` - Fixed deployment order and rebuild logic
3. ✅ `azure/rebuild-web-app.sh` - New script for manual rebuilds
4. ✅ `azure/.env.example` - New environment template
5. ✅ `docs/deployment/AZURE_DEPLOYMENT_AUDIT.md` - Comprehensive audit report

## Next Steps

1. ✅ Fixes applied - ready to test
2. Run deployment: `cd azure && ./deploy.sh`
3. Verify frontend connects to API Gateway (not localhost)
4. Test login flow end-to-end

## Notes

- The TypeScript error mentioned in the deployment log may have been fixed already (no linter errors found)
- If build still fails, check `apps/web/src/components/okr/AttentionDrawer.tsx` for any ref-related issues
- All `NEXT_PUBLIC_*` variables MUST be set at build time, not runtime






