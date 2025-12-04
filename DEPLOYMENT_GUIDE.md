# Deployment Success Guide

This document outlines the critical steps and configurations required to successfully build and deploy the OKR Nexus application to Azure App Service. It documents the solutions to previous build failures, timeouts, and CORS issues.

## 1. Web App Deployment (Frontend)

### The Problem
The deployment was failing with **504 Gateway Timeout** errors. This was caused by the deployment package being too large (~540MB) because it included the full `node_modules` directory and the `.next` build cache.

### The Solution: Next.js Standalone Output
We switched to using Next.js **Standalone Output**, which automatically traces dependencies and creates a minimal production build. This reduced the package size to **~190MB**.

### Key Configurations

1.  **Enable Standalone Mode:**
    Ensure `apps/web/next.config.js` includes:
    ```javascript
    module.exports = {
      output: 'standalone',
      // ... other config
    }
    ```

2.  **Optimized Build Script (`azure/appservice/fast-build-web.sh`):**
    Instead of zipping the entire project, the script now:
    *   Copies `.next/standalone` (minimal server & dependencies).
    *   Copies `.next/static` to `.next/standalone/apps/web/.next/static` (required for assets).
    *   Copies `public` to `.next/standalone/apps/web/public`.
    *   Zips *only* this optimized structure.

3.  **Build-Time Environment Variables:**
    The Web App requires the API URL at **build time** to bake it into the client-side code.
    ```bash
    export NEXT_PUBLIC_API_URL=https://okr-nexus-api-gateway.azurewebsites.net
    ./azure/appservice/fast-build-web.sh
    ```

4.  **Deployment Timeout:**
    We increased the deployment timeout in `azure/appservice/deploy-web.sh` to handle slower network conditions:
    ```bash
    az webapp deploy ... --timeout 1800
    ```

## 2. API Gateway Deployment (Backend)

### The Problem
The Web App could not communicate with the backend due to **CORS (Cross-Origin Resource Sharing)** errors. The browser blocked requests because the API Gateway did not return the `Access-Control-Allow-Origin` header.

### The Solution: Explicit CORS Configuration
We configured both the Azure environment and the Express application to correctly handle CORS.

### Key Configurations

1.  **Azure App Settings:**
    The `deploy-backend.sh` script now sets the `CORS_ORIGINS` environment variable:
    ```bash
    CORS_ORIGINS="https://okr-nexus-web.azurewebsites.net,http://localhost:3000,http://localhost:5173"
    ```

2.  **Express Application (`services/api-gateway/src/index.ts`):**
    We explicitly enabled preflight (`OPTIONS`) request handling:
    ```typescript
    app.use(cors({
      origin: process.env.CORS_ORIGINS?.split(',') || '*',
      credentials: true,
    }));
    // CRITICAL: Explicitly handle preflight requests
    app.options('*', cors());
    ```

3.  **Targeted Build:**
    To avoid build failures in other services blocking the Gateway deployment, we used a targeted build approach (e.g., `build-gateway.sh`) that builds and packages *only* the API Gateway.

## 3. Summary of Commands

### Deploying Web App
```bash
# 1. Set API URL
export NEXT_PUBLIC_API_URL=https://okr-nexus-api-gateway.azurewebsites.net

# 2. Build (Fast & Optimized)
./azure/appservice/fast-build-web.sh

# 3. Deploy
./azure/appservice/deploy-web.sh
```

### Deploying API Gateway
```bash
# 1. Build Gateway Only
./azure/appservice/build-gateway.sh

# 2. Deploy Gateway (updates CORS settings)
./azure/appservice/deploy-backend.sh api-gateway
```
