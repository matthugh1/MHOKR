#!/bin/bash
# Validation script for fast-deploy.sh and verify-deployment.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=== Validating Deployment Scripts ===${NC}\n"

ERRORS=0
WARNINGS=0

# Function to check if file exists
check_file() {
    local file="$1"
    local name="$2"
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $name exists"
        return 0
    else
        echo -e "${RED}✗${NC} $name missing: $file"
        return 1
    fi
}

# Function to check if command exists
check_command() {
    local cmd="$1"
    if command -v "$cmd" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $cmd is available"
        return 0
    else
        echo -e "${RED}✗${NC} $cmd not found"
        return 1
    fi
}

# Function to check script syntax
check_syntax() {
    local script="$1"
    local name="$2"
    if bash -n "$script" 2>&1; then
        echo -e "${GREEN}✓${NC} $name has valid syntax"
        return 0
    else
        echo -e "${RED}✗${NC} $name has syntax errors"
        return 1
    fi
}

# Check main scripts
echo -e "${YELLOW}1. Checking main scripts...${NC}"
check_file "$SCRIPT_DIR/fast-deploy.sh" "fast-deploy.sh" || ((ERRORS++))
check_file "$SCRIPT_DIR/verify-deployment.sh" "verify-deployment.sh" || ((ERRORS++))

# Check .env file
echo -e "\n${YELLOW}2. Checking configuration...${NC}"
if [ -f "$SCRIPT_DIR/.env" ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
    # Source it to check for required variables
    set +e
    source "$SCRIPT_DIR/.env" 2>/dev/null
    set -e
    
    if [ -z "$APP_NAME_PREFIX" ]; then
        echo -e "${RED}✗${NC} APP_NAME_PREFIX not set in .env"
        ((ERRORS++))
    else
        echo -e "${GREEN}✓${NC} APP_NAME_PREFIX is set: $APP_NAME_PREFIX"
    fi
    
    if [ -z "$RESOURCE_GROUP" ]; then
        echo -e "${RED}✗${NC} RESOURCE_GROUP not set in .env"
        ((ERRORS++))
    else
        echo -e "${GREEN}✓${NC} RESOURCE_GROUP is set: $RESOURCE_GROUP"
    fi
else
    echo -e "${RED}✗${NC} .env file missing (required)"
    echo -e "${YELLOW}  → Copy env.example.txt to .env and configure it${NC}"
    ((ERRORS++))
fi

# Check dependencies for fast-deploy.sh
echo -e "\n${YELLOW}3. Checking dependencies for fast-deploy.sh...${NC}"
check_file "$SCRIPT_DIR/fast-build-web.sh" "fast-build-web.sh" || ((ERRORS++))
check_file "$SCRIPT_DIR/fast-build-service.sh" "fast-build-service.sh" || ((ERRORS++))
check_file "$SCRIPT_DIR/deploy-web.sh" "deploy-web.sh" || ((ERRORS++))
check_file "$SCRIPT_DIR/deploy-backend.sh" "deploy-backend.sh" || ((ERRORS++))
check_command "az" || ((ERRORS++))
check_command "pnpm" || ((WARNINGS++))
check_command "zip" || ((ERRORS++))

# Check dependencies for verify-deployment.sh
echo -e "\n${YELLOW}4. Checking dependencies for verify-deployment.sh...${NC}"
check_command "curl" || ((ERRORS++))

# Check script syntax
echo -e "\n${YELLOW}5. Checking script syntax...${NC}"
check_syntax "$SCRIPT_DIR/fast-deploy.sh" "fast-deploy.sh" || ((ERRORS++))
check_syntax "$SCRIPT_DIR/verify-deployment.sh" "verify-deployment.sh" || ((ERRORS++))

# Check if scripts are executable
echo -e "\n${YELLOW}6. Checking permissions...${NC}"
if [ -x "$SCRIPT_DIR/fast-deploy.sh" ]; then
    echo -e "${GREEN}✓${NC} fast-deploy.sh is executable"
else
    echo -e "${YELLOW}⚠${NC} fast-deploy.sh is not executable (run: chmod +x fast-deploy.sh)"
    ((WARNINGS++))
fi

if [ -x "$SCRIPT_DIR/verify-deployment.sh" ]; then
    echo -e "${GREEN}✓${NC} verify-deployment.sh is executable"
else
    echo -e "${YELLOW}⚠${NC} verify-deployment.sh is not executable (run: chmod +x verify-deployment.sh)"
    ((WARNINGS++))
fi

# Summary
echo -e "\n${CYAN}=== Summary ===${NC}"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Scripts should work correctly.${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Scripts should work, but there are $WARNINGS warning(s)${NC}"
    exit 0
else
    echo -e "${RED}✗ Found $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo -e "${YELLOW}Please fix the errors before running the scripts.${NC}"
    exit 1
fi

