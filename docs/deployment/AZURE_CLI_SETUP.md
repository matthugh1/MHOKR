# Azure CLI Setup Guide

This guide walks you through setting up Azure CLI for deploying the OKR Framework application.

## Quick Setup (Recommended)

Run the automated setup script:

```bash
cd azure
./setup-azure-cli.sh
```

This script will:
- Check if Azure CLI is installed
- Guide you through Azure login
- Verify resource group access
- Install required Azure CLI extensions
- Check Docker installation

## Manual Setup

### Step 1: Install Azure CLI

#### macOS
```bash
brew install azure-cli
```

#### Linux (Debian/Ubuntu)
```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

#### Linux (RHEL/CentOS)
```bash
sudo rpm --import https://packages.microsoft.com/keys/microsoft.asc
sudo sh -c 'echo -e "[azure-cli]\nname=Azure CLI\nbaseurl=https://packages.microsoft.com/yumrepos/azure-cli\nenabled=1\ngpgcheck=1\ngpgkey=https://packages.microsoft.com/keys/microsoft.asc" > /etc/yum.repos.d/azure-cli.repo'
sudo yum install azure-cli
```

#### Windows
Download and run the installer from: https://aka.ms/installazurecliwindows

#### Verify Installation
```bash
az --version
```

### Step 2: Login to Azure

#### Interactive Login (Recommended)
```bash
az login
```

This will open a browser window for authentication. After logging in, you'll see your subscriptions listed.

#### Login with Service Principal (for CI/CD)
```bash
az login --service-principal \
  --username <app-id> \
  --password <password> \
  --tenant <tenant-id>
```

### Step 3: Set Default Subscription

If you have multiple subscriptions, set the default:

```bash
# List all subscriptions
az account list --output table

# Set default subscription by ID
az account set --subscription "<subscription-id>"

# Or set by name
az account set --subscription "<subscription-name>"

# Verify
az account show
```

### Step 4: Verify Resource Group Access

```bash
# Check if resource group exists
az group show --name vibe-code-test

# If it doesn't exist, create it
az group create --name vibe-code-test --location eastus
```

### Step 5: Install Required Extensions

Container Apps requires a specific Azure CLI extension:

```bash
# Install Container Apps extension
az extension add --name containerapp --upgrade

# Verify installation
az extension list
```

### Step 6: Verify Docker Installation

Docker is required for building and pushing images:

```bash
# Check if Docker is installed
docker --version

# Check if Docker is running
docker ps
```

If Docker is not installed:
- **macOS/Windows**: Install [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Linux**: Follow [Docker installation guide](https://docs.docker.com/engine/install/)

## Service Principal Setup (Optional, for CI/CD)

For automated deployments (GitHub Actions, Azure DevOps), create a service principal:

```bash
# Create service principal with contributor role for the resource group
az ad sp create-for-rbac \
  --name okr-nexus-deploy \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/vibe-code-test

# Output will include:
# {
#   "appId": "...",
#   "displayName": "okr-nexus-deploy",
#   "password": "...",
#   "tenant": "..."
# }
```

**Important**: Save the output securely. You'll need:
- `appId` → `AZURE_CLIENT_ID`
- `password` → `AZURE_CLIENT_SECRET`
- `tenant` → `AZURE_TENANT_ID`
- Subscription ID → `AZURE_SUBSCRIPTION_ID`

## Verification Checklist

Run these commands to verify your setup:

```bash
# 1. Azure CLI installed
az --version

# 2. Logged in
az account show

# 3. Resource group accessible
az group show --name vibe-code-test

# 4. Container Apps extension installed
az extension show --name containerapp

# 5. Docker running
docker ps
```

All commands should succeed without errors.

## Troubleshooting

### "az: command not found"

**Problem**: Azure CLI is not installed or not in PATH.

**Solution**:
1. Install Azure CLI (see Step 1)
2. Restart your terminal
3. Verify: `az --version`

### "Please run 'az login' to setup account"

**Problem**: Not logged in to Azure.

**Solution**:
```bash
az login
```

### "Resource group 'vibe-code-test' could not be found"

**Problem**: Resource group doesn't exist or you don't have access.

**Solution**:
```bash
# Create the resource group
az group create --name vibe-code-test --location eastus

# Or verify you have access to existing resource groups
az group list
```

### "Extension 'containerapp' not found"

**Problem**: Container Apps extension not installed.

**Solution**:
```bash
az extension add --name containerapp --upgrade
```

### "Cannot connect to the Docker daemon"

**Problem**: Docker is not running.

**Solution**:
- **macOS/Windows**: Start Docker Desktop
- **Linux**: Start Docker service:
  ```bash
  sudo systemctl start docker
  sudo systemctl enable docker
  ```

### "Insufficient privileges to complete the operation"

**Problem**: Your account doesn't have required permissions.

**Solution**:
1. Verify you have Contributor or Owner role on the subscription/resource group
2. Contact your Azure administrator to grant permissions
3. Check permissions:
   ```bash
   az role assignment list --assignee $(az account show --query user.name -o tsv) --scope /subscriptions/$(az account show --query id -o tsv)
   ```

### Multiple Subscriptions

**Problem**: You have multiple subscriptions and want to use a specific one.

**Solution**:
```bash
# List subscriptions
az account list --output table

# Set default
az account set --subscription "<subscription-id-or-name>"

# Verify
az account show
```

## Next Steps

After completing the setup:

1. **Configure environment variables**:
   ```bash
   cd azure
   ./migrate-env.sh  # or manually copy .env.example to .env
   ```

2. **Review deployment documentation**: See [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md)

3. **Run deployment**:
   ```bash
   ./deploy.sh
   ```

## Additional Resources

- [Azure CLI Documentation](https://docs.microsoft.com/cli/azure/)
- [Azure Container Apps Documentation](https://docs.microsoft.com/azure/container-apps/)
- [Azure CLI Container Apps Reference](https://docs.microsoft.com/cli/azure/containerapp)
- [Docker Documentation](https://docs.docker.com/)


