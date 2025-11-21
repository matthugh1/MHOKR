# Viva Goals Feature Gaps - API Documentation Updates

**Date:** 2025-01-27  
**Version:** 1.0  
**Status:** ✅ Complete

---

## Overview

This document describes the API changes made to support Viva Goals feature gaps. All endpoints now support new fields for GoalType, Creator tracking, Team assignment, and Progress tracking.

---

## New Fields Summary

### Objective Endpoints

**New Fields:**
- `goalType` (enum: `ASPIRATIONAL` | `COMMITTED`) - Optional, defaults to `ASPIRATIONAL`
- `createdBy` (string) - Auto-populated from authenticated user, optional override

**Updated Status Values:**
- Added `NOT_STARTED` to `OKRStatus` enum

### Key Result Endpoints

**New Fields:**
- `goalType` (enum: `ASPIRATIONAL` | `COMMITTED`) - Optional, defaults to `ASPIRATIONAL`
- `createdBy` (string) - Auto-populated from authenticated user, optional override
- `teamId` (string | null) - Optional, inherits from parent Objective if not specified

**Updated Status Values:**
- Added `NOT_STARTED` to `OKRStatus` enum

### Initiative Endpoints

**New Fields:**
- `goalType` (enum: `ASPIRATIONAL` | `COMMITTED`) - Optional, defaults to `ASPIRATIONAL`
- `createdBy` (string) - Auto-populated from authenticated user, optional override
- `teamId` (string | null) - Optional, inherits from parent Objective/KeyResult if not specified
- `progress` (number | null) - Optional, 0-100, percentage progress

---

## Endpoint Details

### POST /objectives

**Request Body:**
```json
{
  "title": "Reduce customer churn",
  "ownerId": "user-123",
  "cycleId": "cycle-456",
  "tenantId": "org-789",
  "goalType": "COMMITTED",  // NEW: Optional, defaults to "ASPIRATIONAL"
  "createdBy": "user-123",   // NEW: Optional, auto-populated from auth token
  "status": "NOT_STARTED",   // NEW: Added to enum
  "visibilityLevel": "PUBLIC_TENANT"
}
```

**Response:**
```json
{
  "id": "objective-123",
  "title": "Reduce customer churn",
  "goalType": "COMMITTED",
  "createdBy": "user-123",
  "status": "NOT_STARTED",
  "progress": 0,
  "ownerId": "user-123",
  "cycleId": "cycle-456",
  "tenantId": "org-789",
  "createdAt": "2025-01-27T10:00:00Z",
  "updatedAt": "2025-01-27T10:00:00Z"
}
```

### PATCH /objectives/:id

**Request Body:**
```json
{
  "goalType": "COMMITTED",  // NEW: Can be updated
  "status": "NOT_STARTED"   // NEW: Can be set to NOT_STARTED
}
```

### POST /key-results

**Request Body:**
```json
{
  "title": "Reduce churn to 5%",
  "objectiveId": "objective-123",
  "ownerId": "user-123",
  "cycleId": "cycle-456",
  "metricType": "PERCENTAGE",
  "startValue": 10,
  "targetValue": 5,
  "goalType": "COMMITTED",  // NEW: Optional, defaults to "ASPIRATIONAL"
  "teamId": "team-789",      // NEW: Optional, inherits from Objective if not specified
  "createdBy": "user-123",   // NEW: Optional, auto-populated from auth token
  "status": "NOT_STARTED"    // NEW: Added to enum
}
```

**Response:**
```json
{
  "id": "kr-123",
  "title": "Reduce churn to 5%",
  "goalType": "COMMITTED",
  "teamId": "team-789",
  "createdBy": "user-123",
  "status": "NOT_STARTED",
  "progress": 0,
  "ownerId": "user-123",
  "objectiveId": "objective-123",
  "cycleId": "cycle-456",
  "createdAt": "2025-01-27T10:00:00Z",
  "updatedAt": "2025-01-27T10:00:00Z"
}
```

### PATCH /key-results/:id

**Request Body:**
```json
{
  "goalType": "ASPIRATIONAL",  // NEW: Can be updated
  "teamId": "team-789",         // NEW: Can be updated (validated for tenant match)
  "status": "NOT_STARTED"        // NEW: Can be set to NOT_STARTED
}
```

**Validation:**
- `teamId` must belong to a team in the same tenant (via workspace)
- `teamId` can be set to `null` to clear team assignment

### POST /initiatives

**Request Body:**
```json
{
  "title": "Implement customer feedback system",
  "objectiveId": "objective-123",
  "ownerId": "user-123",
  "goalType": "COMMITTED",  // NEW: Optional, defaults to "ASPIRATIONAL"
  "teamId": "team-789",     // NEW: Optional, inherits from Objective/KeyResult if not specified
  "progress": 75,            // NEW: Optional, 0-100 percentage
  "createdBy": "user-123",  // NEW: Optional, auto-populated from auth token
  "status": "IN_PROGRESS"
}
```

**Response:**
```json
{
  "id": "initiative-123",
  "title": "Implement customer feedback system",
  "goalType": "COMMITTED",
  "teamId": "team-789",
  "progress": 75,
  "createdBy": "user-123",
  "status": "IN_PROGRESS",
  "ownerId": "user-123",
  "objectiveId": "objective-123",
  "createdAt": "2025-01-27T10:00:00Z",
  "updatedAt": "2025-01-27T10:00:00Z"
}
```

### PATCH /initiatives/:id

**Request Body:**
```json
{
  "goalType": "ASPIRATIONAL",  // NEW: Can be updated
  "teamId": "team-789",         // NEW: Can be updated (validated for tenant match)
  "progress": 90,               // NEW: Can be updated (validated 0-100)
  "status": "COMPLETED"
}
```

