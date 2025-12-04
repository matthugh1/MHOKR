#!/bin/bash
# Fast Build Script for NestJS Services
# Usage: ./fast-build-service.sh <service-name>

set -e

SERVICE_NAME=$1
if [ -z "$SERVICE_NAME" ]; then
    echo "Usage: $0 <service-name>"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting Fast Build for $SERVICE_NAME...${NC}"

mkdir -p "$BUILD_DIR"
cd "$PROJECT_ROOT"

# Incremental install (fast)
echo -e "${YELLOW}Checking dependencies...${NC}"
pnpm install --frozen-lockfile

# Build shared packages (always needed)
echo -e "${YELLOW}Building shared packages...${NC}"
pnpm --filter @okr-nexus/types build
pnpm --filter @okr-nexus/utils build

# Build Service
echo -e "${YELLOW}Building $SERVICE_NAME...${NC}"
cd "services/$SERVICE_NAME"

# Core API specific: Generate Prisma
if [ "$SERVICE_NAME" == "core-api" ]; then
    echo "  Generating Prisma Client..."
    # Force output path in schema.prisma (idempotent)
    if ! grep -q "output =" prisma/schema.prisma; then
      sed -i '' 's/provider *= "prisma-client-js"/provider = "prisma-client-js"\n  output = "..\/node_modules\/.prisma\/client"/' prisma/schema.prisma || sed -i 's/provider *= "prisma-client-js"/provider = "prisma-client-js"\n  output = "..\/node_modules\/.prisma\/client"/' prisma/schema.prisma
    fi
    npx prisma generate
fi

# Build NestJS
echo "  Compiling..."
pnpm build

# Package
echo "  Packaging..."
ZIP_FILE="$BUILD_DIR/${SERVICE_NAME}.zip"
TEMP_DIR=$(mktemp -d)

# Copy dependencies using pnpm deploy
echo "  Installing production dependencies for package..."
cd "$PROJECT_ROOT"
pnpm --filter "@okr-nexus/$SERVICE_NAME" --prod deploy "$TEMP_DIR"

# Copy dist (overwrite if needed)
cp -r "services/$SERVICE_NAME/dist" "$TEMP_DIR/"

# Core API specific: Copy prisma and generate client
if [ "$SERVICE_NAME" == "core-api" ]; then
    cp -r "services/$SERVICE_NAME/prisma" "$TEMP_DIR/"
    
    pushd "$TEMP_DIR" > /dev/null
    
    # Remove workspace dependencies to avoid pnpm errors
    node -e "
      const fs = require('fs');
      const pkg = require('./package.json');
      const depsToRemove = ['@okr-nexus/types', '@okr-nexus/utils'];
      if (pkg.dependencies) depsToRemove.forEach(d => delete pkg.dependencies[d]);
      if (pkg.devDependencies) depsToRemove.forEach(d => delete pkg.devDependencies[d]);
      fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
    "
    
    echo "  Installing Prisma CLI..."
    pnpm add -D prisma@5.22.0
    npx prisma generate
    popd > /dev/null
fi

# Zip
cd "$TEMP_DIR"
zip -rq "$ZIP_FILE" .
cd - > /dev/null
rm -rf "$TEMP_DIR"

echo -e "${GREEN}$SERVICE_NAME built successfully!${NC}"
