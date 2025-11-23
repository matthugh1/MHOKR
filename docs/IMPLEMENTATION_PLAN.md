# Implementation Plan

**Date**: 2025-01-20  
**Status**: Draft  
**Timeline**: 3-4 months

---

## Executive Summary

This document provides a concrete, actionable delivery plan based on the comprehensive audit conducted on 2025-01-20. The plan is structured into 5 phases over approximately 3-4 months, addressing security, scalability, code quality, documentation organisation, and dependency management.

**Total Work Items**: 35  
**Phases**: 5  
**Estimated Duration**: 12-16 weeks

---

## 1. Phased Plan

### Phase 1: Security & Safety (Weeks 1-2)

**Objectives**:
- Eliminate critical security vulnerabilities
- Establish CI gates for security checks
- Remove hardcoded secrets and sensitive data exposure
- Ensure all endpoints have proper authorisation guards

**Entry Criteria**:
- Audit findings reviewed and approved
- Development team available
- CI/CD pipeline accessible

**Exit Criteria**:
- All P0 security issues resolved
- No default secret fallbacks in codebase
- No sensitive data in logs
- All endpoints protected with authorisation guards
- CI gates for security checks in place
- Security tests passing

**Duration**: 2 weeks

---

### Phase 2: Scalability & Performance Foundations (Weeks 3-6)

**Objectives**:
- Add pagination to all list endpoints
- Move filtering logic from JavaScript to database queries
- Add composite database indexes for common query patterns
- Optimise recursive hierarchy queries
- Implement query performance monitoring

**Entry Criteria**:
- Phase 1 complete and verified
- Database access available for index creation
- Performance testing environment ready

**Exit Criteria**:
- All `findAll()` methods support pagination
- Zero JavaScript filtering (all in database)
- Composite indexes added for common filter combinations
- Hierarchy queries optimised with CTEs
- Query performance monitoring implemented
- Performance benchmarks meet targets (p95 < 100ms)

**Duration**: 4 weeks

---

### Phase 3: Code Quality & Maintainability (Weeks 7-10)

**Objectives**:
- Replace console.log with structured logging throughout
- Improve type safety (reduce `any` usage from 576 to < 50)
- Extract shared utilities and eliminate code duplication
- Split large files (>1,000 lines) into focused modules
- Increase frontend test coverage

**Entry Criteria**:
- Phase 2 complete
- Logging library selected and configured
- TypeScript strict mode enabled

**Exit Criteria**:
- Structured logging implemented (Winston/Pino)
- Type safety improved (< 50 `any` usages)
- Shared utilities extracted (mapObjectiveData, permission hooks)
- Large files split (zero files > 1,000 lines)
- Frontend test coverage > 50%
- All code quality metrics improved

**Duration**: 4 weeks

---

### Phase 4: Scripts, Documentation & Repository Structure (Weeks 11-12)

**Objectives**:
- Organise 80+ root-level markdown files into `docs/` subdirectories
- Consolidate scripts into standardised locations
- Create clear documentation structure
- Update all references and links

**Entry Criteria**:
- Phase 3 complete
- Documentation structure approved
- Script migration plan reviewed

**Exit Criteria**:
- Zero markdown files at root (except README)
- All scripts in `scripts/` directory structure
- Clear documentation organisation
- All references updated
- README links verified

**Duration**: 2 weeks

---

### Phase 5: Dependency & Supply Chain Hardening (Weeks 13-14)

**Objectives**:
- Add automated dependency scanning to CI/CD
- Enable Dependabot/Renovate for automated updates
- Review and document license compliance
- Plan Prisma 6.x upgrade path
- Verify React 19 compatibility

**Entry Criteria**:
- Phase 4 complete
- CI/CD pipeline accessible
- Dependency scanning tools selected

**Exit Criteria**:
- `npm audit` integrated into CI/CD
- Dependabot/Renovate enabled and configured
- License compliance documented
- Prisma 6.x upgrade plan created
- React 19 compatibility verified
- Dependency scanning automated

**Duration**: 2 weeks

---

## 2. Work Breakdown

