---
title: Feature Requests - Epics F, G, H (Enterprise Readiness)
source: OKR_ENTERPRISE_READINESS_AUDIT.md
generatedBy: Cursor
date: 2025-01-15
targetRelease: Enterprise v2
status: Deferred
---

# Feature Requests - Epics F, G, H (Enterprise Readiness)

**Generated:** 2025-01-15  
**Source:** OKR Enterprise Readiness Audit  
**Target Release:** Enterprise v2  
**Status:** Deferred  
**Priority:** Medium

This document captures deferred enterprise features from the OKR Enterprise Readiness Audit, specifically Epics F (Tenancy & Integrations), G (Exports & Public API), and H (SSO & SCIM). These features are essential for enterprise customers but have been deferred to Enterprise v2 release.

---

## EPIC F — TENANCY & INTEGRATIONS

### Narrative Summary

The tenancy layer is solid with excellent multi-tenant isolation, but integrations are only scaffolded. Enterprise customers require automated data synchronization from external systems (Jira, GitHub, Salesforce, Snowflake) to keep Key Results up-to-date without manual intervention. This epic focuses on implementing production-ready connectors with auto-sync scheduling, retry logic, error handling, monitoring dashboards, and tenant isolation for all integration operations. These capabilities enable enterprise customers to maintain real-time OKR alignment with their operational systems.

### Feature Requests

| ID | Title | Problem Statement | Proposed Solution | Expected Outcome / KPI | Priority | Effort | Status | Dependencies |
|----|-------|------------------|------------------|------------------------|-----------|---------|----------|---------------|
| F-FR001 | Jira Integration Implementation | Jira integration service scaffolded but not implemented. Enterprise customers need to sync Jira issue progress to Key Results automatically. | Implement Jira API client with OAuth authentication, sync issue status/progress to KR currentValue, support webhook subscriptions for real-time updates, and add tenant isolation checks. | Jira issues linked to OKRs, issue status syncs automatically, real-time updates via webhooks, zero cross-tenant data leakage | Medium | XL | Deferred | Integration-service, Jira API credentials |
| F-FR002 | GitHub Integration Implementation | GitHub integration service scaffolded but not implemented. Development teams need to sync PR metrics and repository activity to Key Results. | Implement GitHub API client with OAuth authentication, sync PR metrics (count, merge rate) to KR values, support webhook subscriptions for repository events, and add tenant isolation checks. | GitHub repositories linked to OKRs, PR metrics sync automatically, real-time updates via webhooks, better development-OKR alignment | Medium | XL | Deferred | Integration-service, GitHub API credentials |
| F-FR003 | Salesforce Integration Implementation | Salesforce integration not implemented. Sales teams need to sync opportunity metrics and revenue data to Key Results. | Implement Salesforce API client with OAuth authentication, sync opportunity/revenue metrics to KR values, support scheduled sync jobs, and add tenant isolation checks. | Salesforce opportunities linked to OKRs, revenue metrics sync automatically, scheduled updates, better sales-OKR alignment | Medium | XL | Deferred | Integration-service, Salesforce API credentials |
| F-FR004 | Snowflake Data Source Integration | Snowflake not in IntegrationSource enum. Analytics teams need to sync data warehouse metrics to Key Results. | Add SNOWFLAKE to IntegrationSource enum, implement Snowflake connector with SQL query execution, sync query results to KR values, support scheduled sync jobs, and add tenant isolation checks. | Snowflake queries linked to OKRs, data warehouse metrics sync automatically, scheduled updates, better analytics-OKR alignment | Medium | L | Deferred | Integration-service, Snowflake credentials |
| F-FR005 | Auto-Sync Scheduler | No scheduled sync jobs for integrations. Manual sync requires user intervention, reducing automation value. | Implement scheduled sync job system using NestJS scheduler, support configurable sync intervals per integration, queue sync jobs with retry logic, and respect tenant isolation. | Integrations sync automatically on schedule, configurable intervals per tenant, reduced manual intervention, improved data freshness | Medium | M | Deferred | NestJS scheduler, job queue system |
| F-FR006 | Integration Retry Logic | No retry logic for failed sync operations. Temporary API failures cause permanent sync failures. | Implement exponential backoff retry logic, support configurable retry attempts per integration, log retry attempts to audit log, and notify admins after max retries exceeded. | Failed syncs retry automatically, reduced sync failures, better reliability, admin notifications for persistent failures | Medium | M | Deferred | Retry library, notification service |
| F-FR007 | Integration Status Monitoring Dashboard | No visibility into integration health. Admins cannot monitor sync status or diagnose issues. | Create integration status API endpoint (`GET /integrations/status`), show sync success/failure rates per integration, display last sync timestamp and next scheduled sync, and provide error logs for failed syncs. | Admins can monitor integration health, diagnose sync issues, view sync history, improved observability | Medium | M | Deferred | Monitoring service, UI components |
| F-FR008 | Integration Status API | No programmatic access to integration status. External monitoring tools cannot check integration health. | Implement REST API endpoint `GET /integrations/status` returning sync status per integration, include success/failure rates, last sync timestamp, and error details. | External monitoring tools can check integration health, programmatic access to status, better observability | Medium | S | Deferred | API endpoint, status service |
| F-FR009 | Integration Error Handling | No structured error handling for integration failures. Errors are not logged or recoverable. | Implement structured error handling with error classification (transient vs permanent), log errors to audit log, support error recovery workflows, and notify admins of critical failures. | Integration errors handled gracefully, error recovery workflows, audit trail for failures, admin notifications | Medium | M | Deferred | Error handling framework, audit logging |
| F-FR010 | Integration Observability | No observability into integration operations. Cannot trace sync operations or diagnose performance issues. | Add structured logging for all integration operations, support distributed tracing for sync jobs, emit metrics for sync duration and success rates, and provide integration operation logs in admin UI. | Full observability into integration operations, performance monitoring, debugging capabilities, improved reliability | Medium | M | Deferred | Logging framework, metrics service |
| F-FR011 | Integration Tenant Isolation | Integration operations may not enforce tenant isolation. Risk of cross-tenant data leakage. | Enforce tenant isolation in all integration operations, verify tenant match before sync operations, add tenant context to all integration logs, and prevent cross-tenant data access. | Zero cross-tenant data leakage, secure integration operations, compliance with tenant isolation requirements | Medium | M | Deferred | Tenant isolation middleware, security audit |

