#!/bin/bash
# Fast Deployment Script for Azure App Service
# Uses optimized build scripts and targeted deployments

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.env"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}Starting Fast Deployment...${NC}"

# 1. Build & Deploy Web App
echo -e "\n${YELLOW}=== Web App ===${NC}"
export NEXT_PUBLIC_API_URL="https://${APP_NAME_PREFIX}-api-gateway.azurewebsites.net"
"$SCRIPT_DIR/fast-build-web.sh"
"$SCRIPT_DIR/deploy-web.sh"

# 2. Build & Deploy API Gateway
echo -e "\n${YELLOW}=== API Gateway ===${NC}"
"$SCRIPT_DIR/fast-build-service.sh" api-gateway
"$SCRIPT_DIR/deploy-backend.sh" api-gateway

# 3. Build & Deploy Core API
echo -e "\n${YELLOW}=== Core API ===${NC}"
"$SCRIPT_DIR/fast-build-service.sh" core-api
"$SCRIPT_DIR/deploy-backend.sh" core-api

# 4. Build & Deploy AI Service
echo -e "\n${YELLOW}=== AI Service ===${NC}"
"$SCRIPT_DIR/fast-build-service.sh" ai-service
"$SCRIPT_DIR/deploy-backend.sh" ai-service

# 5. Build & Deploy Integration Service
echo -e "\n${YELLOW}=== Integration Service ===${NC}"
"$SCRIPT_DIR/fast-build-service.sh" integration-service
"$SCRIPT_DIR/deploy-backend.sh" integration-service

echo -e "\n${GREEN}Deployment Complete!${NC}"
echo -e "Web App: https://${APP_NAME_PREFIX}-web.azurewebsites.net"
echo -e "API Gateway: https://${APP_NAME_PREFIX}-api-gateway.azurewebsites.net"
