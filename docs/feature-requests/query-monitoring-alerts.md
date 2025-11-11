# Feature Request: Query Monitoring & Alerting

**Status**: 📋 Backlog  
**Priority**: P2 (Nice to Have)  
**Category**: Observability / Security  
**Estimated Effort**: Medium (3-5 days)

---

## User Story

**As a** platform engineer or security team member,  
**I want** automated monitoring and alerting for queries that might indicate tenant isolation violations or performance issues,  
**So that** I can detect potential security issues or data leaks early and respond proactively.

---

## Background

While we have comprehensive tenant isolation at multiple layers (application, middleware, RLS), monitoring can help detect:
1. **Unusual query patterns** that might indicate attempted cross-tenant access
2. **Missing tenant filters** that bypass middleware
3. **Performance issues** from large datasets
4. **Anomalous query volumes** that might indicate abuse

**Current state**: We have violation logging in `OkrTenantGuard`, but no proactive monitoring or alerting.

---

## Acceptance Criteria

### 1. Query Size Monitoring
- [ ] Monitor queries that return unusually large datasets (>1000 records for a single tenant)
- [ ] Alert when a query returns more records than expected for a tenant
- [ ] Log query details (model, action, tenant context, result count)

### 2. Missing Tenant Filter Detection
- [ ] Detect Prisma queries that don't include `organizationId` filter on tenant-scoped models
- [ ] Flag queries that bypass middleware (write operations should be validated)
- [ ] Log query details with warning level

### 3. Query Pattern Analysis
- [ ] Track query frequency per tenant (detect unusual spikes)
- [ ] Monitor cross-tenant access attempts (even if blocked)
- [ ] Track SUPERUSER query patterns (read-only enforcement)

### 4. Alerting Integration
- [ ] Integrate with external monitoring service (Sentry, Datadog, CloudWatch, etc.)
- [ ] Create alert rules for:
  - Large dataset queries (>1000 records)
  - Missing tenant filters (critical)
  - Unusual query patterns (anomaly detection)
  - Repeated violation attempts (potential attack)

### 5. Dashboard & Reporting
- [ ] Create monitoring dashboard (optional: Grafana, DataDog, etc.)
- [ ] Daily/weekly reports on query patterns
- [ ] Security incident reports for violation attempts

---

## Implementation Approach

### Phase 1: Prisma Query Logging Middleware

```typescript
// common/prisma/query-monitoring.middleware.ts
export function createQueryMonitoringMiddleware() {
  return async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => {
    const startTime = Date.now();
    const tenantContext = getTenantContext();
    
    try {
      const result = await next(params);
      
      // Monitor query size
      const resultCount = Array.isArray(result) ? result.length : (result ? 1 : 0);
      
      // Check for missing tenant filter
      const isTenantScoped = tenantScopedModels.includes(params.model || '');
      const hasTenantFilter = params.args?.where?.organizationId !== undefined;
      
      if (isTenantScoped && !hasTenantFilter && params.action === 'findMany') {
        logger.warn('[QUERY_MONITORING] Missing tenant filter', {
          model: params.model,
          action: params.action,
          tenantContext,
        });
        
        // Send to monitoring service
        monitoringService.recordMissingTenantFilter({
          model: params.model,
          action: params.action,
          tenantContext,
        });
      }
      
      // Alert on large datasets
      if (resultCount > 1000) {
        logger.warn('[QUERY_MONITORING] Large dataset query', {
          model: params.model,
          action: params.action,
          resultCount,
          tenantContext,
        });
        
        monitoringService.recordLargeDatasetQuery({
          model: params.model,
          resultCount,
          tenantContext,
        });
      }
      
      return result;
    } catch (error) {
      // Log query errors
      logger.error('[QUERY_MONITORING] Query error', {
        model: params.model,
        action: params.action,
        error: error.message,
        tenantContext,
      });
      throw error;
    }
  };
}
```

### Phase 2: Monitoring Service

```typescript
// common/monitoring/monitoring.service.ts
@Injectable()
export class MonitoringService {
  constructor(
    private prisma: PrismaService,
    // Optional: external monitoring service
    // private sentry: SentryService,
    // private datadog: DatadogService,
  ) {}
  
  async recordMissingTenantFilter(data: {
    model: string;
    action: string;
    tenantContext: string | null | undefined;
  }) {
    // Log to database or external service
    await this.prisma.monitoringEvent.create({
      data: {
        type: 'MISSING_TENANT_FILTER',
        severity: 'HIGH',
        metadata: data,
      },
    });
    
    // Optional: Send to external service
    // await this.sentry.captureMessage('Missing tenant filter', 'warning');
  }
  
  async recordLargeDatasetQuery(data: {
    model: string;
    resultCount: number;
    tenantContext: string | null | undefined;
  }) {
    // Similar implementation
  }
}
```

### Phase 3: Alert Rules

```typescript
// common/monitoring/alert-rules.ts
export const ALERT_RULES = {
  MISSING_TENANT_FILTER: {
    threshold: 1, // Alert on first occurrence
    severity: 'CRITICAL',
    message: 'Tenant filter missing on tenant-scoped query',
  },
  LARGE_DATASET: {
    threshold: 1000, // Alert if >1000 records
    severity: 'WARNING',
    message: 'Query returned unusually large dataset',
  },
  REPEATED_VIOLATIONS: {
    threshold: 5, // Alert if 5 violations in 1 hour
    severity: 'HIGH',
    message: 'Multiple tenant isolation violation attempts detected',
  },
};
```

---

## Benefits

1. **Early Detection**: Catch potential security issues before they become incidents
2. **Performance Monitoring**: Identify queries that might impact performance
3. **Compliance**: Audit trail for security and compliance requirements
4. **Proactive Response**: Alert on suspicious patterns before damage occurs

---

## Risks & Considerations

1. **Performance Overhead**: Monitoring adds latency to queries (minimal if done correctly)
2. **Alert Fatigue**: Too many alerts can desensitize team
3. **False Positives**: Need to tune thresholds to avoid noise
4. **External Service Dependency**: If using external monitoring, consider downtime scenarios

---

## Integration Options

### Option 1: Internal Logging (Simple)
- Log to database (`monitoring_events` table)
- Query for reports
- Manual alert checks

### Option 2: Sentry Integration (Recommended)
- Automatic error tracking
- Performance monitoring
- Alert rules configuration

### Option 3: Datadog/CloudWatch (Enterprise)
- Full observability stack
- Custom dashboards
- Advanced alerting

---

## Metrics to Track

1. **Query Volume**: Requests per tenant per hour
2. **Query Size**: Average and max result counts
3. **Missing Filters**: Count of queries without tenant filters
4. **Violation Attempts**: Count of tenant isolation violations
5. **Query Performance**: Average query duration by model

---

## Related Documentation

- `services/core-api/src/modules/okr/tenant-guard.ts` - Current violation logging
- `docs/audit/TENANT_ISOLATION_RECOMMENDATIONS.md` - Phase 4, item #13
- `services/core-api/src/common/prisma/tenant-isolation.middleware.ts` - Current middleware

---

## Notes

- Start with internal logging, then add external monitoring as needed
- Consider cost implications of external monitoring services
- Set up alerting rules carefully to avoid false positives
- Review and adjust thresholds based on actual usage patterns

---

## Future Enhancements

- Machine learning for anomaly detection
- Automated response actions (e.g., rate limiting)
- Integration with SIEM systems
- Real-time query analysis dashboard




