# Check-in Reminder System Implementation Summary

## Overview
Automated check-in reminders for Key Results based on `checkInCadence` (WEEKLY|BIWEEKLY|MONTHLY|NONE). The system runs a scheduled job that identifies due/overdue KRs and sends reminders to owners via a notification port.

## Implementation Phases

### Phase 1 — Discovery ✅
**Quoted Code Sections:**
- KR model: `checkInCadence` field (enum: WEEKLY, BIWEEKLY, MONTHLY, NONE)
- CheckIn model: `createdAt` timestamp (used to derive `lastCheckInAt`)
- Existing overdue logic pattern in `okr-reporting.service.ts` (lines 968-997)
- Config pattern: `@nestjs/config` with `ConfigService.get<string>('KEY')`
- No existing scheduler in `core-api` (Bull/BullMQ only in `integration-service`)
- No notification service found → created `NotificationPort` interface

### Phase 2 — Design ✅
- **Scheduler**: `@nestjs/schedule` (standard NestJS cron)
- **Due/Overdue Rules**:
  - WEEKLY = 7 days; BIWEEKLY = 14; MONTHLY = 30 days
  - graceDays = 2 (configurable via `OKR_CHECKIN_GRACE_DAYS`)
  - Due: `daysSinceLastCheckIn >= cadenceDays`
  - Overdue: `daysSinceLastCheckIn > cadenceDays + graceDays`
- **Target**: KR `ownerId` (owner receives reminder)
- **Idempotency**: Track reminders sent per KR+period (24h cooldown via Activity table)
- **Feature Flag**: `OKR_CHECKIN_REMINDERS_ENABLED=true|false`
- **Cron Schedule**: Daily at 9 AM (configurable via `OKR_CHECKIN_CRON`)

### Phase 3 — Patches ✅

#### A) Domain/Service
**File**: `services/core-api/src/modules/okr/check-in-reminder.service.ts`
- `findDueCheckIns()`: Queries KRs with cadence, calculates due/overdue, groups by tenant
- `sendRemindersForTenant()`: Sends reminders with idempotency check (24h cooldown)
- `processAllReminders()`: Processes all tenants, returns stats

#### B) Scheduler
**File**: `services/core-api/src/modules/okr/check-in-reminder.scheduler.ts`
- `@Cron()` decorator runs daily at 9 AM (configurable)
- Calls `processAllReminders()` and logs results

#### C) Notification
**Files**:
- `services/core-api/src/modules/okr/notification.port.ts` - Interface
- `services/core-api/src/modules/okr/logging-notification.adapter.ts` - Logging adapter (default)
- Wired via dependency injection in `okr.module.ts`

#### D) Persistence
**File**: `services/core-api/prisma/schema.prisma`
- Added `REMINDER_SENT` to `ActivityAction` enum
- Migration: `20251107100000_add_reminder_sent_action/migration.sql`
- Idempotency: Activity records with `action='REMINDER_SENT'` and 24h cooldown check

#### E) RBAC/Visibility
- Tenant isolation: Queries filtered by tenantId via parent Objective
- Only active KRs (not COMPLETED/CANCELLED) are considered
- Owner must exist (skips if owner not found)

### Phase 4 — Tests ✅
**File**: `services/core-api/src/modules/okr/__tests__/check-in-reminder.service.spec.ts`
- Unit tests for due/overdue calculation (WEEKLY, BIWEEKLY, MONTHLY)
- Edge cases: cadence NONE, null cadence, COMPLETED/CANCELLED KRs
- Idempotency tests (24h cooldown)
- Notification port integration tests
- Feature flag disabled test

### Phase 5 — Config & Ops ✅

#### Environment Variables
```bash
# Enable/disable check-in reminders (default: false)
OKR_CHECKIN_REMINDERS_ENABLED=true

# Grace period in days before marking overdue (default: 2)
OKR_CHECKIN_GRACE_DAYS=2

# Cron schedule (default: daily at 9 AM)
# Format: cron string or CronExpression constant
OKR_CHECKIN_CRON="0 9 * * *"
```

#### Observability
- Logger: `CheckInReminderService` and `CheckInReminderScheduler` log:
  - Job start/completion with stats (remindersSent, tenantsProcessed)
  - Errors during processing
  - Skipped reminders (idempotency, missing owner)
- Activity records: Each reminder creates an Activity entry with metadata

## Files Created/Modified

### Created Files
1. `services/core-api/src/modules/okr/check-in-reminder.service.ts`
2. `services/core-api/src/modules/okr/check-in-reminder.scheduler.ts`
3. `services/core-api/src/modules/okr/notification.port.ts`
4. `services/core-api/src/modules/okr/logging-notification.adapter.ts`
5. `services/core-api/src/modules/okr/__tests__/check-in-reminder.service.spec.ts`
6. `services/core-api/prisma/migrations/20251107100000_add_reminder_sent_action/migration.sql`

### Modified Files
1. `services/core-api/src/app.module.ts` - Added `ScheduleModule.forRoot()`
2. `services/core-api/src/modules/okr/okr.module.ts` - Registered reminder services and notification adapter
3. `services/core-api/prisma/schema.prisma` - Added `REMINDER_SENT` to `ActivityAction` enum
4. `services/core-api/package.json` - Added `@nestjs/schedule` dependency

## Usage

### Enable Reminders
Set in `.env`:
```bash
OKR_CHECKIN_REMINDERS_ENABLED=true
OKR_CHECKIN_GRACE_DAYS=2
OKR_CHECKIN_CRON="0 9 * * *"  # Daily at 9 AM
```

### Replace Notification Adapter
In `okr.module.ts`, replace `LoggingNotificationAdapter` with your implementation:
```typescript
{
  provide: NotificationPort,
  useClass: EmailNotificationAdapter, // or InAppNotificationAdapter
},
```

### Manual Trigger (for testing)
```typescript
// In a controller or script
await checkInReminderService.processAllReminders();
```

## Future Enhancements
- Email notification adapter (replace logging adapter)
- In-app notification adapter
- Configurable reminder templates
- Reminder preferences per user (opt-out)
- Escalation to managers for overdue KRs
- Metrics/telemetry integration

