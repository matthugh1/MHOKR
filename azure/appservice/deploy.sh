#!/bin/bash
# Main Deployment Script for Azure App Service (No Docker)
# Deploys all OKR Framework services to Azure App Service

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     Azure App Service Deployment (No Docker)                 ║"
echo "║     OKR Framework                                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Load environment variables
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo -e "${RED}Error: .env file not found.${NC}"
    echo -e "${YELLOW}Please copy .env.example to .env and configure it:${NC}"
    echo "  cp $SCRIPT_DIR/.env.example $SCRIPT_DIR/.env"
    exit 1
fi

source "$SCRIPT_DIR/.env"

# Verify Azure CLI login
echo -e "${YELLOW}Checking Azure CLI login...${NC}"
if ! az account show &>/dev/null; then
    echo -e "${RED}Not logged in to Azure. Please run: az login${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Azure CLI authenticated${NC}"

# Verify required environment variables
REQUIRED_VARS=("RESOURCE_GROUP" "LOCATION" "APP_NAME_PREFIX" "DATABASE_URL" "REDIS_URL" "JWT_SECRET" "NEXTAUTH_SECRET")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}Error: $var is not set in .env${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✓ Environment variables validated${NC}"

# Track deployment time
START_TIME=$(date +%s)

# Step 1: Create App Service Plan
echo -e "\n${CYAN}━━━ Step 1/5: Creating App Service Plan ━━━${NC}"
"$SCRIPT_DIR/create-plan.sh"

# Step 2: Build all services
echo -e "\n${CYAN}━━━ Step 2/5: Building Services ━━━${NC}"
"$SCRIPT_DIR/build-services.sh"

# Step 3: Deploy backend services
echo -e "\n${CYAN}━━━ Step 3/5: Deploying Backend Services ━━━${NC}"
"$SCRIPT_DIR/deploy-backend.sh"

# Step 4: Deploy web frontend
echo -e "\n${CYAN}━━━ Step 4/5: Deploying Web Frontend ━━━${NC}"
"$SCRIPT_DIR/deploy-web.sh"

# Step 5: Configure environment variables
echo -e "\n${CYAN}━━━ Step 5/5: Configuring Environment ━━━${NC}"
"$SCRIPT_DIR/configure-env.sh"

# Calculate deployment time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# Get deployed URLs
WEB_URL=$(az webapp show --name "${APP_NAME_PREFIX}-web" --resource-group "$RESOURCE_GROUP" --query defaultHostName -o tsv 2>/dev/null || echo "pending")
API_URL=$(az webapp show --name "${APP_NAME_PREFIX}-api-gateway" --resource-group "$RESOURCE_GROUP" --query defaultHostName -o tsv 2>/dev/null || echo "pending")

echo -e "\n${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  Deployment Complete! 🚀                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${YELLOW}Deployment Time:${NC} ${MINUTES}m ${SECONDS}s"
echo ""
echo -e "${YELLOW}Application URLs:${NC}"
echo -e "  Web App:     ${GREEN}https://${WEB_URL}${NC}"
echo -e "  API Gateway: ${GREEN}https://${API_URL}${NC}"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo "  View logs:   az webapp log tail --name ${APP_NAME_PREFIX}-core-api -g $RESOURCE_GROUP"
echo "  SSH access:  az webapp ssh --name ${APP_NAME_PREFIX}-core-api -g $RESOURCE_GROUP"
echo "  Restart:     az webapp restart --name ${APP_NAME_PREFIX}-core-api -g $RESOURCE_GROUP"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Run database migrations (if not already done)"
echo "  2. Verify all services are healthy"
echo "  3. Update DNS/custom domain if needed"



