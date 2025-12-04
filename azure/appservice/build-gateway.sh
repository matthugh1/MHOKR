#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"

mkdir -p "$BUILD_DIR"

echo "Building API Gateway..."
cd "$PROJECT_ROOT"

# Build
pnpm --filter @okr-nexus/api-gateway build

# Package
SERVICE_NAME="api-gateway"
PACKAGE_NAME="@okr-nexus/api-gateway"
ZIP_FILE="$BUILD_DIR/${SERVICE_NAME}.zip"
TEMP_DIR=$(mktemp -d)

echo "Creating deployment package..."
pnpm --filter "$PACKAGE_NAME" --prod deploy "$TEMP_DIR"

# Copy dist
cp -r "services/$SERVICE_NAME/dist" "$TEMP_DIR/"

# Zip
cd "$TEMP_DIR"
zip -rq "$ZIP_FILE" .
cd - > /dev/null
rm -rf "$TEMP_DIR"

echo "API Gateway built: $ZIP_FILE"
