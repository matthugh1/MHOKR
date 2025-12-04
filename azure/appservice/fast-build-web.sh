#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting Fast Build for Web App...${NC}"

mkdir -p "$BUILD_DIR"
cd "$PROJECT_ROOT"

# Incremental install (fast)
echo -e "${YELLOW}Checking dependencies...${NC}"
pnpm install --frozen-lockfile

# Build shared packages
echo -e "${YELLOW}Building shared packages...${NC}"
pnpm --filter @okr-nexus/types build
pnpm --filter @okr-nexus/utils build

# Build Web App
echo -e "${YELLOW}Building Web App...${NC}"
cd apps/web

# Build Next.js
echo "  Compiling..."
pnpm build

# Package
echo "  Packaging..."
ZIP_FILE="$BUILD_DIR/web.zip"
TEMP_DIR=$(mktemp -d)

# Use Next.js standalone output (much smaller)
echo "  Using standalone output..."
cp -r .next/standalone/* "$TEMP_DIR/"

# Copy static assets (required for standalone)
mkdir -p "$TEMP_DIR/apps/web/.next"
cp -r .next/static "$TEMP_DIR/apps/web/.next/"
cp -r public "$TEMP_DIR/apps/web/"

# Check size
echo "  Package content sizes:"
du -sh "$TEMP_DIR"/*

# Zip
cd "$TEMP_DIR"
zip -rq "$ZIP_FILE" .
cd - > /dev/null
rm -rf "$TEMP_DIR"

echo -e "${GREEN}Web App built successfully!${NC}"
