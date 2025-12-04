#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting Fast Build for Core API...${NC}"

mkdir -p "$BUILD_DIR"
cd "$PROJECT_ROOT"

# Incremental install (fast)
echo -e "${YELLOW}Checking dependencies...${NC}"
pnpm install --frozen-lockfile

# Build shared packages
echo -e "${YELLOW}Building shared packages...${NC}"
pnpm --filter @okr-nexus/types build
pnpm --filter @okr-nexus/utils build

# Build Core API
echo -e "${YELLOW}Building Core API...${NC}"
cd services/core-api

# Generate Prisma
echo "  Generating Prisma Client..."
# Force output path in schema.prisma (idempotent)
if ! grep -q "output =" prisma/schema.prisma; then
  sed -i '' 's/provider *= "prisma-client-js"/provider = "prisma-client-js"\n  output = "..\/node_modules\/.prisma\/client"/' prisma/schema.prisma || sed -i 's/provider *= "prisma-client-js"/provider = "prisma-client-js"\n  output = "..\/node_modules\/.prisma\/client"/' prisma/schema.prisma
fi
npx prisma generate

# Build NestJS
echo "  Compiling..."
pnpm build

# Package
echo "  Packaging..."
ZIP_FILE="$BUILD_DIR/core-api.zip"
TEMP_DIR=$(mktemp -d)

# Copy dependencies using pnpm deploy (reliable for workspaces)
echo "  Installing production dependencies for package..."
# We use pnpm deploy to create a standalone package with prod deps
# This is cleaner than manual copy + install
cd "$PROJECT_ROOT"
pnpm --filter @okr-nexus/core-api --prod deploy "$TEMP_DIR"

# Copy dist (overwrite if needed)
cp -r services/core-api/dist "$TEMP_DIR/"
# Copy prisma (overwrite if needed)
cp -r services/core-api/prisma "$TEMP_DIR/"

# Generate prisma client in package (in temp dir)
pushd "$TEMP_DIR" > /dev/null

# Remove workspace dependencies from package.json to avoid pnpm errors during add
# We assume they are already installed/copied by pnpm deploy
node -e "
  const fs = require('fs');
  const pkg = require('./package.json');
  const depsToRemove = ['@okr-nexus/types', '@okr-nexus/utils'];
  if (pkg.dependencies) depsToRemove.forEach(d => delete pkg.dependencies[d]);
  if (pkg.devDependencies) depsToRemove.forEach(d => delete pkg.devDependencies[d]);
  fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
"

# Install prisma CLI using pnpm (handles dependencies correctly)
echo "  Installing Prisma CLI..."
pnpm add -D prisma@5.22.0

npx prisma generate
popd > /dev/null

# Zip
cd "$TEMP_DIR"
zip -rq "$ZIP_FILE" .
cd - > /dev/null
rm -rf "$TEMP_DIR"

echo -e "${GREEN}Core API built successfully!${NC}"
