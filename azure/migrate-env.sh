#!/bin/bash
# Migrate existing .env files to Azure deployment .env format
# This script reads from your existing .env files and creates azure/.env

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}=== Environment Variable Migration Tool ===${NC}\n"

# Check if azure/.env already exists
if [ -f "$SCRIPT_DIR/.env" ]; then
    echo -e "${YELLOW}Warning: azure/.env already exists.${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Migration cancelled.${NC}"
        exit 0
    fi
fi

# Start with the example file as a template
cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"

echo -e "${GREEN}Created azure/.env from template.${NC}\n"

# Function to read value from .env file
read_env_value() {
    local file="$1"
    local key="$2"
    if [ -f "$file" ]; then
        grep -E "^${key}=" "$file" 2>/dev/null | cut -d '=' -f2- | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/" || echo ""
    fi
}

# Function to update value in azure/.env
update_env_value() {
    local key="$1"
    local value="$2"
    if [ -n "$value" ]; then
        # Escape special characters in value
        escaped_value=$(printf '%s\n' "$value" | sed 's/[[\.*^$()+?{|]/\\&/g')
        # Update the value in azure/.env
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|^${key}=.*|${key}=${escaped_value}|" "$SCRIPT_DIR/.env"
        else
            # Linux
            sed -i "s|^${key}=.*|${key}=${escaped_value}|" "$SCRIPT_DIR/.env"
        fi
    fi
}

echo -e "${YELLOW}Reading environment variables from existing .env files...${NC}\n"

# Read from root .env if it exists
ROOT_ENV="$PROJECT_ROOT/.env"
if [ -f "$ROOT_ENV" ]; then
    echo -e "${GREEN}Found root .env file${NC}"
    
    # Read common variables
    POSTGRES_USER=$(read_env_value "$ROOT_ENV" "POSTGRES_USER")
    POSTGRES_PASSWORD=$(read_env_value "$ROOT_ENV" "POSTGRES_PASSWORD")
    POSTGRES_DB=$(read_env_value "$ROOT_ENV" "POSTGRES_DB")
    JWT_SECRET=$(read_env_value "$ROOT_ENV" "JWT_SECRET")
    KEYCLOAK_REALM=$(read_env_value "$ROOT_ENV" "KEYCLOAK_REALM")
    KEYCLOAK_CLIENT_ID=$(read_env_value "$ROOT_ENV" "KEYCLOAK_CLIENT_ID")
    KEYCLOAK_CLIENT_SECRET=$(read_env_value "$ROOT_ENV" "KEYCLOAK_CLIENT_SECRET")
    KEYCLOAK_ADMIN_USER=$(read_env_value "$ROOT_ENV" "KEYCLOAK_ADMIN_USER")
    KEYCLOAK_ADMIN_PASSWORD=$(read_env_value "$ROOT_ENV" "KEYCLOAK_ADMIN_PASSWORD")
    OPENAI_API_KEY=$(read_env_value "$ROOT_ENV" "OPENAI_API_KEY")
    ANTHROPIC_API_KEY=$(read_env_value "$ROOT_ENV" "ANTHROPIC_API_KEY")
    AI_DEFAULT_PROVIDER=$(read_env_value "$ROOT_ENV" "AI_DEFAULT_PROVIDER")
    NEXTAUTH_SECRET=$(read_env_value "$ROOT_ENV" "NEXTAUTH_SECRET")
    NEXTAUTH_URL=$(read_env_value "$ROOT_ENV" "NEXTAUTH_URL")
    CORS_ORIGINS=$(read_env_value "$ROOT_ENV" "CORS_ORIGINS")
    
    # Update azure/.env with found values
    [ -n "$POSTGRES_USER" ] && update_env_value "POSTGRES_USER" "$POSTGRES_USER"
    [ -n "$POSTGRES_PASSWORD" ] && update_env_value "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD"
    [ -n "$POSTGRES_DB" ] && update_env_value "POSTGRES_DB" "$POSTGRES_DB"
    [ -n "$JWT_SECRET" ] && update_env_value "JWT_SECRET" "$JWT_SECRET"
    [ -n "$KEYCLOAK_REALM" ] && update_env_value "KEYCLOAK_REALM" "$KEYCLOAK_REALM"
    [ -n "$KEYCLOAK_CLIENT_ID" ] && update_env_value "KEYCLOAK_CLIENT_ID" "$KEYCLOAK_CLIENT_ID"
    [ -n "$KEYCLOAK_CLIENT_SECRET" ] && update_env_value "KEYCLOAK_CLIENT_SECRET" "$KEYCLOAK_CLIENT_SECRET"
    [ -n "$KEYCLOAK_ADMIN_USER" ] && update_env_value "KEYCLOAK_ADMIN_USER" "$KEYCLOAK_ADMIN_USER"
    [ -n "$KEYCLOAK_ADMIN_PASSWORD" ] && update_env_value "KEYCLOAK_ADMIN_PASSWORD" "$KEYCLOAK_ADMIN_PASSWORD"
    [ -n "$OPENAI_API_KEY" ] && update_env_value "OPENAI_API_KEY" "$OPENAI_API_KEY"
    [ -n "$ANTHROPIC_API_KEY" ] && update_env_value "ANTHROPIC_API_KEY" "$ANTHROPIC_API_KEY"
    [ -n "$AI_DEFAULT_PROVIDER" ] && update_env_value "AI_DEFAULT_PROVIDER" "$AI_DEFAULT_PROVIDER"
    [ -n "$NEXTAUTH_SECRET" ] && update_env_value "NEXTAUTH_SECRET" "$NEXTAUTH_SECRET"
    [ -n "$NEXTAUTH_URL" ] && update_env_value "NEXTAUTH_URL" "$NEXTAUTH_URL"
    [ -n "$CORS_ORIGINS" ] && update_env_value "CORS_ORIGINS" "$CORS_ORIGINS"
