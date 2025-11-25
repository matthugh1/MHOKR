#!/bin/bash
# Azure CLI Setup and Verification Script
# This script helps you set up Azure CLI for deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Azure CLI Setup and Verification                ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}\n"

# Check if Azure CLI is installed
echo -e "${YELLOW}Step 1: Checking Azure CLI installation...${NC}"
if command -v az &> /dev/null; then
    AZ_VERSION=$(az --version | head -n 1)
    echo -e "${GREEN}✓ Azure CLI is installed: $AZ_VERSION${NC}"
else
    echo -e "${RED}✗ Azure CLI is not installed${NC}"
    echo -e "\n${YELLOW}Please install Azure CLI:${NC}"
    echo -e "${BLUE}macOS:${NC} brew install azure-cli"
    echo -e "${BLUE}Linux:${NC} curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
    echo -e "${BLUE}Windows:${NC} Download from https://aka.ms/installazurecliwindows"
    echo -e "\nAfter installation, run this script again."
    exit 1
fi

# Check if logged in
echo -e "\n${YELLOW}Step 2: Checking Azure login status...${NC}"
if az account show &>/dev/null; then
    CURRENT_ACCOUNT=$(az account show --query "{Name:name, SubscriptionId:id}" -o tsv)
    SUBSCRIPTION_NAME=$(echo "$CURRENT_ACCOUNT" | cut -f1)
    SUBSCRIPTION_ID=$(echo "$CURRENT_ACCOUNT" | cut -f2)
    echo -e "${GREEN}✓ Logged in to Azure${NC}"
    echo -e "  Account: ${GREEN}$SUBSCRIPTION_NAME${NC}"
    echo -e "  Subscription ID: ${GREEN}$SUBSCRIPTION_ID${NC}"
else
    echo -e "${YELLOW}Not logged in. Please log in...${NC}"
    echo -e "\n${BLUE}Opening browser for Azure login...${NC}"
    az login
    echo -e "\n${GREEN}Login successful!${NC}"
fi

# List available subscriptions
echo -e "\n${YELLOW}Step 3: Available subscriptions:${NC}"
az account list --output table

# Try to find subscription that has access to vibe-code-test resource group
echo -e "\n${YELLOW}Step 4: Finding subscription with access to 'vibe-code-test' resource group...${NC}"
RESOURCE_GROUP="vibe-code-test"

# Try each subscription to find one with access to the resource group
FOUND_SUBSCRIPTION=""
for SUB_ID in $(az account list --query "[].id" -o tsv); do
    az account set --subscription "$SUB_ID" &>/dev/null
    if az group show --name "$RESOURCE_GROUP" &>/dev/null; then
        FOUND_SUBSCRIPTION="$SUB_ID"
        SUB_NAME=$(az account show --query name -o tsv)
        echo -e "${GREEN}✓ Found subscription with access: $SUB_NAME${NC}"
        echo -e "  Subscription ID: ${GREEN}$SUB_ID${NC}"
        break
    fi
done

if [ -n "$FOUND_SUBSCRIPTION" ]; then
    az account set --subscription "$FOUND_SUBSCRIPTION"
    echo -e "${GREEN}✓ Set as default subscription${NC}"
