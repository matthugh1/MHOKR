# Release Checklist

Use this checklist before merging to `main` and preparing for release.

## Pre-Merge Checks

### Code Quality
- [ ] `tsc --noEmit` passes (no TypeScript errors)
- [ ] `npm run lint` passes (no linting errors)
- [ ] All TODO tags are confined to:
  - `[phase6-polish]` - Cosmetic/aesthetic improvements
  - `[phase7-hardening]` - Behavioral rules, guard rails, lock logic
  - `[phase7-performance]` - Performance optimizations, batching, pagination
- [ ] No TODOs blocking merge (all critical functionality complete)

### Testing
- [ ] Unit tests pass (`npm test` or equivalent)
- [ ] Smoke tests pass for critical pages (Analytics, OKRs)
- [ ] Manual demo walkthrough verified:
  - [ ] Dashboard loads and displays user's OKRs
  - [ ] Analytics page shows KPIs and sections
  - [ ] OKRs page displays objectives with correct permissions
  - [ ] Activity drawer opens and displays history
  - [ ] CSV export works (if user has permission)

### Documentation
- [ ] Architecture docs up to date (`docs/architecture/`)
  - [ ] `BACKEND_OVERVIEW.md` reflects current module structure
  - [ ] `FRONTEND_OVERVIEW.md` reflects current page flow and hooks
  - [ ] `DESIGN_SYSTEM.md` reflects current tokens and components
- [ ] Component JSDoc includes `@module` and `@see` references
- [ ] README.md includes setup instructions

### Storybook (when installed)
- [ ] Storybook builds successfully (`npm run build-storybook`)
- [ ] All component stories render correctly
- [ ] Story documentation is complete

### Pull Request
- [ ] PR description includes phase completion summary
- [ ] PR references related issues/documents
- [ ] Code review completed
- [ ] All CI checks pass

## Post-Merge

### Deployment
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Build succeeds in staging
- [ ] Smoke tests pass in staging
- [ ] Manual QA completed in staging

### Communication
- [ ] Team notified of changes
- [ ] Changelog updated (if applicable)
- [ ] Documentation links shared

## Notes

- Phase 9: Visual polish and perceived quality improvements
- Phase 10: Design system extraction and component centralization
- Phase 11: Documentation and test coverage

For questions or issues, refer to:
- Architecture docs: `docs/architecture/`
- Component docs: See JSDoc in `apps/web/src/components/ui/`
- Design system: `docs/architecture/DESIGN_SYSTEM.md`

