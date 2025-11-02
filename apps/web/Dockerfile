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

# Now build the web app
WORKDIR /app/apps/web
COPY apps/web/package*.json ./
COPY apps/web/tsconfig.json ./
COPY apps/web/next.config.js ./

# Install dependencies from root (workspace packages are now available)
WORKDIR /app
RUN npm install

WORKDIR /app/apps/web
COPY apps/web ./

# Ensure public directory exists (create if missing)
RUN mkdir -p ./public

RUN npm run typecheck
RUN npm run build

FROM node:20-alpine

WORKDIR /app

# Copy root package.json and tsconfig.json for workspace support
COPY package.json ./
COPY package-lock.json* ./
COPY tsconfig.json ./

# Copy built packages from builder stage
COPY --from=builder /app/packages ./packages

# Copy web app package.json
COPY apps/web/package*.json ./apps/web/

# Install dependencies from root using workspaces
RUN npm install --omit=dev --workspace=apps/web && npm cache clean --force

WORKDIR /app/apps/web

# Copy built application
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/next.config.js ./

# Copy public directory (will exist from builder stage)
COPY --from=builder /app/apps/web/public ./public

EXPOSE 5173

CMD ["npm", "start"]




