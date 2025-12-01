#!/bin/bash
# Create Azure App Service Plan

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.env"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_SERVICE_PLAN_NAME="${APP_SERVICE_PLAN_NAME:-${APP_NAME_PREFIX}-plan}"
APP_SERVICE_SKU="${APP_SERVICE_SKU:-B1}"

echo -e "${YELLOW}Creating App Service Plan: $APP_SERVICE_PLAN_NAME (SKU: $APP_SERVICE_SKU)${NC}"

# Check if plan exists
if az appservice plan show --name "$APP_SERVICE_PLAN_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    echo -e "${GREEN}✓ App Service Plan already exists${NC}"
else
    az appservice plan create \
        --name "$APP_SERVICE_PLAN_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --sku "$APP_SERVICE_SKU" \
        --is-linux
    
    echo -e "${GREEN}✓ App Service Plan created${NC}"
fi

# Show plan info
echo -e "${YELLOW}Plan Details:${NC}"
az appservice plan show \
    --name "$APP_SERVICE_PLAN_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "{Name:name, SKU:sku.name, Workers:sku.capacity, Status:status}" \
    -o table




