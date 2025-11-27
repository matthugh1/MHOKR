#!/bin/bash
# Build all services for Azure App Service deployment
# No Docker - just npm build

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Building all services...${NC}"

# Create build output directory
BUILD_DIR="$SCRIPT_DIR/build"
mkdir -p "$BUILD_DIR"

# Function to build a NestJS service
build_nestjs_service() {
    local SERVICE_NAME=$1
    local SERVICE_PATH="$PROJECT_ROOT/services/$SERVICE_NAME"
    
    echo -e "\n${YELLOW}Building $SERVICE_NAME...${NC}"
    
    if [ ! -d "$SERVICE_PATH" ]; then
        echo -e "${RED}Error: Service directory not found: $SERVICE_PATH${NC}"
        return 1
    fi
    
    cd "$SERVICE_PATH"
    
    # Install dependencies
    echo "  Installing dependencies..."
    npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps
    
    # Generate Prisma client if this is core-api
    if [ "$SERVICE_NAME" = "core-api" ]; then
        echo "  Generating Prisma client..."
        npx prisma generate
    fi
    
    # Clean and build - use rm -rf instead of rimraf to avoid issues
    echo "  Compiling TypeScript..."
    rm -rf dist 2>/dev/null || true
    npx tsc -p tsconfig.json
    
    # Create deployment package
    echo "  Creating deployment package..."
    local ZIP_FILE="$BUILD_DIR/${SERVICE_NAME}.zip"
    
    # Create a temporary directory for the package
    local TEMP_DIR=$(mktemp -d)
    
    # Copy necessary files
    cp -r dist "$TEMP_DIR/"
    cp package.json "$TEMP_DIR/"
    cp package-lock.json "$TEMP_DIR/" 2>/dev/null || true
    
    # Copy Prisma files for core-api
    if [ "$SERVICE_NAME" = "core-api" ]; then
        cp -r prisma "$TEMP_DIR/"
    fi
    
    # Create node_modules with production dependencies only
    cd "$TEMP_DIR"
    npm ci --omit=dev --legacy-peer-deps 2>/dev/null || npm install --omit=dev --legacy-peer-deps
    
    # Generate Prisma client in the package
    if [ "$SERVICE_NAME" = "core-api" ]; then
        npx prisma generate
    fi
    
    # Create ZIP
    zip -rq "$ZIP_FILE" .
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    local SIZE=$(du -h "$ZIP_FILE" | cut -f1)
    echo -e "${GREEN}  ✓ Built $SERVICE_NAME ($SIZE)${NC}"
    
    cd "$PROJECT_ROOT"
}

# Function to build Next.js app
build_nextjs_app() {
    local APP_PATH="$PROJECT_ROOT/apps/web"
    
    echo -e "\n${YELLOW}Building Next.js web app...${NC}"
    
    cd "$APP_PATH"
    
    # Install dependencies
    echo "  Installing dependencies..."
    npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps
    
    # Set build-time environment variables
    export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://okr-nexus-api-gateway.azurewebsites.net}"
    
    # Build with standalone output
    echo "  Building Next.js (standalone mode)..."
    npm run build:docker  # Uses standalone output
    
    # Create deployment package
    echo "  Creating deployment package..."
    local ZIP_FILE="$BUILD_DIR/web.zip"
    
    # Create a temporary directory for the package
    local TEMP_DIR=$(mktemp -d)
    
    # Copy standalone build
    cp -r .next/standalone/* "$TEMP_DIR/"
    
    # Copy static files - Next.js serves from /_next/static/ but needs files at .next/static/ relative to server.js
    # Since server.js is at apps/web/server.js, static files should be at apps/web/.next/static/
    if [ -d ".next/static" ]; then
      mkdir -p "$TEMP_DIR/apps/web/.next/static"
      cp -r .next/static/* "$TEMP_DIR/apps/web/.next/static/"
    else
      echo "  ⚠️  Warning: .next/static directory not found"
    fi
    
    # Copy public directory
    if [ -d "public" ]; then
      mkdir -p "$TEMP_DIR/apps/web/public"
      cp -r public/* "$TEMP_DIR/apps/web/public/" 2>/dev/null || true
    fi
    
    # Verify structure
    echo "  Verifying deployment structure..."
    if [ -f "$TEMP_DIR/apps/web/server.js" ]; then
      echo "    ✓ server.js found"
    else
      echo "    ✗ ERROR: server.js not found!"
    fi
    if [ -d "$TEMP_DIR/apps/web/.next/static" ]; then
      local static_count=$(find "$TEMP_DIR/apps/web/.next/static" -type f | wc -l)
      echo "    ✓ Static files found: $static_count files"
    else
      echo "    ✗ ERROR: Static files directory not found!"
    fi
    
    # Create startup script for Azure
    cat > "$TEMP_DIR/startup.sh" << 'EOF'
#!/bin/bash
cd /home/site/wwwroot
node apps/web/server.js
EOF
    chmod +x "$TEMP_DIR/startup.sh"
    
    # Create ZIP
    cd "$TEMP_DIR"
    zip -rq "$ZIP_FILE" .
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    local SIZE=$(du -h "$ZIP_FILE" | cut -f1)
    echo -e "${GREEN}  ✓ Built web app ($SIZE)${NC}"
    
    cd "$PROJECT_ROOT"
}

# Build shared packages first
echo -e "${YELLOW}Building shared packages...${NC}"

cd "$PROJECT_ROOT/packages/types"
npm ci 2>/dev/null || npm install
npm run build
echo -e "${GREEN}  ✓ Built @okr-nexus/types${NC}"

cd "$PROJECT_ROOT/packages/utils"
npm ci 2>/dev/null || npm install
npm run build 2>/dev/null || true
echo -e "${GREEN}  ✓ Built @okr-nexus/utils${NC}"

# Build all services
build_nestjs_service "core-api"
build_nestjs_service "ai-service"
build_nestjs_service "integration-service"
build_nestjs_service "api-gateway"

# Build web app
build_nextjs_app

echo -e "\n${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}All services built successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Build artifacts in: $BUILD_DIR${NC}"
ls -lh "$BUILD_DIR"

