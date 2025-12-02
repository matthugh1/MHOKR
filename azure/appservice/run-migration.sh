#!/bin/bash
set -e

# Load environment variables if .env exists
if [ -f .env ]; then
  export $(cat .env | xargs)
fi

RESOURCE_GROUP=${RESOURCE_GROUP:-vibe-code-test}
APP_NAME_PREFIX=${APP_NAME_PREFIX:-okr-nexus}
CORE_API_NAME="${APP_NAME_PREFIX}-core-api"

echo "Fetching DATABASE_URL from ${CORE_API_NAME}..."
DATABASE_URL=$(az webapp config appsettings list \
  --name $CORE_API_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "[?name=='DATABASE_URL'].value" -o tsv)

if [ -z "$DATABASE_URL" ]; then
  echo "Error: Could not fetch DATABASE_URL from Azure."
  exit 1
fi

export DATABASE_URL

echo "Running migrations..."
# Navigate to core-api directory relative to this script
cd "$(dirname "$0")/../../services/core-api"
# Using db push failed due to index conflicts.
# Manually applying the critical enum change.
echo "ALTER TYPE \"EntityType\" ADD VALUE IF NOT EXISTS 'TASK';" | npx prisma db execute --stdin --url "$DATABASE_URL"
# npx prisma db push --accept-data-loss

echo "Migrations completed successfully."
