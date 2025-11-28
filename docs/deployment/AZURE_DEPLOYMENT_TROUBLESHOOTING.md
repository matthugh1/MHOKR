# Azure Deployment Troubleshooting Guide

## Issues Fixed in This Deployment

### Issue 1: Frontend Connecting to localhost:3001 ❌→✅

**Problem**: 
```
POST http://localhost:3001/auth/login net::ERR_CONNECTION_REFUSED
```

**Root Cause**: 
- Next.js `NEXT_PUBLIC_*` environment variables are baked at **build time**, not runtime
- Web app was built without `NEXT_PUBLIC_API_URL`, defaulting to `localhost:3001`

**Fix**:
1. Modified `azure/deploy-services.sh` to:
   - Deploy API Gateway first
   - Rebuild web app with `--build-arg NEXT_PUBLIC_API_URL=<api-gateway-url>`
   - Deploy web app with correct URL baked in

**Files Changed**:
- `azure/build-and-push.sh` - Added build arg support
- `azure/deploy-services.sh` - Fixed deployment order
- `azure/rebuild-web-app.sh` - New script for manual rebuilds

### Issue 2: Browser Cache Showing Old Code ❌→✅

**Problem**: 
Browser cached old JavaScript files that still had `localhost:3001`

**Fix**: 
Hard refresh the browser:
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

### Issue 3: CORS Error ❌→✅

**Problem**:
```
Access to XMLHttpRequest at 'https://okr-nexus-api-gateway...io/api/auth/login' 
from origin 'https://okr-nexus-web...io' has been blocked by CORS policy
```

**Root Cause**:
API Gateway's `CORS_ORIGINS` environment variable was set to placeholder value

**Fix**:
```bash
az containerapp update \
  --name okr-nexus-api-gateway \
  --resource-group vibe-code-test \
  --set-env-vars "CORS_ORIGINS=https://okr-nexus-web.salmonground-fc94351a.uksouth.azurecontainerapps.io"
```

Also updated deployment script to set correct CORS origin automatically.

## Current Deployment Status ✅

| Service | URL | Status |
|---------|-----|--------|
| Web App | https://okr-nexus-web.salmonground-fc94351a.uksouth.azurecontainerapps.io | ✅ Running |
| API Gateway | https://okr-nexus-api-gateway.salmonground-fc94351a.uksouth.azurecontainerapps.io | ✅ Running |

## Testing Checklist

- [x] Web app is accessible
- [x] Web app has correct API URL baked in
- [x] API Gateway returns CORS headers
- [ ] Login flow works end-to-end (test this now!)

## Common Issues

### 404 on favicon.ico
This is normal and can be ignored. Add a favicon.ico to `apps/web/public/` if desired.

### Still seeing localhost:3001 after deployment
Clear browser cache with hard refresh or use incognito mode.

### CORS errors after new deployment
Check that `CORS_ORIGINS` includes the web app URL:
```bash
az containerapp show \
  --name okr-nexus-api-gateway \
  --resource-group vibe-code-test \
  --query "properties.template.containers[0].env" \
  -o json | jq '.[] | select(.name=="CORS_ORIGINS")'
```

### Web app not updating after rebuild
Check the revision number:
```bash
az containerapp revision list \
  --name okr-nexus-web \
  --resource-group vibe-code-test \
  --query "[].{Name:name,Active:properties.active,Traffic:properties.trafficWeight}" \
  -o table
```

## Manual Rebuild Process

If you need to rebuild the web app with a new API Gateway URL:

```bash
cd azure
./rebuild-web-app.sh https://okr-nexus-api-gateway.salmonground-fc94351a.uksouth.azurecontainerapps.io
az containerapp update \
  --name okr-nexus-web \
  --resource-group vibe-code-test \
  --image okrnexusregistry.azurecr.io/okr-nexus-web:latest
```

## Verification Commands

### Check API Gateway CORS
```bash
curl -sI -X OPTIONS \
  -H "Origin: https://okr-nexus-web.salmonground-fc94351a.uksouth.azurecontainerapps.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  https://okr-nexus-api-gateway.salmonground-fc94351a.uksouth.azurecontainerapps.io/api/auth/login \
  | grep -i "access-control"
```

Should return:
```
access-control-allow-origin: https://okr-nexus-web.salmonground-fc94351a.uksouth.azurecontainerapps.io
access-control-allow-credentials: true
access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,DELETE
```

### Check Web App Build
```bash
docker run --rm --entrypoint sh okrnexusregistry.azurecr.io/okr-nexus-web:latest -c \
  "grep -r 'API_URL' /app/apps/web/.next/cache/webpack/client-production/0.pack | head -1"
```

Should show the API Gateway URL, not localhost:3001.

## Next Steps

1. Test login flow in browser
2. Verify API calls are going through API Gateway
3. Check that authentication works
4. Test other features

## Known Limitations

- Container Apps URLs include random hash (`salmonground-fc94351a`) that can't be predicted before deployment
- If Container Apps Environment is recreated, URLs will change and web app must be rebuilt
- CORS must be updated if web app URL changes



