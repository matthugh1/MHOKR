# RBAC Rollback Notes

**Date:** 2025-01-27  
**Feature:** Centralised Permissions via AuthorisationService

---

## Emergency Rollback

If the centralised authorisation service causes issues, disable it via environment variable:

```bash
RBAC_AUTHZ_CENTRE=off
```

This will revert to the legacy RBAC path (`RBACService.canPerformAction()`).

---

## What Changes on Rollback

- **RBACGuard** falls back to legacy `rbacService.canPerformAction()` path
- **AuthorisationService** is bypassed (no longer called)
- All existing behaviour preserved (tenant isolation, visibility, publish locks still enforced via service layer)

---

## Rollback Checklist

1. Set `RBAC_AUTHZ_CENTRE=off` in environment
2. Restart application
3. Verify endpoints still work (guard will log which path is used)
4. Monitor logs for any anomalies

---

## Re-enabling

To re-enable after fixing issues:

```bash
RBAC_AUTHZ_CENTRE=on  # or unset (defaults to on)
```

---

## Notes

- Rollback is **immediate** (no code changes required)
- No database migrations needed
- No data loss risk
- Telemetry hook remains active (records deny events)

