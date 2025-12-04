#!/bin/bash
# Verify Deployment Status

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.env"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

WEB_URL="https://${APP_NAME_PREFIX}-web.azurewebsites.net"
API_URL="https://${APP_NAME_PREFIX}-api-gateway.azurewebsites.net"

echo "Verifying deployment..."

# Check Web App
echo -n "Checking Web App ($WEB_URL)... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_URL/version.json")
if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}OK (200)${NC}"
    curl -s "$WEB_URL/version.json"
    echo ""
else
    echo -e "${RED}FAILED ($HTTP_CODE)${NC}"
fi

# Check API Gateway
echo -n "Checking API Gateway ($API_URL)... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")
if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}OK (200)${NC}"
    curl -s "$API_URL/health"
    echo ""
else
    echo -e "${RED}FAILED ($HTTP_CODE)${NC}"
fi

echo "Verification complete."
