#!/bin/bash
# Deploy Application Services to Azure Container Apps

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

echo -e "${GREEN}=== Deploying Application Services ===${NC}"

# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query loginServer -o tsv)

# Internal service hostnames (using Container Apps internal FQDN)
# Note: Container Apps requires full internal FQDN for service-to-service communication
POSTGRES_HOST="${APP_NAME_PREFIX}-postgres.internal.salmonground-fc94351a.uksouth.azurecontainerapps.io"
REDIS_HOST="${APP_NAME_PREFIX}-redis.internal.salmonground-fc94351a.uksouth.azurecontainerapps.io"
KEYCLOAK_HOST="${APP_NAME_PREFIX}-keycloak.internal.salmonground-fc94351a.uksouth.azurecontainerapps.io"
CORE_API_HOST="${APP_NAME_PREFIX}-core-api.internal.salmonground-fc94351a.uksouth.azurecontainerapps.io"
AI_SERVICE_HOST="${APP_NAME_PREFIX}-ai-service.internal.salmonground-fc94351a.uksouth.azurecontainerapps.io"
INTEGRATION_SERVICE_HOST="${APP_NAME_PREFIX}-integration-service.internal.salmonground-fc94351a.uksouth.azurecontainerapps.io"

# Database connection string
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}?schema=public"
REDIS_URL="redis://${REDIS_HOST}:6379"

# Deploy Core API
echo -e "${YELLOW}Deploying Core API...${NC}"
az containerapp create \
    --name "${APP_NAME_PREFIX}-core-api" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$CONTAINER_APPS_ENV_NAME" \
    --image "${ACR_LOGIN_SERVER}/${APP_NAME_PREFIX}-core-api:latest" \
    --min-replicas 1 \
    --max-replicas 3 \
    --cpu 1.0 \
    --memory 2.0Gi \
    --env-vars \
        NODE_ENV=production \
        PORT=3001 \
        DATABASE_URL="$DATABASE_URL" \
        REDIS_URL="$REDIS_URL" \
        JWT_SECRET="$JWT_SECRET" \
        KEYCLOAK_URL="http://${KEYCLOAK_HOST}:8080" \
        KEYCLOAK_REALM="$KEYCLOAK_REALM" \
        KEYCLOAK_CLIENT_ID="$KEYCLOAK_CLIENT_ID" \
        KEYCLOAK_CLIENT_SECRET="$KEYCLOAK_CLIENT_SECRET" \
    --ingress internal \
    --target-port 3001 \
    --registry-server "$ACR_LOGIN_SERVER" \
    --registry-username "$(az acr credential show --name "$ACR_NAME" --query username -o tsv)" \
    --registry-password "$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)" \
    --query properties.configuration.ingress.fqdn -o tsv &>/dev/null || \
az containerapp update \
    --name "${APP_NAME_PREFIX}-core-api" \
    --resource-group "$RESOURCE_GROUP" \
    --image "${ACR_LOGIN_SERVER}/${APP_NAME_PREFIX}-core-api:latest" \
    --env-vars \
        NODE_ENV=production \
        PORT=3001 \
        DATABASE_URL="$DATABASE_URL" \
        REDIS_URL="$REDIS_URL" \
        JWT_SECRET="$JWT_SECRET" \
        KEYCLOAK_URL="http://${KEYCLOAK_HOST}:8080" \
        KEYCLOAK_REALM="$KEYCLOAK_REALM" \
        KEYCLOAK_CLIENT_ID="$KEYCLOAK_CLIENT_ID" \
        KEYCLOAK_CLIENT_SECRET="$KEYCLOAK_CLIENT_SECRET" \
    --query properties.configuration.ingress.fqdn -o tsv &>/dev/null

echo -e "${GREEN}Core API deployed successfully.${NC}"

