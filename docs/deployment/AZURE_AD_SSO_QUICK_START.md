# Azure AD SSO Quick Start Checklist

## Quick Configuration Checklist

### 1. Azure AD App Registration (5 minutes)

- [ ] Go to [Azure Portal](https://portal.azure.com) → Azure AD → App registrations
- [ ] Create new registration:
  - Name: `OKR Nexus`
  - Redirect URI: `https://your-api-domain.com/auth/azure/callback`
- [ ] Create client secret (copy value immediately!)
- [ ] Add API permissions: `email`, `profile`, `openid`
- [ ] Grant admin consent
- [ ] Copy these values:
  - [ ] **Tenant ID** (Directory ID)
  - [ ] **Client ID** (Application ID)
  - [ ] **Client Secret** (the value you copied)

### 2. Backend Configuration

**For Local Development** (`services/core-api/.env`):
```bash
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_REDIRECT_URL=http://localhost:3001/auth/azure/callback
FRONTEND_URL=http://localhost:3000
```

**For Azure App Service** (Application Settings):
```bash
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_REDIRECT_URL=https://your-api-domain.com/auth/azure/callback
FRONTEND_URL=https://your-frontend-domain.com
```

### 3. Frontend Configuration

**For Local Development** (`apps/web/.env.local`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**For Production**:
```bash
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

### 4. Test

1. Navigate to login page
2. Click "Sign in with Microsoft"
3. Complete Azure AD login
4. Verify redirect back to app

## Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid redirect URI" | Check redirect URI matches exactly in Azure AD |
| "Invalid client secret" | Verify secret is correct, check if expired |
| Redirect loop | Verify `FRONTEND_URL` is set correctly |
| Users can't log in | Check database for user creation, verify `azureAdId` field |

## Where to Configure

| Component | Location | File/Setting |
|-----------|----------|--------------|
| Azure AD App | Azure Portal | App registrations → Your app |
| Backend Env | Local | `services/core-api/.env` |
| Backend Env | Azure | App Service → Configuration → Application settings |
| Frontend Env | Local | `apps/web/.env.local` |
| Frontend Env | Azure | App Service → Configuration → Application settings |

## Required Environment Variables Summary

### Backend (Core API)
- `AZURE_TENANT_ID` - Azure AD tenant ID
- `AZURE_CLIENT_ID` - App registration client ID  
- `AZURE_CLIENT_SECRET` - Client secret value
- `AZURE_REDIRECT_URL` - Callback URL (must match Azure AD config)
- `FRONTEND_URL` - Frontend URL for post-auth redirect

### Frontend (Web App)
- `NEXT_PUBLIC_API_URL` - Backend API URL

## Security Notes

✅ **Automatic**: HTTP redirects are disabled in production (NODE_ENV=production)
✅ **Required**: HTTPS in production
✅ **Required**: Client secrets stored securely (never commit to git)

## Next Steps After Configuration

1. Test authentication flow
2. Set up user provisioning workflow
3. Assign users to organizations/workspaces
4. Configure RBAC roles for Azure AD users

For detailed instructions, see: [AZURE_AD_SSO_CONFIGURATION.md](./AZURE_AD_SSO_CONFIGURATION.md)




