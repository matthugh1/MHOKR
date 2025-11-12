# Feature Request: Visibility Whitelist Management

**Context:**  
Current RBAC and visibility controls enforce PRIVATE and PUBLIC_TENANT visibility but lack a management interface for whitelisting specific users or roles who may view a PRIVATE Objective, Key Result, or Initiative. Admins must currently modify JSON or database records manually, introducing compliance and UX risk.

**Problem:**  
- Admins cannot easily grant cross-team or executive visibility for sensitive OKRs.  
- Manual edits create risk of misconfiguration and security breaches.  
- No UI or API for maintaining per-entity visibility exceptions.

**Proposed Solution:**  
Implement an **Entity Visibility Whitelist** subsystem:

- **Schema:** Create a `VisibilityWhitelist` model mapping `{ entityType, entityId, viewerUserId, grantedBy, createdAt }`.

- **Backend:** Add service + controller methods to CRUD whitelist entries with full RBAC + tenant enforcement.

- **Frontend:** Add management UI under Objective/Initiative detail drawer → "Share with specific users".

- **Audit:** Log each whitelist change in ActivityService with action 'VISIBILITY_GRANTED' / 'VISIBILITY_REVOKED'.

- **Validation:** Ensure tenant isolation and no cross-tenant sharing.

- **Integration:** Respect whitelist in `OkrVisibilityService.isVisibleToUser()`.

**Priority:** Medium  
**Complexity:** Moderate (1 sprint)  
**Impact:** Improves governance, compliance, and enterprise readiness for sensitive OKRs.  
**Dependencies:** Requires minor extension to RBAC and Activity modules.  

**Status:** Deferred – added to Feature Request backlog (docs/feature-requests).

**Related Documentation:**  
- Enterprise Readiness Audit: Section 2.7 "RBAC & Visibility Rules" (`OKR_ENTERPRISE_TECHNICAL_AUDIT.md`)


