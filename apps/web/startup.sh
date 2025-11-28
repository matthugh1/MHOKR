#!/bin/sh
# Startup script for Azure App Service
# Ensures we are in the correct directory before starting the server

echo "Starting OKR Nexus Web App..."
echo "Current directory: $(pwd)"

# Navigate to the web app directory where server.js is located
cd apps/web
echo "Changed directory to: $(pwd)"

# Debug: List files to verify structure
echo "Directory structure:"
find . -maxdepth 3 -not -path '*/node_modules/*'

# Start the server
# We use node directly as server.js is the entry point for standalone build
exec node server.js
