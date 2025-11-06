# OKR Mini Sprint 3 - Finalization Commands

## Git Commands for PR Creation

### 1. Ensure Branch is Up to Date
```bash
git checkout chore/okr-mini-sprint-3
git pull origin chore/okr-mini-sprint-3  # if remote exists
```

### 2. Push Branch to Remote
```bash
git push -u origin chore/okr-mini-sprint-3
```

### 3. Create Pull Request

#### Option A: GitHub CLI
```bash
gh pr create \
  --title "chore(okr): Mini Sprint 3 – governance status, inspector, inline health (validated)" \
  --body-file docs/audit/OKR_MINI_SPRINT_3_PR_BODY.md \
  --base main \
  --head chore/okr-mini-sprint-3
```

#### Option B: Manual via GitHub UI
1. Go to: `https://github.com/<org>/<repo>/compare/main...chore/okr-mini-sprint-3`
2. Click "Create Pull Request"
3. Title: `chore(okr): Mini Sprint 3 – governance status, inspector, inline health (validated)`
4. Body: Copy contents of `docs/audit/OKR_MINI_SPRINT_3_PR_BODY.md`

### 4. Post-Merge Tag (Optional)

After merge is complete:

```bash
# Switch to main
git checkout main
git pull origin main

# Create lightweight tag
git tag -a okr-mini-sprint-3 -m "OKR Mini Sprint 3: Governance status, inspector, inline health"

# Push tag
git push origin okr-mini-sprint-3

# Update CHANGELOG with release info
# Add under "Released" section:
# - okr-mini-sprint-3 (<commit-sha>) - 2025-11-05
```

### 5. Update CHANGELOG (After Merge)

Add to `CHANGELOG.md`:

```markdown
## [Released]

### okr-mini-sprint-3 - 2025-11-05
- Governance Status Bar (non-interactive summary)
- Why Can't I Inspector (production-safe, flag-gated)
- Inline Health Signals (row-level, lazy-loaded)
- Commit: `<final-merge-sha>`
```

## Validation Checklist

Before merging, ensure:

- [ ] Feature flag `rbacInspector` enabled for test user only
- [ ] Governance Status Bar tested (3 scopes)
- [ ] Why Inspector tested (flag-gated)
- [ ] Inline Health Signals tested (lazy loading)
- [ ] Screenshots captured and saved
- [ ] Telemetry payloads recorded
- [ ] Validation report completed
- [ ] Lint/tests passing
- [ ] PR body reviewed

## Manual Testing Reminder

Some steps require manual browser testing:

1. Enable feature flag via UI or API
2. Load validation helper script in browser console
3. Take screenshots (save to `docs/audit/artifacts/`)
4. Capture telemetry payloads
5. Fill in validation report with actual results

See `docs/audit/OKR_MINI_SPRINT_3_VALIDATION_GUIDE.md` for detailed instructions.