---

## EPIC G — EXPORTS & PUBLIC API

### Narrative Summary

CSV export exists with proper RBAC protection, but PDF export and public API are missing. Enterprise customers require programmatic access to OKR data for custom integrations, reporting tools, and data warehouse ingestion. This epic introduces PDF export capabilities, API key authentication for programmatic access, versioned OpenAPI documentation, rate limiting for public endpoints, and developer-friendly SDK examples. These features enable enterprise customers to integrate OKR data into their existing tooling and workflows while maintaining security and compliance.

### Feature Requests

| ID | Title | Problem Statement | Proposed Solution | Expected Outcome / KPI | Priority | Effort | Status | Dependencies |
|----|-------|------------------|------------------|------------------------|-----------|---------|----------|---------------|
| G-FR001 | PDF Export Service | No PDF export capability. Enterprise customers need PDF reports for board meetings and QBRs. | Implement PDF export service using existing analytics data, support customizable report templates, include charts and visualizations, and respect RBAC permissions. | PDF reports available for download, customizable templates, professional presentation format, RBAC-protected | Medium | L | Deferred | PDF generation library, template engine |
| G-FR002 | API Key Authentication | All endpoints require JWT authentication. Programmatic access requires user credentials, limiting automation. | Implement API key authentication strategy, support API key generation/revocation in admin UI, add API key model to schema, and create API key guard for public endpoints. | Programmatic access without user credentials, API keys manageable in admin UI, secure authentication for automation | Medium | M | Deferred | API key model, authentication strategy |
| G-FR003 | Versioned OpenAPI Documentation | OpenAPI docs exist but not versioned. Breaking changes break external integrations without notice. | Publish versioned OpenAPI documentation (v1, v2, etc.), maintain backward compatibility within versions, document deprecation timelines, and provide migration guides. | Versioned API documentation, backward compatibility guarantees, clear deprecation policies, better developer experience | Medium | M | Deferred | OpenAPI versioning, documentation tooling |
| G-FR004 | Public API Rate Limiting | No rate limiting for public API endpoints. Risk of abuse and DoS attacks. | Implement rate limiting for public API endpoints, support per-API-key rate limits, configurable limits per tenant, and return 429 status with retry-after header. | Public API protected from abuse, configurable rate limits, DoS protection, fair usage enforcement | Medium | M | Deferred | Rate limiting service, API key tracking |
| G-FR005 | Public API Telemetry | No telemetry for public API usage. Cannot monitor API adoption or diagnose issues. | Add telemetry for all public API requests, track API key usage, log request/response metrics, and provide API usage dashboard in admin UI. | API usage visibility, adoption tracking, performance monitoring, better support capabilities | Medium | M | Deferred | Telemetry service, metrics collection |
| G-FR006 | Public API Endpoints | All endpoints require JWT. No public endpoints for programmatic access. | Create public API namespace (`/api/v1/public/*`), expose read-only endpoints for OKRs/KRs, support filtering and pagination, and enforce API key authentication. | Public API endpoints available, read-only access for integrations, filtering and pagination support, secure access | Medium | L | Deferred | Public API controller, endpoint design |
| G-FR007 | Developer SDK Examples | No SDK examples for developers. Integration requires reverse-engineering API. | Provide simple client SDK examples for common languages (Python, JavaScript, Go), include authentication examples, demonstrate common use cases, and publish to package registries. | Developers can integrate quickly, reduced integration time, better developer experience, increased API adoption | Medium | M | Deferred | SDK development, documentation, examples |
| G-FR008 | API Key Management UI | No UI for managing API keys. Admins must use database directly to create/revoke keys. | Create admin UI for API key management, support key generation with scopes, show key usage statistics, enable key revocation, and display key creation/expiry dates. | Admins can manage API keys in UI, key usage visibility, easy key revocation, better security management | Medium | M | Deferred | Admin UI components, API key service |

