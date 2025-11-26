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
RUN npm install --legacy-peer-deps

WORKDIR /app/apps/web
COPY apps/web ./

# Ensure public directory exists (create if missing)
RUN mkdir -p ./public

# Create .next directory for backend-tag.json (if scripts need it)
RUN mkdir -p ./.next

# Create stub files for build scripts (they'll be populated after deployment)
RUN echo '{"backendGitTag":null}' > ./.next/backend-tag.json && \
    echo '{"appVersion":"docker-build","buildTimestamp":"'$(date -Iseconds)'","backendGitTag":null}' > ./public/version.json

# Build the application with standalone output
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build:docker

# Production image using standalone output
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone server
COPY --from=builder /app/apps/web/.next/standalone ./

# Copy static files (these must be served alongside the app)
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

# Copy public directory
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 5173

ENV PORT=5173
ENV HOSTNAME="0.0.0.0"

# Run the standalone server
CMD ["node", "apps/web/server.js"]