**Validation:**
- `progress` must be between 0 and 100 (inclusive)
- `teamId` must belong to a team in the same tenant (via workspace)
- `teamId` can be set to `null` to clear team assignment

### POST /okr/create-composite

**Request Body:**
```json
{
  "objective": {
    "title": "Reduce customer churn",
    "ownerUserId": "user-123",
    "cycleId": "cycle-456",
    "goalType": "COMMITTED",  // NEW: Optional, defaults to "ASPIRATIONAL"
    "visibilityLevel": "PUBLIC_TENANT"
  },
  "keyResults": [
    {
      "title": "Reduce churn to 5%",
      "metricType": "PERCENT",
      "targetValue": 5,
      "ownerUserId": "user-123",
      "startValue": 10,
      "goalType": "COMMITTED",  // NEW: Optional, defaults to "ASPIRATIONAL"
      "teamId": "team-789"       // NEW: Optional, inherits from Objective if not specified
    }
  ]
}
```

**Response:**
```json
{
  "objectiveId": "objective-123",
  "keyResultIds": ["kr-123"],
  "publishState": "PUBLISHED",
  "status": "ON_TRACK",
  "visibilityLevel": "PUBLIC_TENANT"
}
```

**Behavior:**
- `createdBy` is auto-populated for Objective and all Key Results from the authenticated user
- Key Results inherit `teamId` from Objective if not specified
- Key Results inherit `goalType` default (ASPIRATIONAL) if not specified

---

## Field Inheritance Rules

### Key Results
- **teamId**: Inherits from parent Objective if not explicitly provided
- **goalType**: Defaults to `ASPIRATIONAL` if not provided (does not inherit from Objective)
- **createdBy**: Auto-populated from authenticated user

### Initiatives
- **teamId**: Inherits from parent Objective or KeyResult if not explicitly provided
- **goalType**: Defaults to `ASPIRATIONAL` if not provided
- **createdBy**: Auto-populated from authenticated user
- **progress**: No inheritance, must be explicitly set

---

## Validation Rules

### GoalType
- Must be one of: `ASPIRATIONAL`, `COMMITTED`
- Defaults to `ASPIRATIONAL` if not provided
- Can be updated after creation

### createdBy
- Auto-populated from authenticated user ID
- Can be explicitly set (useful for imports)
- Must reference a valid User ID

### teamId
- Optional field
- Must reference a valid Team ID
- Team must belong to a workspace in the same tenant
- Can be set to `null` to clear assignment
- Validated on create and update

### progress (Initiatives only)
- Optional field
- Must be a number between 0 and 100 (inclusive)
- Can be `null` or `undefined`
- Validated on create and update

### Status
- `NOT_STARTED` is now a valid value for Objectives and Key Results
- Can be set on creation or updated later

---

## Error Responses

### Invalid GoalType
```json
{
  "statusCode": 400,
  "message": "Invalid goalType. Must be one of: ASPIRATIONAL, COMMITTED",
  "error": "Bad Request"
}
```

### Invalid Team
```json
{
  "statusCode": 404,
  "message": "Team with ID team-123 not found or does not belong to the same tenant",
  "error": "Not Found"
}
```

### Invalid Progress
```json
{
  "statusCode": 400,
  "message": "Progress must be a number between 0 and 100",
  "error": "Bad Request"
}
```

### Invalid Status
```json
{
  "statusCode": 400,
  "message": "Invalid status. Must be one of: NOT_STARTED, ON_TRACK, AT_RISK, OFF_TRACK, BLOCKED, COMPLETED, CANCELLED",
  "error": "Bad Request"
}
```

---

## Migration Notes

### Backward Compatibility
- All new fields are optional
- Existing API calls continue to work without modification
- Default values are applied automatically:
  - `goalType`: `ASPIRATIONAL`
  - `createdBy`: Authenticated user ID
  - `teamId`: Inherited from parent (for KRs/Initiatives) or `null`
  - `progress`: `null` (for Initiatives)

### Database Migration
- Migration `20250127_add_viva_goals_feature_gaps` adds all new fields
- Backfill logic populates `createdBy` from activities table
- Backfill logic populates `teamId` via inheritance rules

---

## Swagger Documentation

The Swagger documentation at `/api/docs` has been automatically updated with:
- New request/response fields
- Updated enum values
- Field descriptions and validation rules

---

## Example Requests

### Create Committed Objective
```bash
curl -X POST http://localhost:3001/objectives \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Achieve 95% customer satisfaction",
    "ownerId": "user-123",
    "cycleId": "cycle-456",
    "tenantId": "org-789",
    "goalType": "COMMITTED",
    "status": "NOT_STARTED"
  }'
```

### Create Key Result with Team
```bash
curl -X POST http://localhost:3001/key-results \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Increase NPS to 50",
    "objectiveId": "objective-123",
    "ownerId": "user-123",
    "cycleId": "cycle-456",
    "metricType": "PERCENTAGE",
    "startValue": 30,
    "targetValue": 50,
    "goalType": "COMMITTED",
    "teamId": "team-789",
    "status": "NOT_STARTED"
  }'
```

### Create Initiative with Progress
```bash
curl -X POST http://localhost:3001/initiatives \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Launch customer feedback portal",
    "objectiveId": "objective-123",
    "ownerId": "user-123",
    "goalType": "COMMITTED",
    "teamId": "team-789",
    "progress": 75,
    "status": "IN_PROGRESS"
  }'
```

---

## Testing

See `services/core-api/src/modules/okr/__tests__/viva-goals-features.spec.ts` for integration tests covering all new fields.

See `services/core-api/test/okr.createComposite.e2e.spec.ts` for E2E tests including new fields.

---

**Last Updated:** 2025-01-27  
**API Version:** 1.0