| ID | Phase | Category | Title | Priority | Effort | Source |
|----|-------|----------|-------|----------|--------|--------|
| SEC-001 | 1 | Security | Remove default secret fallback from JWT configuration | P0 | S | 02_SECURITY_REVIEW – High #1 |
| SEC-002 | 1 | Security | Sanitise logs to remove sensitive data (emails, user IDs) | P0 | M | 02_SECURITY_REVIEW – High #2 |
| SEC-003 | 1 | Security | Add RBACGuard to migration controller | P0 | S | 02_SECURITY_REVIEW – High #3 |
| SEC-004 | 1 | Security | Add RBACGuard to superuser controller | P0 | S | 02_SECURITY_REVIEW – High #3 |
| SEC-005 | 1 | Security | Remove hardcoded passwords from scripts and factories | P0 | S | 02_SECURITY_REVIEW – High #4 |
| SEC-006 | 1 | Security | Add startup validation for required environment variables | P0 | S | 02_SECURITY_REVIEW – Recommended Actions |
| SEC-007 | 1 | Security | Add CI gate for security checks (secret scanning, dependency audit) | P0 | M | 00_SUMMARY_AND_ACTION_PLAN – P0 #5 |
| PERF-001 | 2 | Scalability | Add pagination to `objective.service.findAll()` method | P1 | S | 03_SCALABILITY_REVIEW – High #1 |
| PERF-002 | 2 | Scalability | Add pagination to `key-result.service.findAll()` method | P1 | S | 03_SCALABILITY_REVIEW – High #1 |
| PERF-003 | 2 | Scalability | Move filtering from JavaScript to database queries in `okr-reporting.service.ts` | P1 | M | 03_SCALABILITY_REVIEW – High #3 |
| PERF-004 | 2 | Scalability | Move visibility filtering from JavaScript to database in `okr-overview.controller.ts` | P1 | M | 03_SCALABILITY_REVIEW – High #3 |
| PERF-005 | 2 | Scalability | Add composite database indexes for common filter combinations | P1 | S | 03_SCALABILITY_REVIEW – Medium #5 |
| PERF-006 | 2 | Scalability | Optimise recursive hierarchy queries using PostgreSQL CTEs | P1 | M | 03_SCALABILITY_REVIEW – High #4 |
| PERF-007 | 2 | Scalability | Implement query performance monitoring and slow query logging | P2 | M | 03_SCALABILITY_REVIEW – Medium-Term #2 |
| QUAL-001 | 3 | Code Quality | Implement structured logging (Winston/Pino) across all services | P1 | M | 04_CODE_QUALITY_AUDIT – Style #2, 02_SECURITY_REVIEW – Recommended Actions |
| QUAL-002 | 3 | Code Quality | Replace `req: any` with typed request interfaces in controllers | P1 | M | 04_CODE_QUALITY_AUDIT – Type Safety #3 |
| QUAL-003 | 3 | Code Quality | Reduce `any` type usage from 576 to < 50 instances | P1 | M | 04_CODE_QUALITY_AUDIT – Type Safety #3 |
| QUAL-004 | 3 | Code Quality | Extract `mapObjectiveData` utility to shared location | P1 | S | 04_CODE_QUALITY_AUDIT – Code Duplication #2 |
| QUAL-005 | 3 | Code Quality | Extract permission checks into reusable hooks | P1 | S | 04_CODE_QUALITY_AUDIT – Code Duplication #2 |
| QUAL-006 | 3 | Code Quality | Split `okr-overview.controller.ts` (1,128 lines) into focused controllers | P2 | L | 04_CODE_QUALITY_AUDIT – Large Files #1 |
| QUAL-007 | 3 | Code Quality | Split `okr-reporting.service.ts` (2,047 lines) into focused services | P2 | L | 04_CODE_QUALITY_AUDIT – Large Files #1 |
| QUAL-008 | 3 | Code Quality | Split `objective.service.ts` (2,196 lines) into focused services | P2 | L | 04_CODE_QUALITY_AUDIT – Large Files #1 |
| QUAL-009 | 3 | Code Quality | Split `apps/web/src/app/dashboard/okrs/page.tsx` (1,487 lines) into smaller components | P2 | L | 04_CODE_QUALITY_AUDIT – Large Files #1 |
| QUAL-010 | 3 | Code Quality | Increase frontend test coverage to > 50% | P2 | M | 04_CODE_QUALITY_AUDIT – Test Coverage |
| ARCH-001 | 3 | Architecture | Complete separation of reporting logic to `OkrReportingService` | P2 | M | 05_ARCHITECTURE_OVERVIEW – Domain Boundary Violations #1 |
| ARCH-002 | 3 | Architecture | Complete separation of governance logic to `OkrGovernanceService` | P2 | M | 05_ARCHITECTURE_OVERVIEW – Domain Boundary Violations #1 |
| DOCS-001 | 4 | Documentation | Move audit reports from root to `docs/audit/` | P1 | S | 06_SCRIPTS_AND_DOCS_AUDIT – Files Requiring Movement |
| DOCS-002 | 4 | Documentation | Move planning documents from root to `docs/planning/` | P1 | S | 06_SCRIPTS_AND_DOCS_AUDIT – Files Requiring Movement |
| DOCS-003 | 4 | Documentation | Move developer guides from root to `docs/developer/` | P1 | S | 06_SCRIPTS_AND_DOCS_AUDIT – Files Requiring Movement |
| DOCS-004 | 4 | Scripts | Consolidate admin scripts from `services/core-api/scripts/` to `scripts/admin/` | P1 | S | 06_SCRIPTS_AND_DOCS_AUDIT – Recommendations |
| DOCS-005 | 4 | Scripts | Organise import scripts into `scripts/import/` directory | P2 | S | 06_SCRIPTS_AND_DOCS_AUDIT – Recommendations |
| DOCS-006 | 4 | Scripts | Move audit scripts to `scripts/audit/` directory | P2 | S | 06_SCRIPTS_AND_DOCS_AUDIT – Recommendations |
| DOCS-007 | 4 | Documentation | Update all README links and references after file moves | P1 | S | 06_SCRIPTS_AND_DOCS_AUDIT – Recommendations |
| DEPS-001 | 5 | Dependencies | Add `npm audit` step to CI/CD pipeline | P2 | S | 07_DEPENDENCY_REVIEW – Recommended Actions |
| DEPS-002 | 5 | Dependencies | Enable Dependabot or Renovate for automated dependency updates | P2 | S | 07_DEPENDENCY_REVIEW – Recommended Actions |
| DEPS-003 | 5 | Dependencies | Review and document license compliance for all dependencies | P2 | S | 07_DEPENDENCY_REVIEW – License Compliance |
| DEPS-004 | 5 | Dependencies | Create Prisma 6.x upgrade plan and migration strategy | P3 | L | 07_DEPENDENCY_REVIEW – Upgrade Recommendations |
| DEPS-005 | 5 | Dependencies | Verify React 19 compatibility with all frontend dependencies | P2 | M | 07_DEPENDENCY_REVIEW – Areas for Review |

