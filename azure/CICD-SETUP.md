# GitHub Actions CI/CD Setup for Azure Container Apps

This guide explains how to set up automatic deployments from GitHub to Azure Container Apps.

## Prerequisites

- Azure subscription with Owner or User Access Administrator permissions
- GitHub repository
- Azure CLI installed

## Step 1: Create Azure Service Principal (Run as Admin)

An Azure admin needs to run these commands:

```bash
# Variables - update these for your environment
APP_ID="f983c050-7bc9-4ac1-80d8-70db97dc59cc"  # Already created
SUBSCRIPTION_ID="fe1dd2af-c453-4604-a4da-f3dce8bce8b7"
RESOURCE_GROUP="vibe-code-test"
ACR_NAME="okrnexusregistry"

# 1. Assign Contributor role to the resource group
az role assignment create \
  --assignee $APP_ID \
  --role Contributor \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP"

# 2. Assign AcrPush role to allow pushing images
az role assignment create \
  --assignee $APP_ID \
  --role AcrPush \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.ContainerRegistry/registries/$ACR_NAME"
```

## Step 2: Configure Federated Credentials for GitHub

This allows GitHub Actions to authenticate without storing secrets:

```bash
# Variables
APP_OBJECT_ID="14580bfc-cdfd-4fbb-84f1-575eb74dd119"  # Already created
GITHUB_ORG="matthugh1"
GITHUB_REPO="MHOKR"

# Create federated credential for the main branch
az ad app federated-credential create \
  --id $APP_OBJECT_ID \
  --parameters '{
    "name": "github-main-branch",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'"$GITHUB_ORG/$GITHUB_REPO"':ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# Create federated credential for pull requests (optional, for PR previews)
az ad app federated-credential create \
  --id $APP_OBJECT_ID \
  --parameters '{
    "name": "github-pull-requests",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:'"$GITHUB_ORG/$GITHUB_REPO"':pull_request",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

## Step 3: Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `AZURE_CLIENT_ID` | `f983c050-7bc9-4ac1-80d8-70db97dc59cc` |
| `AZURE_TENANT_ID` | `fdcbe2ec-051b-4e80-bf9a-500333205742` |
| `AZURE_SUBSCRIPTION_ID` | `fe1dd2af-c453-4604-a4da-f3dce8bce8b7` |

## Step 4: Push to Trigger Deployment

Once configured, push to the `main` branch to trigger a deployment:

```bash
git add .
git commit -m "Configure CI/CD"
git push origin main
```

## Manual Deployment Trigger

You can also trigger deployments manually:
1. Go to your GitHub repo → Actions tab
2. Select "Deploy to Azure Container Apps" workflow
3. Click "Run workflow"

## How It Works

The workflow (`.github/workflows/azure-deploy.yml`):

1. **Triggers on:**
   - Push to `main` branch (when services/, apps/, packages/, or azure/ changes)
   - Manual workflow dispatch

2. **Builds:**
   - All Docker images with proper platform targeting (linux/amd64)
   - Uses GitHub Actions cache for faster builds
   - Tags images with both commit SHA and `latest`

3. **Deploys:**
   - Updates each Azure Container App with the new image
   - Automatically gets API Gateway URL for web app configuration
   - Outputs deployment URLs in job summary

## Troubleshooting

### Authentication Failed
- Verify the federated credentials match your GitHub org/repo exactly
- Check that role assignments were created successfully

### Build Failures
- Check Docker build logs in GitHub Actions
- Verify Dockerfiles exist at expected paths

### Deployment Failures
- Verify Container Apps exist in Azure
- Check Azure Container Apps logs: `az containerapp logs show --name <app-name> --resource-group vibe-code-test`

## Alternative: Using Service Principal Client Secret

If OIDC federated credentials aren't working, you can use a client secret instead:

```bash
# Create a client secret
az ad app credential reset --id f983c050-7bc9-4ac1-80d8-70db97dc59cc --append
```

Then update the workflow to use `creds` instead of OIDC:

```yaml
- name: Log in to Azure
  uses: azure/login@v2
  with:
    creds: ${{ secrets.AZURE_CREDENTIALS }}
```

And add `AZURE_CREDENTIALS` secret with the JSON output from the credential reset command.

