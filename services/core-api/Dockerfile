FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package.json and tsconfig.json for workspace support
COPY package.json ./
COPY package-lock.json* ./
COPY tsconfig.json ./

# Copy and build packages first
COPY packages ./packages
WORKDIR /app/packages/types
RUN npm install && npm run build
WORKDIR /app/packages/utils
RUN npm install && npm run build || true

# Now build the service
WORKDIR /app/services/core-api
COPY services/core-api/package*.json ./
COPY services/core-api/tsconfig*.json ./

# Install dependencies from root (workspace packages are now available)
WORKDIR /app
RUN npm install

WORKDIR /app/services/core-api
COPY services/core-api ./

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine

# Install OpenSSL and other required libraries for Prisma
RUN apk add --no-cache openssl openssl-dev

WORKDIR /app

# Copy root package.json and tsconfig.json for workspace support
COPY package.json ./
COPY package-lock.json* ./
COPY tsconfig.json ./

# Copy built packages from builder stage
COPY --from=builder /app/packages ./packages

# Copy service package.json
COPY services/core-api/package*.json ./services/core-api/

# Install dependencies from root using workspaces
RUN npm install --omit=dev --workspace=services/core-api && npm cache clean --force

WORKDIR /app/services/core-api

# Copy Prisma schema and generate client in production stage
COPY --from=builder /app/services/core-api/prisma ./prisma
RUN npx prisma generate

# Copy built application
COPY --from=builder /app/services/core-api/dist ./dist

# Expose port
EXPOSE 3001

# Start application
CMD ["node", "dist/services/core-api/src/main"]
