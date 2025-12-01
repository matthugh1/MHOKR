#!/bin/bash
# Azure Infrastructure Provisioning Script
# Creates Azure Container Registry, Key Vault, and Container Apps Environment

set -e

# Load environment variables
if [ ! -f .env ]; then
    echo "Error: .env file not found. Please copy .env.example to .env and configure it."
    exit 1
fi

source .env

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Azure Infrastructure Provisioning ===${NC}"

# Check if logged in to Azure
echo -e "${YELLOW}Checking Azure CLI login status...${NC}"
if ! az account show &>/dev/null; then
    echo -e "${RED}Not logged in to Azure. Please run: az login${NC}"
    exit 1
fi

# Set subscription if provided
if [ -n "$SUBSCRIPTION_ID" ]; then
    echo -e "${YELLOW}Setting subscription to $SUBSCRIPTION_ID...${NC}"
    az account set --subscription "$SUBSCRIPTION_ID"
fi

# Get current subscription
CURRENT_SUB=$(az account show --query id -o tsv)
echo -e "${GREEN}Current subscription: $CURRENT_SUB${NC}"

# Verify resource group exists
echo -e "${YELLOW}Verifying resource group: $RESOURCE_GROUP...${NC}"
if ! az group show --name "$RESOURCE_GROUP" &>/dev/null; then
    echo -e "${YELLOW}Resource group not found. Creating...${NC}"
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
    echo -e "${GREEN}Resource group created.${NC}"
else
    echo -e "${GREEN}Resource group exists.${NC}"
fi

# Create Azure Container Registry
echo -e "${YELLOW}Creating Azure Container Registry: $ACR_NAME...${NC}"
if az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    echo -e "${GREEN}ACR already exists.${NC}"
else
    az acr create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$ACR_NAME" \
        --sku "$ACR_SKU" \
        --admin-enabled true
    echo -e "${GREEN}ACR created successfully.${NC}"
fi

# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query loginServer -o tsv)
echo -e "${GREEN}ACR Login Server: $ACR_LOGIN_SERVER${NC}"

# Create Log Analytics Workspace for Container Apps
echo -e "${YELLOW}Creating Log Analytics Workspace: $LOG_ANALYTICS_WORKSPACE_NAME...${NC}"
LOG_ANALYTICS_WORKSPACE_ID=$(az monitor log-analytics workspace show \
    --resource-group "$RESOURCE_GROUP" \
    --workspace-name "$LOG_ANALYTICS_WORKSPACE_NAME" \
    --query customerId -o tsv 2>/dev/null || az monitor log-analytics workspace create \
    --resource-group "$RESOURCE_GROUP" \
    --workspace-name "$LOG_ANALYTICS_WORKSPACE_NAME" \
    --location "$LOCATION" \
    --query customerId -o tsv)

LOG_ANALYTICS_SHARED_KEY=$(az monitor log-analytics workspace get-shared-keys \
    --resource-group "$RESOURCE_GROUP" \
    --workspace-name "$LOG_ANALYTICS_WORKSPACE_NAME" \
    --query primarySharedKey -o tsv)

echo -e "${GREEN}Log Analytics Workspace ID: $LOG_ANALYTICS_WORKSPACE_ID${NC}"

# Create Container Apps Environment
echo -e "${YELLOW}Creating Container Apps Environment: $CONTAINER_APPS_ENV_NAME...${NC}"
if az containerapp env show --name "$CONTAINER_APPS_ENV_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    echo -e "${GREEN}Container Apps Environment already exists.${NC}"
else
    az containerapp env create \
        --name "$CONTAINER_APPS_ENV_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --logs-workspace-id "$LOG_ANALYTICS_WORKSPACE_ID" \
        --logs-workspace-key "$LOG_ANALYTICS_SHARED_KEY"
    echo -e "${GREEN}Container Apps Environment created successfully.${NC}"
fi

# Create Key Vault (optional)
if [ -n "$KEY_VAULT_NAME" ]; then
    echo -e "${YELLOW}Creating Key Vault: $KEY_VAULT_NAME...${NC}"
    if az keyvault show --name "$KEY_VAULT_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
        echo -e "${GREEN}Key Vault already exists.${NC}"
    else
        az keyvault create \
            --name "$KEY_VAULT_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$LOCATION"
        echo -e "${GREEN}Key Vault created successfully.${NC}"
        
        # Store secrets in Key Vault
        echo -e "${YELLOW}Storing secrets in Key Vault...${NC}"
        az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "postgres-password" --value "$POSTGRES_PASSWORD" &>/dev/null || true
        az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "jwt-secret" --value "$JWT_SECRET" &>/dev/null || true
        az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "keycloak-admin-password" --value "$KEYCLOAK_ADMIN_PASSWORD" &>/dev/null || true
        az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "nextauth-secret" --value "$NEXTAUTH_SECRET" &>/dev/null || true
        
        if [ -n "$OPENAI_API_KEY" ]; then
            az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "openai-api-key" --value "$OPENAI_API_KEY" &>/dev/null || true
        fi
        
        if [ -n "$ANTHROPIC_API_KEY" ]; then
            az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "anthropic-api-key" --value "$ANTHROPIC_API_KEY" &>/dev/null || true
        fi
        
        echo -e "${GREEN}Secrets stored in Key Vault.${NC}"
    fi
fi

# Output summary
echo -e "\n${GREEN}=== Infrastructure Summary ===${NC}"
echo -e "Resource Group: ${GREEN}$RESOURCE_GROUP${NC}"
echo -e "ACR Name: ${GREEN}$ACR_NAME${NC}"
echo -e "ACR Login Server: ${GREEN}$ACR_LOGIN_SERVER${NC}"
echo -e "Container Apps Environment: ${GREEN}$CONTAINER_APPS_ENV_NAME${NC}"
if [ -n "$KEY_VAULT_NAME" ]; then
    echo -e "Key Vault: ${GREEN}$KEY_VAULT_NAME${NC}"
fi
echo -e "\n${GREEN}Infrastructure provisioning complete!${NC}"





