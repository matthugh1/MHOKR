# Build Information (BuildStamp)

## Overview

BuildStamp is a component that displays build provenance information on demo surfaces. It shows version, environment, and git SHA to ensure stakeholders always know which build they're looking at.

## What BuildStamp Shows

BuildStamp displays three pieces of information:
- **Version**: Semantic version (e.g., `1.0.0`)
- **Environment**: Build environment (`development`, `staging`, `production`, or custom)
- **Git SHA**: First 7 characters of the git commit SHA (e.g., `a1b2c3d`)

Format: `{version} • {env} • {sha}`

Example: `1.0.0 • staging • a1b2c3d`

## Where BuildStamp is Rendered

BuildStamp **MUST** appear on the following demo surfaces:

1. **Analytics header** (`apps/web/src/app/dashboard/analytics/page.tsx`)
   - Inline variant, top-right of header row

2. **OKRs header** (`apps/web/src/app/dashboard/okrs/page.tsx`)
   - Inline variant, top-right of header row

3. **Builder header** (`apps/web/src/app/dashboard/builder/page.tsx`)
   - Inline variant, top-right of header row (with SectionHeader)

4. **AI dashboard header** (`apps/web/src/app/dashboard/ai/page.tsx`)
   - Inline variant, top-right of header row

5. **ActivityDrawer footer** (`apps/web/src/components/ui/ActivityDrawer.tsx`)
   - Footer variant, centered at bottom of drawer

## How to Update Version/Env/SHA

Before a demo or staging deploy, update `apps/web/src/version.ts`:

```typescript
export const BUILD_VERSION = '1.0.0'  // Update to match release
export const BUILD_ENV = 'staging'    // Set to 'staging', 'production', etc.
export const BUILD_GIT_SHA = 'a1b2c3d' // Set to actual git SHA or use env var
```

### Using Environment Variables

For CI/CD pipelines, set these environment variables:

- `NEXT_PUBLIC_ENV` - Overrides `BUILD_ENV`
- `NEXT_PUBLIC_GIT_SHA` - Overrides `BUILD_GIT_SHA`

Example:
```bash
NEXT_PUBLIC_ENV=staging NEXT_PUBLIC_GIT_SHA=$(git rev-parse --short HEAD) npm run build
```

## Important Note: Backend Does NOT Own Build Identity

**Frontend-sourced build identity is intentional.** This allows us to tag demo builds without redeploying `core-api`. The frontend can independently update `version.ts` to reflect the current demo build, even if the backend services haven't changed.

This is particularly useful for:
- Tagging demo builds with custom version strings
- Updating environment indicators without full redeployment
- Quick version bumps for stakeholder demos

## Usage

```tsx
import { BuildStamp } from '@/components/ui/BuildStamp'

// Inline variant (for headers)
<div className="flex items-start justify-between gap-4">
  <SectionHeader title="Page Title" subtitle="Description" />
  <BuildStamp variant="inline" />
</div>

// Footer variant (for ActivityDrawer)
<ActivityDrawer>
  {/* content */}
  <BuildStamp variant="footer" />
</ActivityDrawer>
```

## Do Not Remove BuildStamp

**Do not remove BuildStamp or hide it on demo branches unless explicitly approved.** BuildStamp is mandatory for:
- Demo clarity (stakeholders need to know which build they're seeing)
- Bug tracking (screenshots with BuildStamp help identify build versions)
- Release verification (ensures correct build is deployed)