else
    echo -e "${YELLOW}Could not find subscription with access to '$RESOURCE_GROUP' resource group.${NC}"
    echo -e "${YELLOW}Please select a subscription manually:${NC}"
    az account list --output table
    read -p "Enter subscription ID or name: " SUBSCRIPTION_INPUT
    if [[ "$SUBSCRIPTION_INPUT" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
        # It's a subscription ID
        az account set --subscription "$SUBSCRIPTION_INPUT"
        echo -e "${GREEN}✓ Set subscription: $SUBSCRIPTION_INPUT${NC}"
    else
        # Try to find by name
        SUBSCRIPTION_ID=$(az account list --query "[?name=='$SUBSCRIPTION_INPUT'].id" -o tsv | head -n 1)
        if [ -n "$SUBSCRIPTION_ID" ]; then
            az account set --subscription "$SUBSCRIPTION_ID"
            echo -e "${GREEN}✓ Set subscription: $SUBSCRIPTION_INPUT${NC}"
        else
            echo -e "${RED}✗ Subscription not found: $SUBSCRIPTION_INPUT${NC}"
        fi
    fi
fi

# Verify resource group access
echo -e "\n${YELLOW}Step 5: Verifying resource group access...${NC}"

if az group show --name "$RESOURCE_GROUP" &>/dev/null; then
    RG_LOCATION=$(az group show --name "$RESOURCE_GROUP" --query location -o tsv)
    echo -e "${GREEN}✓ Resource group exists: $RESOURCE_GROUP${NC}"
    echo -e "  Location: ${GREEN}$RG_LOCATION${NC}"
else
    echo -e "${YELLOW}Resource group '$RESOURCE_GROUP' does not exist.${NC}"
    read -p "Do you want to create it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter Azure region (e.g., eastus, westus2): " LOCATION
        if [ -z "$LOCATION" ]; then
            LOCATION="eastus"
        fi
        az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
        echo -e "${GREEN}✓ Created resource group: $RESOURCE_GROUP in $LOCATION${NC}"
    else
        echo -e "${YELLOW}Resource group will be created during deployment.${NC}"
    fi
fi

# Check required Azure CLI extensions
echo -e "\n${YELLOW}Step 6: Checking required Azure CLI extensions...${NC}"

# Container Apps extension
if az extension show --name containerapp &>/dev/null; then
    echo -e "${GREEN}✓ Container Apps extension is installed${NC}"
else
    echo -e "${YELLOW}Installing Container Apps extension...${NC}"
    az extension add --name containerapp --upgrade
    echo -e "${GREEN}✓ Container Apps extension installed${NC}"
fi

# Check Docker
echo -e "\n${YELLOW}Step 7: Checking Docker installation...${NC}"
if command -v docker &> /dev/null; then
    if docker ps &>/dev/null; then
        DOCKER_VERSION=$(docker --version)
        echo -e "${GREEN}✓ Docker is installed and running: $DOCKER_VERSION${NC}"
    else
        echo -e "${RED}✗ Docker is installed but not running${NC}"
        echo -e "${YELLOW}Please start Docker Desktop and run this script again.${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo -e "${YELLOW}Please install Docker Desktop:${NC}"
    echo -e "${BLUE}https://www.docker.com/products/docker-desktop${NC}"
    exit 1
fi

# Summary
# Get final subscription info
FINAL_SUB=$(az account show --query "{Name:name, Id:id}" -o tsv)
FINAL_SUB_NAME=$(echo "$FINAL_SUB" | cut -f1)
FINAL_SUB_ID=$(echo "$FINAL_SUB" | cut -f2)

echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Setup Complete!                              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${GREEN}✓ Azure CLI: Installed and configured${NC}"
echo -e "${GREEN}✓ Azure Login: Authenticated${NC}"
echo -e "${GREEN}✓ Subscription: $FINAL_SUB_NAME${NC}"
echo -e "${GREEN}  Subscription ID: $FINAL_SUB_ID${NC}"
echo -e "${GREEN}✓ Resource Group: $RESOURCE_GROUP${NC}"
echo -e "${GREEN}✓ Docker: Ready${NC}\n"

# Update .env.example with subscription ID if .env doesn't exist
if [ ! -f "$SCRIPT_DIR/.env" ] && [ -f "$SCRIPT_DIR/.env.example" ]; then
    echo -e "${YELLOW}Tip: Update azure/.env.example with your subscription ID:${NC}"
    echo -e "${BLUE}SUBSCRIPTION_ID=$FINAL_SUB_ID${NC}\n"
fi

echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Configure environment variables: ${BLUE}cd azure && cp .env.example .env${NC}"
echo -e "2. Edit ${BLUE}azure/.env${NC} with your values"
echo -e "3. Run deployment: ${BLUE}./deploy.sh${NC}\n"

echo -e "${BLUE}For CI/CD setup, you may also want to create a service principal:${NC}"
echo -e "${YELLOW}az ad sp create-for-rbac --name okr-nexus-deploy --role contributor --scopes /subscriptions/\$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP${NC}\n"

