# PostHog Analytics Setup

This application uses [PostHog](https://posthog.com) for product analytics, user adoption tracking, and error monitoring.

## Features

- ✅ **User Adoption Tracking** - Track feature usage and user behavior
- ✅ **Error Tracking** - Automatic error capture and reporting
- ✅ **Session Replay** - Record user sessions (with privacy controls)
- ✅ **Custom Events** - Track specific user actions
- ✅ **User Identification** - Link events to specific users

## Setup Instructions

### 1. Create a PostHog Account

1. Go to [https://posthog.com](https://posthog.com)
2. Sign up for a free account (1M events/month free)
3. Create a new project

### 2. Get Your API Key

1. In PostHog dashboard, go to **Project Settings** → **Project API Key**
2. Copy your **Project API Key**

### 3. Configure Environment Variables

Add the following to your `.env.local` file (or your deployment environment):

```bash
# PostHog Configuration
NEXT_PUBLIC_POSTHOG_KEY=phc_your_api_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

**Note:** 
- For EU users, use `https://eu.i.posthog.com` instead
- The `NEXT_PUBLIC_` prefix is required for Next.js to expose these variables to the browser

### 4. Deploy and Verify

1. Restart your development server or redeploy your application
2. Navigate to your app and perform some actions
3. Check your PostHog dashboard - you should see events appearing

## Usage

### Tracking Custom Events

The existing `track()` function now automatically sends events to PostHog:

```typescript
import { track } from '@/lib/analytics'

// Track a button click
track('button_clicked', {
  button_name: 'create_okr',
  page: 'dashboard'
})

// Track feature usage
track('feature_used', {
  feature: 'okr_builder',
  user_role: 'admin'
})
```

### Tracking Errors

Errors are automatically tracked via the ErrorBoundary component. You can also manually track errors:

```typescript
import { trackError } from '@/lib/analytics'

try {
  // Some code that might fail
} catch (error) {
  trackError(error, {
    context: 'okr_creation',
    additional_info: 'user was creating OKR'
  })
}
```

### User Identification

Users are automatically identified when they log in. You can also manually identify users:

```typescript
import { identify, setUserProperties } from '@/lib/analytics'

// Identify a user
identify(userId, {
  email: user.email,
  firstName: user.firstName,
  role: user.role
})

// Update user properties later
setUserProperties({
  organization: 'Acme Corp',
  plan: 'enterprise'
})
```

## Privacy & Compliance

PostHog is configured with privacy in mind:

- **Input Masking**: All input fields are automatically masked in session replays
- **Do Not Track**: Respects browser DNT headers
- **Session Replay**: Can be disabled if needed (see configuration)

To mask specific elements in session replays, add the `data-ph-mask` attribute:

```tsx
<div data-ph-mask>Sensitive content</div>
```

## Analytics Dashboard

Once set up, you can view:

- **Events**: All tracked events in real-time
- **Users**: User profiles and behavior
- **Session Replays**: Recorded user sessions
- **Errors**: Error tracking and stack traces
- **Insights**: Custom dashboards and analytics

Access your dashboard at: [https://app.posthog.com](https://app.posthog.com)

## Free Tier Limits

PostHog's free tier includes:
- ✅ 1M events/month
- ✅ Unlimited users
- ✅ Session replay
- ✅ Error tracking
- ✅ Feature flags

## Temporarily Disable Analytics

To temporarily disable analytics without removing any code, add this to your `.env.local`:

```bash
NEXT_PUBLIC_ANALYTICS_ENABLED=false
```

When disabled:
- ✅ All analytics code remains in place
- ✅ No events will be tracked
- ✅ PostHog will not initialize
- ✅ No network requests to PostHog
- ✅ Console logs will show `[Analytics] Tracking disabled` in development

To re-enable, simply remove the line or set it to `true`:
```bash
NEXT_PUBLIC_ANALYTICS_ENABLED=true
```

**Note:** You'll need to restart your dev server after changing this environment variable.

## Troubleshooting

### Events not appearing

1. Check that `NEXT_PUBLIC_POSTHOG_KEY` is set correctly
2. Check that `NEXT_PUBLIC_ANALYTICS_ENABLED` is not set to `false`
3. Check browser console for PostHog initialization messages
4. Verify your API key in PostHog dashboard
5. Check network tab for requests to PostHog API

### Development Mode

In development, PostHog runs in debug mode. Check the browser console for:
- `[PostHog] Initialized` - Confirms PostHog loaded
- `[PostHog] Analytics disabled via NEXT_PUBLIC_ANALYTICS_ENABLED=false` - Analytics is disabled
- `[Analytics] Tracking disabled` - Individual events are being skipped
- `[Analytics] Failed to track event` - Indicates tracking issues

## Alternative Analytics Tools

If you prefer a different analytics tool, you can easily swap out PostHog by updating:
- `apps/web/src/lib/analytics.ts` - Core tracking functions
- `apps/web/src/components/providers/posthog-provider.tsx` - Provider component

Popular alternatives:
- **Mixpanel** - Similar feature set
- **Amplitude** - Product analytics focused
- **Sentry** - Excellent for error tracking (can be used alongside PostHog)
- **Plausible** - Privacy-focused, self-hosted option

