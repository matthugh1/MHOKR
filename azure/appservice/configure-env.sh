#!/bin/bash
# Configure environment variables for all App Service apps

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.env"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${YELLOW}Configuring environment variables for all services...${NC}"

# Get service URLs (internal communication uses azurewebsites.net URLs)
CORE_API_URL="https://${APP_NAME_PREFIX}-core-api.azurewebsites.net"
AI_SERVICE_URL="https://${APP_NAME_PREFIX}-ai-service.azurewebsites.net"
INTEGRATION_SERVICE_URL="https://${APP_NAME_PREFIX}-integration-service.azurewebsites.net"
API_GATEWAY_URL="https://${APP_NAME_PREFIX}-api-gateway.azurewebsites.net"
WEB_URL="https://${APP_NAME_PREFIX}-web.azurewebsites.net"

# ============================================
# Core API Configuration
# ============================================
echo -e "\n${CYAN}Configuring Core API...${NC}"
az webapp config appsettings set \
    --name "${APP_NAME_PREFIX}-core-api" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        NODE_ENV="production" \
        PORT="3001" \
        DATABASE_URL="$DATABASE_URL" \
        REDIS_URL="$REDIS_URL" \
        JWT_SECRET="$JWT_SECRET" \
        KEYCLOAK_URL="${KEYCLOAK_URL:-}" \
        KEYCLOAK_REALM="${KEYCLOAK_REALM:-okr-nexus}" \
        KEYCLOAK_CLIENT_ID="${KEYCLOAK_CLIENT_ID:-}" \
        KEYCLOAK_CLIENT_SECRET="${KEYCLOAK_CLIENT_SECRET:-}" \
    --output none
echo -e "${GREEN}✓ Core API configured${NC}"

# ============================================
# AI Service Configuration
# ============================================
echo -e "\n${CYAN}Configuring AI Service...${NC}"
az webapp config appsettings set \
    --name "${APP_NAME_PREFIX}-ai-service" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        NODE_ENV="production" \
        PORT="3002" \
        REDIS_URL="$REDIS_URL" \
        CORE_API_URL="$CORE_API_URL" \
        OPENAI_API_KEY="${OPENAI_API_KEY:-}" \
        OPENAI_MODEL="${OPENAI_MODEL:-gpt-4-turbo-preview}" \
        ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
        ANTHROPIC_MODEL="${ANTHROPIC_MODEL:-claude-3-sonnet-20240229}" \
        AI_DEFAULT_PROVIDER="${AI_DEFAULT_PROVIDER:-openai}" \
        AI_CONVERSATION_TTL="${AI_CONVERSATION_TTL:-3600}" \
    --output none
echo -e "${GREEN}✓ AI Service configured${NC}"

# ============================================
# Integration Service Configuration
# ============================================
echo -e "\n${CYAN}Configuring Integration Service...${NC}"
az webapp config appsettings set \
    --name "${APP_NAME_PREFIX}-integration-service" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        NODE_ENV="production" \
        PORT="3003" \
        DATABASE_URL="$DATABASE_URL" \
        REDIS_URL="$REDIS_URL" \
        CORE_API_URL="$CORE_API_URL" \
        JIRA_CLIENT_ID="${JIRA_CLIENT_ID:-}" \
        JIRA_CLIENT_SECRET="${JIRA_CLIENT_SECRET:-}" \
        JIRA_WEBHOOK_SECRET="${JIRA_WEBHOOK_SECRET:-}" \
        GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:-}" \
        GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET:-}" \
        GITHUB_WEBHOOK_SECRET="${GITHUB_WEBHOOK_SECRET:-}" \
        SLACK_CLIENT_ID="${SLACK_CLIENT_ID:-}" \
        SLACK_CLIENT_SECRET="${SLACK_CLIENT_SECRET:-}" \
        SLACK_SIGNING_SECRET="${SLACK_SIGNING_SECRET:-}" \
    --output none
echo -e "${GREEN}✓ Integration Service configured${NC}"

# ============================================
# API Gateway Configuration
# ============================================
echo -e "\n${CYAN}Configuring API Gateway...${NC}"
az webapp config appsettings set \
    --name "${APP_NAME_PREFIX}-api-gateway" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        NODE_ENV="production" \
        PORT="3000" \
        CORE_API_URL="$CORE_API_URL" \
        AI_SERVICE_URL="$AI_SERVICE_URL" \
        INTEGRATION_SERVICE_URL="$INTEGRATION_SERVICE_URL" \
        KEYCLOAK_URL="${KEYCLOAK_URL:-}" \
        KEYCLOAK_REALM="${KEYCLOAK_REALM:-okr-nexus}" \
        KEYCLOAK_CLIENT_ID="${KEYCLOAK_CLIENT_ID:-}" \
        JWT_SECRET="$JWT_SECRET" \
        CORS_ORIGINS="$WEB_URL,${CORS_ORIGINS:-}" \
        RATE_LIMIT_TTL="${RATE_LIMIT_TTL:-60}" \
        RATE_LIMIT_MAX="${RATE_LIMIT_MAX:-100}" \
    --output none
echo -e "${GREEN}✓ API Gateway configured${NC}"

# ============================================
# Web App Configuration
# ============================================
echo -e "\n${CYAN}Configuring Web App...${NC}"
az webapp config appsettings set \
    --name "${APP_NAME_PREFIX}-web" \
    --resource-group "$RESOURCE_GROUP" \
    --settings \
        NODE_ENV="production" \
        PORT="5173" \
        HOSTNAME="0.0.0.0" \
        NEXT_PUBLIC_API_URL="$API_GATEWAY_URL" \
        NEXTAUTH_URL="$WEB_URL" \
        NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
    --output none
echo -e "${GREEN}✓ Web App configured${NC}"

# ============================================
# Summary
# ============================================
echo -e "\n${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Environment configuration complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Service URLs:${NC}"
echo -e "  Web App:              ${GREEN}$WEB_URL${NC}"
echo -e "  API Gateway:          ${GREEN}$API_GATEWAY_URL${NC}"
echo -e "  Core API:             ${GREEN}$CORE_API_URL${NC}"
echo -e "  AI Service:           ${GREEN}$AI_SERVICE_URL${NC}"
echo -e "  Integration Service:  ${GREEN}$INTEGRATION_SERVICE_URL${NC}"
echo ""
echo -e "${YELLOW}Restart services to apply changes:${NC}"
echo "  az webapp restart --name ${APP_NAME_PREFIX}-core-api -g $RESOURCE_GROUP"
echo "  az webapp restart --name ${APP_NAME_PREFIX}-api-gateway -g $RESOURCE_GROUP"
echo "  # ... etc for each service"