fi

# Read from service-specific .env files
CORE_API_ENV="$PROJECT_ROOT/services/core-api/.env"
if [ -f "$CORE_API_ENV" ]; then
    echo -e "${GREEN}Found core-api/.env${NC}"
    # Read any additional variables
    DATABASE_URL=$(read_env_value "$CORE_API_ENV" "DATABASE_URL")
    REDIS_URL=$(read_env_value "$CORE_API_ENV" "REDIS_URL")
    KEYCLOAK_URL=$(read_env_value "$CORE_API_ENV" "KEYCLOAK_URL")
    
    # Extract values from DATABASE_URL if present
    if [ -n "$DATABASE_URL" ]; then
        # Parse postgresql://user:password@host:port/database
        DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
        DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
        DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
        
        [ -z "$POSTGRES_USER" ] && [ -n "$DB_USER" ] && update_env_value "POSTGRES_USER" "$DB_USER"
        [ -z "$POSTGRES_PASSWORD" ] && [ -n "$DB_PASS" ] && update_env_value "POSTGRES_PASSWORD" "$DB_PASS"
        [ -z "$POSTGRES_DB" ] && [ -n "$DB_NAME" ] && update_env_value "POSTGRES_DB" "$DB_NAME"
    fi
fi

AI_SERVICE_ENV="$PROJECT_ROOT/services/ai-service/.env"
if [ -f "$AI_SERVICE_ENV" ]; then
    echo -e "${GREEN}Found ai-service/.env${NC}"
    OPENAI_API_KEY=$(read_env_value "$AI_SERVICE_ENV" "OPENAI_API_KEY")
    ANTHROPIC_API_KEY=$(read_env_value "$AI_SERVICE_ENV" "ANTHROPIC_API_KEY")
    AI_DEFAULT_PROVIDER=$(read_env_value "$AI_SERVICE_ENV" "AI_DEFAULT_PROVIDER")
    
    [ -n "$OPENAI_API_KEY" ] && update_env_value "OPENAI_API_KEY" "$OPENAI_API_KEY"
    [ -n "$ANTHROPIC_API_KEY" ] && update_env_value "ANTHROPIC_API_KEY" "$ANTHROPIC_API_KEY"
    [ -n "$AI_DEFAULT_PROVIDER" ] && update_env_value "AI_DEFAULT_PROVIDER" "$AI_DEFAULT_PROVIDER"
fi

INTEGRATION_SERVICE_ENV="$PROJECT_ROOT/services/integration-service/.env"
if [ -f "$INTEGRATION_SERVICE_ENV" ]; then
    echo -e "${GREEN}Found integration-service/.env${NC}"
    JIRA_CLIENT_ID=$(read_env_value "$INTEGRATION_SERVICE_ENV" "JIRA_CLIENT_ID")
    JIRA_CLIENT_SECRET=$(read_env_value "$INTEGRATION_SERVICE_ENV" "JIRA_CLIENT_SECRET")
    GITHUB_CLIENT_ID=$(read_env_value "$INTEGRATION_SERVICE_ENV" "GITHUB_CLIENT_ID")
    GITHUB_CLIENT_SECRET=$(read_env_value "$INTEGRATION_SERVICE_ENV" "GITHUB_CLIENT_SECRET")
    SLACK_CLIENT_ID=$(read_env_value "$INTEGRATION_SERVICE_ENV" "SLACK_CLIENT_ID")
    SLACK_CLIENT_SECRET=$(read_env_value "$INTEGRATION_SERVICE_ENV" "SLACK_CLIENT_SECRET")
    
    [ -n "$JIRA_CLIENT_ID" ] && update_env_value "JIRA_CLIENT_ID" "$JIRA_CLIENT_ID"
    [ -n "$JIRA_CLIENT_SECRET" ] && update_env_value "JIRA_CLIENT_SECRET" "$JIRA_CLIENT_SECRET"
    [ -n "$GITHUB_CLIENT_ID" ] && update_env_value "GITHUB_CLIENT_ID" "$GITHUB_CLIENT_ID"
    [ -n "$GITHUB_CLIENT_SECRET" ] && update_env_value "GITHUB_CLIENT_SECRET" "$GITHUB_CLIENT_SECRET"
    [ -n "$SLACK_CLIENT_ID" ] && update_env_value "SLACK_CLIENT_ID" "$SLACK_CLIENT_ID"
    [ -n "$SLACK_CLIENT_SECRET" ] && update_env_value "SLACK_CLIENT_SECRET" "$SLACK_CLIENT_SECRET"
fi

echo -e "\n${GREEN}=== Migration Complete ===${NC}\n"
echo -e "${YELLOW}Please review and update azure/.env with:${NC}"
echo -e "1. Azure-specific settings (RESOURCE_GROUP, LOCATION, ACR_NAME, etc.)"
echo -e "2. Any missing values that weren't found in your existing .env files"
echo -e "3. Update NEXTAUTH_URL and CORS_ORIGINS after deployment with actual URLs"
echo -e "\n${GREEN}File location: $SCRIPT_DIR/.env${NC}\n"