# Deploy AI Service
echo -e "${YELLOW}Deploying AI Service...${NC}"
az containerapp create \
    --name "${APP_NAME_PREFIX}-ai-service" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$CONTAINER_APPS_ENV_NAME" \
    --image "${ACR_LOGIN_SERVER}/${APP_NAME_PREFIX}-ai-service:latest" \
    --min-replicas 1 \
    --max-replicas 2 \
    --cpu 1.0 \
    --memory 2.0Gi \
    --env-vars \
        NODE_ENV=production \
        PORT=3002 \
        REDIS_URL="$REDIS_URL" \
        CORE_API_URL="http://${CORE_API_HOST}:3001" \
        OPENAI_API_KEY="$OPENAI_API_KEY" \
        ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
        AI_DEFAULT_PROVIDER="${AI_DEFAULT_PROVIDER:-openai}" \
    --ingress internal \
    --target-port 3002 \
    --registry-server "$ACR_LOGIN_SERVER" \
    --registry-username "$(az acr credential show --name "$ACR_NAME" --query username -o tsv)" \
    --registry-password "$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)" \
    --query properties.configuration.ingress.fqdn -o tsv &>/dev/null || \
az containerapp update \
    --name "${APP_NAME_PREFIX}-ai-service" \
    --resource-group "$RESOURCE_GROUP" \
    --image "${ACR_LOGIN_SERVER}/${APP_NAME_PREFIX}-ai-service:latest" \
    --env-vars \
        NODE_ENV=production \
        PORT=3002 \
        REDIS_URL="$REDIS_URL" \
        CORE_API_URL="http://${CORE_API_HOST}:3001" \
        OPENAI_API_KEY="$OPENAI_API_KEY" \
        ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
        AI_DEFAULT_PROVIDER="${AI_DEFAULT_PROVIDER:-openai}" \
    --query properties.configuration.ingress.fqdn -o tsv &>/dev/null

echo -e "${GREEN}AI Service deployed successfully.${NC}"

# Deploy Integration Service
echo -e "${YELLOW}Deploying Integration Service...${NC}"
az containerapp create \
    --name "${APP_NAME_PREFIX}-integration-service" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$CONTAINER_APPS_ENV_NAME" \
    --image "${ACR_LOGIN_SERVER}/${APP_NAME_PREFIX}-integration-service:latest" \
    --min-replicas 1 \
    --max-replicas 2 \
    --cpu 0.5 \
    --memory 1.0Gi \
    --env-vars \
        NODE_ENV=production \
        PORT=3003 \
        DATABASE_URL="$DATABASE_URL" \
        REDIS_URL="$REDIS_URL" \
        CORE_API_URL="http://${CORE_API_HOST}:3001" \
    --ingress internal \
    --target-port 3003 \
    --registry-server "$ACR_LOGIN_SERVER" \
    --registry-username "$(az acr credential show --name "$ACR_NAME" --query username -o tsv)" \
    --registry-password "$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)" \
    --query properties.configuration.ingress.fqdn -o tsv &>/dev/null || \
az containerapp update \
    --name "${APP_NAME_PREFIX}-integration-service" \
    --resource-group "$RESOURCE_GROUP" \
    --image "${ACR_LOGIN_SERVER}/${APP_NAME_PREFIX}-integration-service:latest" \
    --env-vars \
        NODE_ENV=production \
        PORT=3003 \
        DATABASE_URL="$DATABASE_URL" \
        REDIS_URL="$REDIS_URL" \
        CORE_API_URL="http://${CORE_API_HOST}:3001" \
    --query properties.configuration.ingress.fqdn -o tsv &>/dev/null

echo -e "${GREEN}Integration Service deployed successfully.${NC}"

