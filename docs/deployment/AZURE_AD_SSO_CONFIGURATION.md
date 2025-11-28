# Azure AD SSO Configuration Guide

This guide explains how to configure Azure AD Single Sign-On (SSO) for your OKR Framework application.

## Overview

The application uses Azure AD OIDC authentication via Passport.js. When users click "Sign in with Microsoft" on the login page, they are redirected to Azure AD for authentication, then redirected back to your application with a token.

## Prerequisites

1. An Azure AD tenant
2. Admin access to Azure Portal
3. Your application deployed (or running locally)

## Step 1: Register Application in Azure AD

1. **Navigate to Azure Portal**
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to **Azure Active Directory** → **App registrations**

2. **Create New App Registration**
   - Click **+ New registration**
   - **Name**: `OKR Nexus` (or your preferred name)
   - **Supported account types**: 
     - Choose **Single tenant** if only your organization will use it
     - Choose **Multitenant** if multiple organizations will use it
   - **Redirect URI**: 
     - Platform: **Web**
     - URL: `https://your-api-domain.com/auth/azure/callback`
     - For local development: `http://localhost:3001/auth/azure/callback`
   - Click **Register**

3. **Configure Authentication**
   - In your app registration, go to **Authentication**
   - Under **Redirect URIs**, add:
     - Production: `https://your-api-domain.com/auth/azure/callback`
     - Development: `http://localhost:3001/auth/azure/callback`
   - Under **Implicit grant and hybrid flows**, enable:
     - ✅ ID tokens (used for sign-in)
   - Click **Save**

