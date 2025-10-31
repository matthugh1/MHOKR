## What this PR does

<!-- Describe the changes in this PR in 2-3 sentences. -->

## Which refactor phase this maps to

<!-- If this PR is part of the refactor, specify the phase number (e.g., "Phase 3: Governance Service"). If not part of refactor, specify "N/A - new feature/fix". -->

## Does this PR change runtime behaviour?

<!-- Answer: Yes or No -->

<!-- If Yes, describe the scope of changes: -->

## Tenant isolation touched?

<!-- Answer: Yes or No -->

<!-- If Yes, confirm: OkrTenantGuard used for all tenant isolation and write permission checks -->

## Governance / publish lock touched?

<!-- Answer: Yes or No -->

<!-- If Yes, confirm: OkrGovernanceService used for all publish lock and cycle lock enforcement -->

## Reporting / analytics touched?

<!-- Answer: Yes or No -->

<!-- If Yes, confirm: OkrReportingService + /reports/* endpoints only (no analytics logic in ObjectiveService or KeyResultService) -->

## Frontend permissions touched?

<!-- Answer: Yes or No -->

<!-- If Yes, confirm: useTenantPermissions is the single source of truth for all permission checks -->

## New TODO tags added?

<!-- Answer: Yes or No -->

<!-- If Yes, list them. Allowed TODO tags are:
- [phase6-polish] = purely cosmetic / styling uplift / visual refinement
- [phase7-hardening] = behavioural alignment, visibility/permission/lock correctness
- [phase7-performance] = performance or pagination work for scale

Any other TODO format is not allowed. -->

## Screenshots / clips for stakeholders

<!-- Add screenshots or screen recordings for any UI-facing changes. Optional but recommended. -->

---

## Checklist

- [ ] `tsc --noEmit` passes (no TypeScript errors)
- [ ] `npm run lint` passes (no linting errors)
- [ ] Runtime behaviour verified (if applicable)
- [ ] RELEASE_CHECKLIST.md updated (if affecting demo flow)
- [ ] Screenshots included (if UI-facing changes)