# Deploy Keycloak
echo -e "${YELLOW}Deploying Keycloak...${NC}"
az containerapp create \
    --name "${APP_NAME_PREFIX}-keycloak" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$CONTAINER_APPS_ENV_NAME" \
    --image quay.io/keycloak/keycloak:23.0 \
    --min-replicas 1 \
    --max-replicas 1 \
    --cpu 1.0 \
    --memory 2.0Gi \
    --env-vars \
        KEYCLOAK_ADMIN="$KEYCLOAK_ADMIN_USER" \
        KEYCLOAK_ADMIN_PASSWORD="$KEYCLOAK_ADMIN_PASSWORD" \
        KC_DB=postgres \
        KC_DB_URL="jdbc:postgresql://${POSTGRES_HOST}:5432/${POSTGRES_DB}" \
        KC_DB_USERNAME="$POSTGRES_USER" \
        KC_DB_PASSWORD="$POSTGRES_PASSWORD" \
        KC_HOSTNAME_STRICT=false \
        KC_HTTP_ENABLED=true \
        KC_HEALTH_ENABLED=true \
    --command "start-dev" \
    --ingress internal \
    --target-port 8080 \
    --registry-server quay.io \
    --query properties.configuration.ingress.fqdn -o tsv &>/dev/null || \
az containerapp update \
    --name "${APP_NAME_PREFIX}-keycloak" \
    --resource-group "$RESOURCE_GROUP" \
    --image quay.io/keycloak/keycloak:23.0 \
    --env-vars \
        KEYCLOAK_ADMIN="$KEYCLOAK_ADMIN_USER" \
        KEYCLOAK_ADMIN_PASSWORD="$KEYCLOAK_ADMIN_PASSWORD" \
        KC_DB=postgres \
        KC_DB_URL="jdbc:postgresql://${POSTGRES_HOST}:5432/${POSTGRES_DB}" \
        KC_DB_USERNAME="$POSTGRES_USER" \
        KC_DB_PASSWORD="$POSTGRES_PASSWORD" \
        KC_HOSTNAME_STRICT=false \
        KC_HTTP_ENABLED=true \
        KC_HEALTH_ENABLED=true \
    --command "start-dev" \
    --query properties.configuration.ingress.fqdn -o tsv &>/dev/null

echo -e "${GREEN}Keycloak deployed successfully.${NC}"

# Wait for Keycloak to be ready before deploying API Gateway
echo -e "${YELLOW}Waiting for Keycloak to be ready...${NC}"
sleep 15

# Deploy API Gateway (public ingress)
echo -e "${YELLOW}Deploying API Gateway...${NC}"
API_GATEWAY_URL=$(az containerapp create \
    --name "${APP_NAME_PREFIX}-api-gateway" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$CONTAINER_APPS_ENV_NAME" \
    --image "${ACR_LOGIN_SERVER}/${APP_NAME_PREFIX}-api-gateway:latest" \
    --min-replicas 1 \
    --max-replicas 3 \
    --cpu 0.5 \
    --memory 1.0Gi \
    --env-vars \
        NODE_ENV=production \
        PORT=3000 \
        CORE_API_URL="http://${CORE_API_HOST}:3001" \
        AI_SERVICE_URL="http://${AI_SERVICE_HOST}:3002" \
        INTEGRATION_SERVICE_URL="http://${INTEGRATION_SERVICE_HOST}:3003" \
        KEYCLOAK_URL="http://${KEYCLOAK_HOST}:8080" \
        KEYCLOAK_REALM="$KEYCLOAK_REALM" \
        KEYCLOAK_CLIENT_ID="$KEYCLOAK_CLIENT_ID" \
        JWT_SECRET="$JWT_SECRET" \
        CORS_ORIGINS="https://${APP_NAME_PREFIX}-web.salmonground-fc94351a.uksouth.azurecontainerapps.io" \
    --ingress external \
    --target-port 3000 \
    --registry-server "$ACR_LOGIN_SERVER" \
    --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null || \
az containerapp update \
    --name "${APP_NAME_PREFIX}-api-gateway" \
    --resource-group "$RESOURCE_GROUP" \
    --image "${ACR_LOGIN_SERVER}/${APP_NAME_PREFIX}-api-gateway:latest" \
    --env-vars \
        NODE_ENV=production \
        PORT=3000 \
        CORE_API_URL="http://${CORE_API_HOST}:3001" \
        AI_SERVICE_URL="http://${AI_SERVICE_HOST}:3002" \
        INTEGRATION_SERVICE_URL="http://${INTEGRATION_SERVICE_HOST}:3003" \
        KEYCLOAK_URL="http://${KEYCLOAK_HOST}:8080" \
        KEYCLOAK_REALM="$KEYCLOAK_REALM" \
        KEYCLOAK_CLIENT_ID="$KEYCLOAK_CLIENT_ID" \
        JWT_SECRET="$JWT_SECRET" \
        CORS_ORIGINS="https://${APP_NAME_PREFIX}-web.salmonground-fc94351a.uksouth.azurecontainerapps.io" \
    --ingress external \
    --query properties.configuration.ingress.fqdn -o tsv)