---

## 3. Suggested Team Ownership

### API/Backend Team

**Responsibilities**:
- Backend security fixes (SEC-001, SEC-002, SEC-003, SEC-004, SEC-005, SEC-006)
- Performance improvements (PERF-001 through PERF-007)
- Backend code quality (QUAL-001, QUAL-002, QUAL-003, QUAL-006, QUAL-007, QUAL-008)
- Architecture improvements (ARCH-001, ARCH-002)

**Work Items**: 20

**Key Skills Required**:
- NestJS/TypeScript expertise
- PostgreSQL/Prisma knowledge
- Security best practices
- Performance optimisation

---

### Frontend Team

**Responsibilities**:
- Frontend code quality improvements (QUAL-004, QUAL-005, QUAL-009, QUAL-010)
- Frontend security considerations (if any)
- React 19 compatibility verification (DEPS-005)

**Work Items**: 5

**Key Skills Required**:
- React/Next.js expertise
- TypeScript
- Testing (Jest, React Testing Library)
- UI/UX considerations

---

### Platform/DevOps Team

**Responsibilities**:
- CI/CD pipeline improvements (SEC-007, DEPS-001, DEPS-002)
- Infrastructure and tooling setup
- Dependency management automation
- Script consolidation (DOCS-004, DOCS-005, DOCS-006)

**Work Items**: 6

**Key Skills Required**:
- CI/CD pipeline expertise
- Infrastructure as code
- Automation tooling
- Script management

---

### Security Team (or Security-Focused Engineer)

**Responsibilities**:
- Security review and validation of all P0 fixes
- Security testing
- Security best practices guidance
- Secret scanning implementation

**Work Items**: Review and validate SEC-001 through SEC-007

**Key Skills Required**:
- Security expertise
- Penetration testing
- Security tooling
- Compliance knowledge

---

### Documentation/Technical Writing (or Shared Responsibility)

