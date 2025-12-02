#!/bin/bash

# Test script to verify /me/summary endpoint returns data
# Usage: ./test-me-summary.sh <email> <password>

EMAIL="${1:-frederic.laziou@puzzel.com}"
PASSWORD="${2}"
API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3001}"

echo "Testing /me/summary endpoint for user: $EMAIL"
echo "API URL: $API_URL"
echo ""

# Step 1: Login to get token
echo "Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

echo "Login response:"
echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
echo ""

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token' 2>/dev/null)

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get token. Please check credentials."
  exit 1
fi

echo "Token obtained: ${TOKEN:0:50}..."
echo ""

# Step 2: Call /me/summary
echo "Step 2: Calling /me/summary..."
SUMMARY_RESPONSE=$(curl -s -X GET "$API_URL/me/summary" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

echo "Summary response:"
echo "$SUMMARY_RESPONSE" | jq '.' 2>/dev/null || echo "$SUMMARY_RESPONSE"
echo ""

# Extract key fields
echo "=== Data Summary ==="
echo "Owned Objectives: $(echo "$SUMMARY_RESPONSE" | jq '.ownedObjectives | length' 2>/dev/null || echo 'N/A')"
echo "Owned Key Results: $(echo "$SUMMARY_RESPONSE" | jq '.ownedKeyResults | length' 2>/dev/null || echo 'N/A')"
echo "Owned Initiatives: $(echo "$SUMMARY_RESPONSE" | jq '.ownedInitiatives | length' 2>/dev/null || echo 'N/A')"
echo "Owned Tasks: $(echo "$SUMMARY_RESPONSE" | jq '.ownedTasks | length' 2>/dev/null || echo 'N/A')"
echo "My Todos: $(echo "$SUMMARY_RESPONSE" | jq '.myTodos | length' 2>/dev/null || echo 'N/A')"
echo "Intelligence: $(echo "$SUMMARY_RESPONSE" | jq 'if .intelligence then "Present" else "Missing" end' 2>/dev/null || echo 'N/A')"
echo ""

# Show first few todos
echo "=== First 3 Todos ==="
echo "$SUMMARY_RESPONSE" | jq '.myTodos[0:3]' 2>/dev/null || echo "No todos or jq not available"
echo ""

# Show intelligence data
echo "=== Intelligence Data ==="
echo "$SUMMARY_RESPONSE" | jq '.intelligence' 2>/dev/null || echo "No intelligence data or jq not available"