---

## EPIC H — SSO & SCIM

### Narrative Summary

Keycloak configuration exists with JWT verification, but enterprise SSO features are incomplete. Enterprise customers require seamless integration with their identity providers (Azure AD, Okta, Google Workspace) and automated user provisioning/deprovisioning via SCIM. This epic implements OIDC/SAML strategies for major IdPs, builds SCIM 2.0 endpoints for user lifecycle management, supports role and group mapping from IdP claims, adds audit logging for provisioning events, and provides admin UI for SSO/SCIM configuration. These capabilities eliminate manual user management and enable enterprise customers to maintain centralized identity governance.

### Feature Requests

| ID | Title | Problem Statement | Proposed Solution | Expected Outcome / KPI | Priority | Effort | Status | Dependencies |
|----|-------|------------------|------------------|------------------------|-----------|---------|----------|---------------|
| H-FR001 | OIDC Strategy Implementation | No OIDC strategy for identity provider integration. Enterprise customers cannot use Azure AD, Okta, or Google Workspace for SSO. | Implement OIDC strategy using Passport.js, support multiple IdP configurations per tenant, handle OIDC callback flow, and map IdP claims to user attributes. | OIDC SSO working with major IdPs, seamless authentication, reduced password management, improved security | Medium | L | Deferred | Passport OIDC strategy, IdP configuration |
| H-FR002 | SAML Strategy Implementation | No SAML strategy for identity provider integration. Enterprise customers with SAML-only IdPs cannot integrate. | Implement SAML strategy using Passport.js, support SAML 2.0 protocol, handle SAML assertion processing, and map SAML attributes to user attributes. | SAML SSO working with SAML IdPs, enterprise compatibility, seamless authentication, improved security | Medium | L | Deferred | Passport SAML strategy, SAML library |
| H-FR003 | Azure AD Integration | No specific Azure AD integration. Enterprise customers using Azure AD cannot SSO. | Configure OIDC for Azure AD, support Azure AD-specific claim mapping, handle Azure AD group membership, and map Azure AD roles to RBAC roles. | Azure AD SSO working, group membership synced, role mapping configured, seamless authentication | Medium | M | Deferred | Azure AD configuration, OIDC strategy |
| H-FR004 | Okta Integration | No specific Okta integration. Enterprise customers using Okta cannot SSO. | Configure OIDC for Okta, support Okta-specific claim mapping, handle Okta group membership, and map Okta roles to RBAC roles. | Okta SSO working, group membership synced, role mapping configured, seamless authentication | Medium | M | Deferred | Okta configuration, OIDC strategy |
| H-FR005 | Google Workspace Integration | No specific Google Workspace integration. Enterprise customers using Google Workspace cannot SSO. | Configure OIDC for Google Workspace, support Google-specific claim mapping, handle Google group membership, and map Google roles to RBAC roles. | Google Workspace SSO working, group membership synced, role mapping configured, seamless authentication | Medium | M | Deferred | Google Workspace configuration, OIDC strategy |
| H-FR006 | SCIM 2.0 User Provisioning | No SCIM endpoints for user provisioning. Enterprise customers must manually create users. | Implement SCIM 2.0 endpoints (`GET /scim/Users`, `POST /scim/Users`, `PATCH /scim/Users/:id`, `DELETE /scim/Users/:id`), support SCIM-compliant user creation, and handle user attribute mapping. | Users provisioned automatically via SCIM, reduced manual admin, seamless user onboarding, SCIM 2.0 compliant | Medium | L | Deferred | SCIM library, user service updates |
| H-FR007 | SCIM 2.0 User Deprovisioning | No SCIM deprovisioning workflow. Enterprise customers cannot automatically remove users. | Implement SCIM user deprovisioning (`DELETE /scim/Users/:id`), support soft-delete vs hard-delete, handle user data retention policies, and notify admins of deprovisioning events. | Users deprovisioned automatically via SCIM, reduced manual admin, seamless user offboarding, compliance support | Medium | M | Deferred | SCIM library, user service updates |
| H-FR008 | SCIM Group Provisioning | No SCIM group provisioning. Enterprise customers cannot sync groups from IdP. | Implement SCIM group endpoints (`GET /scim/Groups`, `POST /scim/Groups`, `PATCH /scim/Groups/:id`), support group membership sync, and map groups to RBAC roles. | Groups provisioned automatically via SCIM, group membership synced, role mapping from groups, reduced manual admin | Medium | L | Deferred | SCIM library, group service |
| H-FR009 | IdP Role Mapping | No role mapping from IdP claims. Users must be assigned roles manually after SSO. | Support role mapping configuration per tenant, map IdP roles/groups to RBAC roles, handle default role assignment, and update roles on SSO login. | Roles assigned automatically from IdP, reduced manual role management, seamless role sync, improved UX | Medium | M | Deferred | Role mapping service, configuration UI |
| H-FR010 | IdP Group Mapping | No group mapping from IdP claims. Group membership not synced to platform. | Support group mapping configuration per tenant, map IdP groups to platform groups/workspaces, handle group membership sync, and update groups on SSO login. | Groups synced automatically from IdP, group membership updated, seamless group sync, improved UX | Medium | M | Deferred | Group mapping service, configuration UI |
| H-FR011 | Provisioning Event Audit Logging | No audit logging for provisioning events. Cannot track user lifecycle changes. | Log all SCIM provisioning events to audit log, include actor (IdP), target user, action (create/update/delete), and metadata (attributes changed), and provide audit log query endpoint. | Complete audit trail for provisioning, compliance support, security monitoring, user lifecycle tracking | Medium | M | Deferred | Audit log service, SCIM integration |
| H-FR012 | SSO Configuration Admin UI | No UI for configuring SSO. Admins must edit configuration files directly. | Create admin UI for SSO configuration, support IdP metadata upload, configure claim mapping, set role/group mappings, and test SSO connection. | Admins can configure SSO in UI, no file editing required, test SSO before enabling, better UX | Medium | L | Deferred | Admin UI components, SSO configuration service |
| H-FR013 | SCIM Configuration Admin UI | No UI for configuring SCIM. Admins must configure SCIM endpoints manually. | Create admin UI for SCIM configuration, support SCIM endpoint URL generation, configure attribute mapping, set provisioning rules, and test SCIM connection. | Admins can configure SCIM in UI, no manual configuration required, test SCIM before enabling, better UX | Medium | L | Deferred | Admin UI components, SCIM configuration service |

---

## Summary Table

### By Epic

| Epic | Feature Requests | Total Effort Estimate |
|------|-----------------|----------------------|
| Epic F - Tenancy & Integrations | 11 | 4 XL, 5 M, 1 L, 1 S |
| Epic G - Exports & Public API | 8 | 1 L, 6 M, 1 S |
| Epic H - SSO & SCIM | 13 | 4 L, 9 M |
| **Total** | **32** | **4 XL, 20 M, 5 L, 1 S** |

### By Priority

| Priority | Count |
|----------|-------|
| Medium | 32 |

### By Status

| Status | Count |
|--------|-------|
| Deferred | 32 |

### By Target Release

| Target Release | Count |
|----------------|-------|
| Enterprise v2 | 32 |

---

## Notes

- All feature requests are deferred to Enterprise v2 release
- Priority set to Medium as these are enterprise requirements but not blocking MVP
- Effort estimates: S (Small, 1-2 days), M (Medium, 3-5 days), L (Large, 1-2 weeks), XL (Extra Large, 2+ weeks)
- Dependencies listed are high-level service/component dependencies
- Source traceability maintained via YAML front-matter reference to OKR_ENTERPRISE_READINESS_AUDIT.md

---

**End of Feature Requests Document**

