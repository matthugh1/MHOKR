#!/bin/bash
# Deploy backend services to Azure App Service

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.env"

BUILD_DIR="$SCRIPT_DIR/build"
APP_SERVICE_PLAN_NAME="${APP_SERVICE_PLAN_NAME:-${APP_NAME_PREFIX}-plan}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Service configurations
declare -A SERVICES
SERVICES[core-api]="3001|node dist/main.js"
SERVICES[ai-service]="3002|node dist/main.js"
SERVICES[integration-service]="3003|node dist/main.js"
SERVICES[api-gateway]="3000|node dist/index.js"

# Function to deploy a service
deploy_service() {
    local SERVICE_NAME=$1
    local CONFIG="${SERVICES[$SERVICE_NAME]}"
    local PORT=$(echo "$CONFIG" | cut -d'|' -f1)
    local STARTUP_CMD=$(echo "$CONFIG" | cut -d'|' -f2)
    local APP_NAME="${APP_NAME_PREFIX}-${SERVICE_NAME}"
    local ZIP_FILE="$BUILD_DIR/${SERVICE_NAME}.zip"
    
    echo -e "\n${YELLOW}Deploying $SERVICE_NAME...${NC}"
    
    if [ ! -f "$ZIP_FILE" ]; then
        echo -e "${RED}Error: Build artifact not found: $ZIP_FILE${NC}"
        echo -e "${YELLOW}Run build-services.sh first${NC}"
        return 1
    fi
    
    # Create web app if it doesn't exist
    if ! az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
        echo "  Creating web app: $APP_NAME"
        az webapp create \
            --name "$APP_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --plan "$APP_SERVICE_PLAN_NAME" \
            --runtime "NODE:20-lts"
    else
        echo "  Web app exists: $APP_NAME"
    fi
    
    # Configure app settings
    echo "  Configuring app settings..."
    az webapp config appsettings set \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --settings \
            WEBSITES_PORT="$PORT" \
            NODE_ENV="production" \
            SCM_DO_BUILD_DURING_DEPLOYMENT="false" \
        --output none
    
    # Set startup command
    echo "  Setting startup command..."
    az webapp config set \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --startup-file "$STARTUP_CMD" \
        --output none
    
    # Enable logging
    az webapp log config \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --application-logging filesystem \
        --detailed-error-messages true \
        --failed-request-tracing true \
        --web-server-logging filesystem \
        --output none
    
    # Deploy ZIP package
    echo "  Deploying application..."
    az webapp deploy \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --src-path "$ZIP_FILE" \
        --type zip \
        --async false
    
    # Get URL
    local URL=$(az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostName -o tsv)
    echo -e "${GREEN}  ✓ Deployed: https://${URL}${NC}"
}

# Check if specific service was requested
if [ -n "$1" ]; then
    if [ -z "${SERVICES[$1]}" ]; then
        echo -e "${RED}Unknown service: $1${NC}"
        echo "Available services: ${!SERVICES[*]}"
        exit 1
    fi
    deploy_service "$1"
else
    # Deploy all backend services
    echo -e "${YELLOW}Deploying all backend services...${NC}"
    
    for SERVICE in core-api ai-service integration-service api-gateway; do
        deploy_service "$SERVICE"
    done
fi

echo -e "\n${GREEN}Backend deployment complete!${NC}"



