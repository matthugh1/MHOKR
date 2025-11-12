# Check-ins API

The Check-ins API provides endpoints for viewing check-in history and identifying overdue check-ins for Key Results.

## Endpoints

### GET /key-results/:id/check-ins

Returns paginated check-in history for a specific Key Result, ordered by creation date (newest first).

**Parameters:**
- `id` (path): Key Result ID
- `page` (query, optional): Page number (default: 1, minimum: 1)
- `limit` (query, optional): Items per page (default: 20, maximum: 50)

**RBAC:** Requires `view_okr` permission and visibility access to the parent objective.

**Tenant Isolation:** Results are scoped to the user's tenant via parent objective.

**Rate Limiting:** Protected by `RateLimitGuard` (30 requests per minute per user).

### GET /reports/check-ins/overdue

Returns Key Results that are due or overdue for check-ins based on their `checkInCadence`.

**Parameters:**
- `cycleId` (query, optional): Filter by cycle ID
- `ownerId` (query, optional): Filter by owner user ID
- `teamId` (query, optional): Filter by team ID
- `pillarId` (query, optional): Filter by strategic pillar ID
- `limit` (query, optional): Maximum number of results (default: 50, max: 100)

**RBAC:** Requires `view_okr` permission.

**Tenant Isolation:** Results are scoped to the user's tenant.

**Cadence Rules:**
- `WEEKLY`: 7 days
- `BIWEEKLY`: 14 days
- `MONTHLY`: 30 days
- Grace period: 2 days (configurable via `OKR_CHECKIN_GRACE_DAYS` env var)

**Rate Limiting:** Protected by `RateLimitGuard` (30 requests per minute per user).

## Check-in Cadence

Key Results can have a `checkInCadence` field set to `WEEKLY`, `BIWEEKLY`, `MONTHLY`, or `NONE`. The system uses this to determine when check-ins are due or overdue:

- **Due**: `daysSinceLastCheckIn >= cadenceDays`
- **Overdue**: `daysSinceLastCheckIn > cadenceDays + graceDays`

## Automated Reminders

The system includes an automated reminder scheduler that sends notifications to Key Result owners when check-ins are due or overdue.

**Feature Flag:** Controlled by `OKR_CHECKIN_REMINDERS_ENABLED` (default: `false`)

**Configuration:**
- `OKR_CHECKIN_REMINDERS_ENABLED`: Enable/disable reminders (default: `false`)
- `OKR_CHECKIN_GRACE_DAYS`: Grace period in days before marking overdue (default: `2`)
- `OKR_CHECKIN_CRON`: Cron schedule for reminder job (default: daily at 9 AM)

**Behavior:**
- Runs daily (configurable via `OKR_CHECKIN_CRON`)
- Only processes KRs with cadence set (not `NONE`)
- Idempotent: Won't send duplicate reminders within 24 hours
- Multi-tenant safe: Processes each tenant separately
- Respects RBAC/visibility: Only notifies users who can view the KR

See [CHECKIN_REMINDER_IMPLEMENTATION.md](../CHECKIN_REMINDER_IMPLEMENTATION.md) for detailed implementation notes.