echo -e "${GREEN}API Gateway deployed successfully.${NC}"
echo -e "${GREEN}API Gateway URL: https://$API_GATEWAY_URL${NC}"

# Wait for API Gateway to be fully ready
echo -e "${YELLOW}Waiting for API Gateway to be ready...${NC}"
sleep 10

# Rebuild web app with API Gateway URL
# CRITICAL: Next.js NEXT_PUBLIC_* variables are baked at build time, not runtime
# We must rebuild the web app image with the correct API Gateway URL
echo -e "\n${YELLOW}Rebuilding Web App with API Gateway URL...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

WEB_IMAGE_NAME="$ACR_LOGIN_SERVER/${APP_NAME_PREFIX}-web:latest"

echo -e "${YELLOW}Building web app with NEXT_PUBLIC_API_URL=https://$API_GATEWAY_URL...${NC}"
docker build \
    --platform linux/amd64 \
    -f "apps/web/Dockerfile" \
    --build-arg NEXT_PUBLIC_API_URL="https://$API_GATEWAY_URL" \
    -t "$WEB_IMAGE_NAME" \
    .

echo -e "${YELLOW}Pushing rebuilt web app...${NC}"
docker push "$WEB_IMAGE_NAME"
echo -e "${GREEN}Web app rebuilt and pushed successfully.${NC}"

# Deploy Web App (public ingress)
echo -e "\n${YELLOW}Deploying Web App...${NC}"
WEB_APP_URL=$(az containerapp create \
    --name "${APP_NAME_PREFIX}-web" \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$CONTAINER_APPS_ENV_NAME" \
    --image "$WEB_IMAGE_NAME" \
    --min-replicas 1 \
    --max-replicas 3 \
    --cpu 1.0 \
    --memory 2.0Gi \
    --env-vars \
        NODE_ENV=production \
        NEXTAUTH_URL="${NEXTAUTH_URL:-https://$API_GATEWAY_URL}" \
        NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
    --ingress external \
    --target-port 5173 \
    --registry-server "$ACR_LOGIN_SERVER" \
    --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null || \
az containerapp update \
    --name "${APP_NAME_PREFIX}-web" \
    --resource-group "$RESOURCE_GROUP" \
    --image "$WEB_IMAGE_NAME" \
    --env-vars \
        NODE_ENV=production \
        NEXTAUTH_URL="${NEXTAUTH_URL:-https://$API_GATEWAY_URL}" \
        NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
    --ingress external \
    --query properties.configuration.ingress.fqdn -o tsv)

echo -e "${GREEN}Web App deployed successfully.${NC}"
echo -e "${GREEN}Web App URL: https://$WEB_APP_URL${NC}"

echo -e "\n${GREEN}=== All Application Services Deployed ===${NC}"
echo -e "API Gateway: ${GREEN}https://$API_GATEWAY_URL${NC}"
echo -e "Web App: ${GREEN}https://$WEB_APP_URL${NC}"