4. **Create Client Secret**
   - Go to **Certificates & secrets**
   - Click **+ New client secret**
   - **Description**: `OKR Nexus Secret`
   - **Expires**: Choose expiration (recommend 12-24 months)
   - Click **Add**
   - **IMPORTANT**: Copy the secret value immediately (you won't be able to see it again)
   - Save it securely

5. **Configure API Permissions**
   - Go to **API permissions**
   - Click **+ Add a permission**
   - Select **Microsoft Graph**
   - Select **Delegated permissions**
   - Add the following permissions:
     - `email`
     - `profile`
     - `openid`
   - Click **Add permissions**
   - Click **Grant admin consent** (if you're an admin)

6. **Get Required Values**
   - **Application (client) ID**: Found on the **Overview** page
   - **Directory (tenant) ID**: Found on the **Overview** page
   - **Client secret**: The value you copied from step 4

## Step 2: Configure Backend Environment Variables

Add the following environment variables to your **Core API** service:

### For Local Development (`services/core-api/.env`)

```bash
# Azure AD SSO Configuration
AZURE_TENANT_ID=your-tenant-id-here
AZURE_CLIENT_ID=your-client-id-here
AZURE_CLIENT_SECRET=your-client-secret-here
AZURE_REDIRECT_URL=http://localhost:3001/auth/azure/callback

# Frontend URL (for redirect after authentication)
FRONTEND_URL=http://localhost:3000
```

### For Azure App Service

Set these as **Application Settings** in Azure Portal:

1. Navigate to your App Service (Core API)
2. Go to **Configuration** → **Application settings**
3. Add the following settings:

| Setting Name | Value | Example |
|-------------|-------|---------|
| `AZURE_TENANT_ID` | Your Azure AD tenant ID | `fdcbe2ec-051b-4e80-bf9a-500333205742` |
| `AZURE_CLIENT_ID` | Your app registration client ID | `f983c050-7bc9-4ac1-80d8-70db97dc59cc` |
| `AZURE_CLIENT_SECRET` | Your client secret value | `abc123...` |
| `AZURE_REDIRECT_URL` | Your callback URL | `https://your-api-domain.com/auth/azure/callback` |
| `FRONTEND_URL` | Your frontend URL | `https://your-frontend-domain.com` |

### Using Azure CLI

```bash
az webapp config appsettings set \
  --resource-group your-resource-group \
  --name your-core-api-app-name \
  --settings \
    AZURE_TENANT_ID="your-tenant-id" \
    AZURE_CLIENT_ID="your-client-id" \
    AZURE_CLIENT_SECRET="your-client-secret" \
    AZURE_REDIRECT_URL="https://your-api-domain.com/auth/azure/callback" \
    FRONTEND_URL="https://your-frontend-domain.com"
```

## Step 3: Configure Frontend

The frontend is already configured! The login page (`apps/web/src/app/login/page.tsx`) includes a "Sign in with Microsoft" button that redirects to `/auth/azure`.

### Frontend Environment Variables

Ensure your frontend has the correct API URL:

**For Local Development** (`apps/web/.env.local`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**For Production** (`apps/web/.env.production` or Azure App Settings):
```bash
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

## Step 4: Verify Configuration

### Test Locally

1. **Start your services**:
   ```bash
   # Start Core API
   cd services/core-api
   npm run start:dev
   
   # Start Frontend (in another terminal)
   cd apps/web
   npm run dev
   ```

2. **Test the flow**:
   - Navigate to `http://localhost:3000/login` (or your frontend URL)
   - Click "Sign in with Microsoft"
   - You should be redirected to Azure AD login
   - After successful login, you should be redirected back to your app

### Test in Production

1. Ensure all environment variables are set in Azure App Service
2. Navigate to your production login page
3. Click "Sign in with Microsoft"
4. Verify the redirect flow works

## Step 5: User Provisioning

The application supports **Just-In-Time (JIT) user provisioning**:

- If a user logs in with Azure AD and doesn't exist in your database, a new user account is automatically created
- The user is linked to Azure AD via the `azureAdId` field
- If a user exists with the same email but no Azure AD link, the account is automatically linked

### Important Notes

1. **User Organization Assignment**: New users created via Azure AD SSO will need to be assigned to an organization and workspace. You may need to:
   - Manually assign users after first login
   - Implement automatic assignment based on Azure AD groups (future enhancement)
   - Use a superuser to assign users

2. **Role Assignment**: Users created via Azure AD SSO will have default roles. You may need to assign appropriate RBAC roles after first login.

## Troubleshooting

### Common Issues

1. **"Invalid redirect URI" error**
   - Ensure the redirect URI in Azure AD matches exactly what's configured in `AZURE_REDIRECT_URL`
   - Check for trailing slashes, http vs https, etc.

2. **"AADSTS50011: The reply URL specified in the request does not match"**
   - Verify the redirect URI in Azure AD app registration matches your `AZURE_REDIRECT_URL`
   - Ensure you've saved the changes in Azure Portal

3. **"Invalid client secret"**
   - Verify `AZURE_CLIENT_SECRET` is set correctly
   - Check if the secret has expired (create a new one if needed)

4. **Users can't log in after Azure AD authentication**
   - Check that users are being created in the database
   - Verify the `azureAdId` field is being populated
   - Check application logs for errors

5. **Redirect loop**
   - Verify `FRONTEND_URL` is set correctly
   - Check that the callback page (`/auth/callback`) exists and is accessible

### Debug Mode

To enable debug logging for Azure AD authentication, check the `loggingLevel` in `services/core-api/src/modules/auth/strategies/azure-ad.strategy.ts` (currently set to `'info'`).

## Security Considerations

1. **Client Secret**: Never commit client secrets to version control. Use environment variables or Azure Key Vault.

2. **HTTPS**: In production, always use HTTPS. The strategy currently allows HTTP for redirect URLs (`allowHttpForRedirectUrl: true`) - **this should be set to `false` in production**.

3. **Token Validation**: The application validates Azure AD tokens before creating user sessions.

4. **Multi-Tenant**: If you're using multi-tenant Azure AD, ensure `validateIssuer` is configured appropriately.

## Next Steps

- [ ] Configure Azure AD app registration
- [ ] Set environment variables in Core API
- [ ] Test authentication flow
- [ ] Set up user provisioning workflow
- [ ] Configure role assignment for Azure AD users
- [ ] Update `allowHttpForRedirectUrl` to `false` for production

## Related Files

- Backend Strategy: `services/core-api/src/modules/auth/strategies/azure-ad.strategy.ts`
- Auth Controller: `services/core-api/src/modules/auth/auth.controller.ts`
- Auth Service: `services/core-api/src/modules/auth/auth.service.ts`
- Login Page: `apps/web/src/app/login/page.tsx`
- Callback Page: `apps/web/src/app/auth/callback/page.tsx`

