# Feedback API Documentation

## Overview

The Feedback API allows users to submit feedback and administrators to manage it. All endpoints require authentication and admin/superuser permissions (except POST).

## Database Schema

The `Feedback` model includes:
- `id` - Unique identifier
- `userId` - User who submitted the feedback
- `tenantId` - Organization/tenant the feedback belongs to
- `message` - Feedback message text
- `pageUrl` - URL where feedback was submitted
- `userAgent` - Browser user agent
- `errors` - JSON array of captured errors (optional)
- `metadata` - JSON object with additional context (optional)
- `resolved` - Boolean flag indicating if feedback has been resolved (default: false)
- `createdAt` - Timestamp when feedback was created
- `updatedAt` - Timestamp when feedback was last updated

## API Endpoints

### 1. Submit Feedback
**POST** `/api/feedback`

Submit new feedback (available to all authenticated users).

**Request Body:**
```json
{
  "message": "This feature is great!",
  "pageUrl": "https://app.example.com/dashboard",
  "userAgent": "Mozilla/5.0...",
  "errors": [],
  "metadata": {
    "screenWidth": 1920,
    "screenHeight": 1080
  }
}
```

**Response:** Created feedback object with user information.

---

### 2. Get All Feedback
**GET** `/api/feedback`

Get all feedback with optional filters (admin/superuser only).

**Query Parameters:**
- `resolved` (boolean, optional) - Filter by resolved status
- `tenantId` (string, optional) - Filter by tenant ID
- `userId` (string, optional) - Filter by user ID
- `limit` (number, optional) - Limit number of results
- `offset` (number, optional) - Offset for pagination

**Examples:**
```bash
# Get all unresolved feedback
GET /api/feedback?resolved=false

# Get resolved feedback for a specific tenant
GET /api/feedback?resolved=true&tenantId=abc123

# Get feedback with pagination
GET /api/feedback?limit=10&offset=0

# Get feedback from a specific user
GET /api/feedback?userId=user123
```

**Response:** Array of feedback objects with user information.

---

### 3. Get Feedback Statistics
**GET** `/api/feedback/stats`

Get feedback statistics (admin/superuser only).

**Response:**
```json
{
  "total": 150,
  "resolved": 120,
  "unresolved": 30,
  "resolutionRate": 80.0
}
```

---

### 4. Get Feedback by ID
**GET** `/api/feedback/:id`

Get a specific feedback item by ID (admin/superuser only).

**Path Parameters:**
- `id` - Feedback ID

**Response:** Feedback object with user information.

---

### 5. Update Feedback
**PATCH** `/api/feedback/:id`

Update feedback (admin/superuser only). Useful for marking as resolved.

**Path Parameters:**
- `id` - Feedback ID

**Request Body:**
```json
{
  "resolved": true,
  "message": "Updated message (optional)"
}
```

**Fields:**
- `resolved` (boolean, optional) - Mark as resolved/unresolved
- `message` (string, optional) - Update the message
- `pageUrl` (string, optional) - Update the page URL

**Example - Mark as resolved:**
```bash
PATCH /api/feedback/abc123
{
  "resolved": true
}
```

**Response:** Updated feedback object.

---

### 6. Delete Feedback
**DELETE** `/api/feedback/:id`

Delete feedback (admin/superuser only).

**Path Parameters:**
- `id` - Feedback ID

**Response:**
```json
{
  "message": "Feedback deleted successfully"
}
```

---

## Usage Examples

### Mark feedback as resolved
```bash
curl -X PATCH http://localhost:3001/api/feedback/feedback123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resolved": true}'
```

### Get unresolved feedback
```bash
curl -X GET "http://localhost:3001/api/feedback?resolved=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get feedback statistics
```bash
curl -X GET http://localhost:3001/api/feedback/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Delete feedback
```bash
curl -X DELETE http://localhost:3001/api/feedback/feedback123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Permissions

- **POST** `/feedback` - All authenticated users
- **GET** `/feedback` - Requires `manage_users` action (admin/superuser)
- **GET** `/feedback/stats` - Requires `manage_users` action
- **GET** `/feedback/:id` - Requires `manage_users` action
- **PATCH** `/feedback/:id` - Requires `manage_users` action
- **DELETE** `/feedback/:id` - Requires `manage_users` action

## Tenant Isolation

- Superusers can see all feedback across all tenants
- Regular admins can only see feedback from their own tenant
- Users can only submit feedback (not view or manage it)

## Migration

To apply the database changes, run:
```bash
cd services/core-api
npx prisma migrate dev
```

This will add the `resolved` and `updatedAt` fields to the feedback table.

