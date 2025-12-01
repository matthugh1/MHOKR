#!/bin/bash
# Script to apply migration to Azure Database
# Usage: ./apply-migration-to-azure.sh <AZURE_DATABASE_URL>

if [ -z "$1" ]; then
    echo "Usage: $0 <AZURE_DATABASE_URL>"
    echo "Example: $0 'postgresql://user:password@server.database.azure.com:5432/dbname?sslmode=require'"
    exit 1
fi

AZURE_DATABASE_URL="$1"

echo "Applying migration to Azure database..."
echo "Migration: 20251126075303_add_parent_key_result_id"

# Set DATABASE_URL temporarily and run migrate deploy
export DATABASE_URL="$AZURE_DATABASE_URL"
npx prisma migrate deploy

echo "Migration applied successfully!"