**Responsibilities**:
- Documentation organisation (DOCS-001, DOCS-002, DOCS-003, DOCS-007)
- Reference updates
- Documentation structure design

**Work Items**: 4

**Key Skills Required**:
- Technical writing
- Documentation organisation
- Git operations for file moves

---

## 4. Risk Assessment

### High Risk Items

- **SEC-001 (Remove default secret fallback)**: Must ensure environment variables are set in all environments
- **PERF-003, PERF-004 (Database filtering)**: Requires thorough testing to ensure functionality preserved
- **QUAL-006 through QUAL-009 (Large file splits)**: Requires careful refactoring to avoid breaking changes

### Medium Risk Items

- **PERF-006 (Hierarchy query optimisation)**: May affect functionality if not carefully implemented
- **QUAL-001 (Structured logging)**: Requires coordination across all services
- **DEPS-004 (Prisma 6.x upgrade)**: Major version upgrade with potential breaking changes

### Low Risk Items

- **PERF-001, PERF-002 (Pagination)**: Low risk, straightforward implementation
- **PERF-005 (Database indexes)**: Low risk, performance improvement only
- **DOCS-001 through DOCS-007 (Documentation moves)**: Low risk, organisational changes

---

## 5. Success Metrics

### Phase 1 (Security)
- [ ] Zero default secret fallbacks
- [ ] Zero sensitive data in logs
- [ ] 100% of endpoints have authorisation guards
- [ ] Zero hardcoded passwords
- [ ] CI security gates passing

### Phase 2 (Scalability)
- [ ] All list endpoints support pagination
- [ ] Zero JavaScript filtering (all in database)
- [ ] Composite indexes on all common filter combinations
- [ ] Query response times < 100ms (p95)
- [ ] Query performance monitoring active

### Phase 3 (Code Quality)
- [ ] Zero files > 1,000 lines
- [ ] < 50 `any` type usages (down from 576)
- [ ] Structured logging throughout
- [ ] Frontend test coverage > 50%
- [ ] Zero code duplication in identified areas

### Phase 4 (Documentation)
- [ ] Zero markdown files at root (except README)
- [ ] All scripts in `scripts/` directory structure
- [ ] Clear documentation organisation
- [ ] All references updated

### Phase 5 (Dependencies)
- [ ] Automated dependency scanning in CI/CD
- [ ] Dependabot/Renovate enabled
- [ ] License compliance documented
- [ ] Prisma 6.x upgrade plan created
- [ ] React 19 compatibility verified

---

## 6. Dependencies Between Work Items

### Critical Path

1. **SEC-001** → **SEC-006**: Startup validation depends on secret removal
2. **PERF-001, PERF-002** → **PERF-003, PERF-004**: Pagination should be in place before filtering optimisation
3. **QUAL-001** → **SEC-002**: Structured logging enables proper log sanitisation
4. **QUAL-006, QUAL-007, QUAL-008** → **ARCH-001, ARCH-002**: Service splitting enables better separation

### Parallel Work Opportunities

- Security fixes (SEC-001 through SEC-006) can be worked on in parallel
- Documentation moves (DOCS-001 through DOCS-003) can be done in parallel
- Frontend and backend code quality improvements can proceed independently
- Dependency management (DEPS-001 through DEPS-005) can be done in parallel

---

## 7. Timeline Summary

| Phase | Duration | Start Week | End Week | Key Deliverables |
|-------|----------|------------|----------|------------------|
| Phase 1 | 2 weeks | Week 1 | Week 2 | Security fixes, CI gates |
| Phase 2 | 4 weeks | Week 3 | Week 6 | Pagination, database optimisation |
| Phase 3 | 4 weeks | Week 7 | Week 10 | Code quality, logging, type safety |
| Phase 4 | 2 weeks | Week 11 | Week 12 | Documentation organisation |
| Phase 5 | 2 weeks | Week 13 | Week 14 | Dependency hardening |

**Total Duration**: 14 weeks (~3.5 months)

---

## 8. Next Steps

1. **Review and Approve Plan**: Stakeholder review of this implementation plan
2. **Assign Teams**: Allocate work items to appropriate teams based on ownership suggestions
3. **Set Up Tracking**: Create tracking system (Jira, GitHub Projects, etc.) for all 35 work items
4. **Kick-off Phase 1**: Begin security fixes immediately
5. **Weekly Reviews**: Establish weekly progress reviews and blockers resolution

---

**End of Implementation Plan**


