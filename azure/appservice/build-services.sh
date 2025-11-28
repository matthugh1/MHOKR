#!/bin/bash
# Build all services for Azure App Service deployment
# Uses pnpm for build and deployment packaging

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

# Ensure pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}Error: pnpm is not installed${NC}"
    exit 1
fi

# Function to build a NestJS service
build_nestjs_service() {
    local SERVICE_NAME=$1
    local PACKAGE_NAME="@okr-nexus/$SERVICE_NAME"
    
    echo -e "\n${YELLOW}Building $SERVICE_NAME ($PACKAGE_NAME)...${NC}"
    
    # Build the service using pnpm filter
    # This assumes the root pnpm install has already run
    pnpm --filter "$PACKAGE_NAME" build
    
    # Create deployment package
    echo "  Creating deployment package..."
    local ZIP_FILE="$BUILD_DIR/${SERVICE_NAME}.zip"
    
    # Create a temporary directory for the package
    local TEMP_DIR=$(mktemp -d)
    
    # Use pnpm deploy to create a production-ready node_modules + package.json
    # This handles workspace dependencies correctly
    pnpm --filter "$PACKAGE_NAME" --prod deploy "$TEMP_DIR"
    
    # Copy the built dist folder from the source to the deployment package
    # (pnpm deploy might not copy dist if it's not in the files list, or if we just built it)
    # Usually pnpm deploy copies the package as is, but we want the built artifacts.
    # The safest way is to copy 'dist' from the service directory.
    cp -r "services/$SERVICE_NAME/dist" "$TEMP_DIR/"
    
    # Copy Prisma files for core-api
    if [ "$SERVICE_NAME" = "core-api" ]; then
        cp -r "services/$SERVICE_NAME/prisma" "$TEMP_DIR/"
        
        # Generate Prisma client in the package
        # Run prisma from the core-api context (where it is installed) but targeting the temp dir schema
        pnpm --filter "@okr-nexus/core-api" exec prisma generate --schema="$TEMP_DIR/prisma/schema.prisma"
    fi
    
    # Create ZIP
    cd "$TEMP_DIR"
    zip -rq "$ZIP_FILE" .
    cd - > /dev/null
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    local SIZE=$(du -h "$ZIP_FILE" | cut -f1)
    echo -e "${GREEN}  ✓ Built $SERVICE_NAME ($SIZE)${NC}"
}

# Function to build Next.js app
build_nextjs_app() {
    local APP_NAME="web"
    local PACKAGE_NAME="@okr-nexus/web"
    local APP_PATH="$PROJECT_ROOT/apps/web"
    
    echo -e "\n${YELLOW}Building Next.js web app...${NC}"
    
    # Set build-time environment variables
    export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://okr-nexus-api-gateway.azurewebsites.net}"
    
    # Build with standalone output
    echo "  Building Next.js (standalone mode)..."
    # We use pnpm to run the build script defined in package.json
    # Ensure your web package.json has "build:docker" or "build" that produces standalone output
    # If "build:docker" doesn't exist, fall back to "build"
    if grep -q "build:docker" "$APP_PATH/package.json"; then
        pnpm --filter "$PACKAGE_NAME" run build:docker
    else
        pnpm --filter "$PACKAGE_NAME" run build
    fi
    
    # Create deployment package
    echo "  Creating deployment package..."
    local ZIP_FILE="$BUILD_DIR/web.zip"
    
    # Create a temporary directory for the package
    local TEMP_DIR=$(mktemp -d)
    
    # Copy standalone build
    # The standalone build is usually in .next/standalone
    cp -r "$APP_PATH/.next/standalone/"* "$TEMP_DIR/"
    
    # Copy static files
    # Next.js serves from /_next/static/ but needs files at .next/static/ relative to server.js
    # Since server.js is at apps/web/server.js (in standalone), static files should be at apps/web/.next/static/
    if [ -d "$APP_PATH/.next/static" ]; then
      mkdir -p "$TEMP_DIR/apps/web/.next/static"
      cp -r "$APP_PATH/.next/static/"* "$TEMP_DIR/apps/web/.next/static/"
    else
      echo "  ⚠️  Warning: .next/static directory not found"
    fi
    
    # Copy public directory
    if [ -d "$APP_PATH/public" ]; then
      mkdir -p "$TEMP_DIR/apps/web/public"
      cp -r "$APP_PATH/public/"* "$TEMP_DIR/apps/web/public/" 2>/dev/null || true
    fi
    
    # Verify structure
    echo "  Verifying deployment structure..."
    if [ -f "$TEMP_DIR/apps/web/server.js" ]; then
      echo "    ✓ server.js found"
    else
      echo "    ✗ ERROR: server.js not found!"
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
    cd - > /dev/null
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    local SIZE=$(du -h "$ZIP_FILE" | cut -f1)
    echo -e "${GREEN}  ✓ Built web app ($SIZE)${NC}"
}

# Main execution
cd "$PROJECT_ROOT"

# Install dependencies for the whole workspace
echo -e "${YELLOW}Installing workspace dependencies...${NC}"
pnpm install --frozen-lockfile

# Build shared packages first
echo -e "${YELLOW}Building shared packages...${NC}"
pnpm --filter @okr-nexus/types build
pnpm --filter @okr-nexus/utils build
echo -e "${GREEN}  ✓ Built shared packages${NC}"

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
