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
WORKDIR /app/services/ai-service
COPY services/ai-service/package*.json ./
COPY services/ai-service/tsconfig*.json ./

# Install dependencies from root (workspace packages are now available)
WORKDIR /app
RUN npm install

WORKDIR /app/services/ai-service
COPY services/ai-service ./

RUN npm run build

FROM node:20-alpine

WORKDIR /app

# Copy root package.json and tsconfig.json for workspace support
COPY package.json ./
COPY package-lock.json* ./
COPY tsconfig.json ./

# Copy built packages from builder stage
COPY --from=builder /app/packages ./packages

# Copy service package.json
COPY services/ai-service/package*.json ./services/ai-service/

# Install dependencies from root using workspaces
RUN npm install --omit=dev --workspace=services/ai-service && npm cache clean --force

WORKDIR /app/services/ai-service

COPY --from=builder /app/services/ai-service/dist ./dist

EXPOSE 3002

CMD ["node", "dist/main"]
