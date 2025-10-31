# Design System Documentation

## Overview

The OKR Framework uses a consistent design system built on Tailwind CSS with standardized tokens and component patterns established in Phase 9 and extracted in Phase 10.

## Tailwind Tokens

### Color Palette

**Neutral Scale (Primary Text/Surfaces):**
- `neutral-50`: Light backgrounds (nested cards, empty states)
- `neutral-100`: Subtle borders (nested card borders)
- `neutral-200`: Primary borders (card borders, dividers)
- `neutral-500`: Secondary text, metadata, subtitles
- `neutral-800`: Secondary text in cards
- `neutral-900`: Primary text (headings, labels)

**Status Colors:**
- `green-500/20`, `green-300`: On Track status
- `yellow-500/20`, `yellow-300`: At Risk status (with pulse animation)
- `red-500/20`, `red-300`: Off Track status
- `green-600/20`, `green-400`: Completed status
- `slate-500/20`, `slate-400`: Cancelled status

### Typography Hierarchy

**Headings:**
- `text-lg font-semibold`: Page titles, card titles
- `text-sm font-medium`: Section headers, card labels
- `text-xs`: Metadata, hints, badges

**Body Text:**
- `text-sm`: Primary body text
- `text-[11px]`: Subtitles, metadata
- `text-[12px]`: Small labels, empty state hints

**Values/Metrics:**
- `text-2xl font-semibold`: Stat card values
- `text-3xl font-semibold`: Large metric displays

### Spacing

**Padding:**
- `p-3`: Secondary cards (ActivityItemCard)
- `p-4`: Primary cards (StatCard, Section content containers)
- `p-6`: Large containers, empty states

**Margins:**
- `mb-2`: Section header spacing
- `mb-4`: Card spacing, section spacing
- `mb-8`: Large section spacing

**Gaps:**
- `gap-2`: Tight spacing (badges, icons)
- `gap-3`: Standard spacing (items in lists)
- `gap-4`: Card spacing in grids

### Border Radius

- `rounded-lg`: Secondary cards, badges
- `rounded-xl`: Primary cards (StatCard, ObjectiveCard, section containers)
- `rounded-full`: Badges, avatars

### Shadows

- `shadow-sm`: Standard card shadow (all primary cards)
- `shadow-md`: Hover states (ObjectiveCard)

### Border Styles

- `border border-neutral-200`: Primary card borders
- `border border-neutral-100`: Nested/secondary card borders
- `border border-dashed border-neutral-200`: Empty state containers

## Card Tiers

### Tier 1: Primary Cards
**Usage:** Main content containers, stat cards, section wrappers

**Classes:**
```
rounded-xl border border-neutral-200 bg-white p-4 shadow-sm
```

**Examples:**
- `StatCard`
- Section content containers (analytics sections)
- `ObjectiveCard` wrapper

### Tier 2: Secondary Cards
**Usage:** Nested cards, activity items, list items

**Classes:**
```
rounded-lg border border-neutral-100 bg-neutral-50 p-3 shadow-sm
```

**Examples:**
- `ActivityItemCard`
- Key result rows (when implemented)

### Tier 3: Empty State Containers
**Usage:** Empty states within context

**Classes:**
```
rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-4 text-center text-[12px] text-neutral-500
```

**Examples:**
- Empty key results list
- Empty activity feed

## Shared Components

### StatCard

**Location:** `components/ui/StatCard.tsx`

**Props:**
- `title: string` - Label for the metric
- `value: string | number | ReactNode` - Main value display
- `subtitle?: string` - Optional metadata below value

**Usage:**
```tsx
<StatCard
  title="Total Objectives"
  value={42}
  subtitle="12 on track"
/>
```

**Styling:** Tier 1 card (rounded-xl, border-neutral-200, p-4)

### SectionHeader

**Location:** `components/ui/SectionHeader.tsx`

**Props:**
- `title: string` - Section title
- `subtitle?: string` - Optional metadata (right-aligned)

**Usage:**
```tsx
<SectionHeader
  title="Recent Activity"
  subtitle="Last 10 check-ins"
/>
```

**Styling:** `text-sm font-medium text-neutral-900` (title), `text-[11px] text-neutral-500` (subtitle)

### ActivityItemCard

**Location:** `components/ui/ActivityItemCard.tsx`

**Props:**
- `actorName: string` - User who performed action
- `timestamp: string` - ISO timestamp
- `action: string` - Action type (e.g., "CHECK_IN", "UPDATED")
- `summary: string` - Human-readable summary

**Usage:**
```tsx
<ActivityItemCard
  actorName="John Doe"
  timestamp="2024-01-15T10:30:00Z"
  action="UPDATED"
  summary="Progress 45% → 60%"
/>
```

**Styling:** Tier 2 card (rounded-lg, border-neutral-200, p-3)

### StatusBadge

**Location:** `components/ui/StatusBadge.tsx`

**Props:**
- `status: ObjectiveStatus` - Status value ('ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'COMPLETED' | 'CANCELLED')
- `className?: string` - Additional classes

**Usage:**
```tsx
<StatusBadge status="ON_TRACK" />
```

**Styling:** Status-specific colors with `text-xs rounded-full border`

### ObjectiveCard

**Location:** `components/ui/ObjectiveCard.tsx`

**Props:**
- `title: string` - Objective title
- `ownerName: string` - Owner display name
- `status: ObjectiveStatus` - Current status
- `progressPct: number` - Progress 0-100
- `isPublished: boolean` - Published state
- `canEdit: boolean` - Edit permission
- `canDelete: boolean` - Delete permission
- `onEdit?()` - Edit handler
- `onDelete?()` - Delete handler
- `onOpenHistory?()` - Activity drawer handler

**Usage:**
```tsx
<ObjectiveCard
  title="Increase Customer Satisfaction"
  ownerName="John Doe"
  status="ON_TRACK"
  progressPct={75}
  isPublished={false}
  canEdit={true}
  canDelete={true}
  onEdit={() => router.push(`/builder?okrId=${id}`)}
/>
```

**Styling:** Tier 1 card with hover effects

## Design Principles

1. **Consistency:** All cards use the same token set
2. **Hierarchy:** Clear visual hierarchy via typography and spacing
3. **Neutral Palette:** Primary use of neutral colors, status colors only for indicators
4. **Accessibility:** Semantic HTML, proper heading hierarchy, sufficient contrast
5. **Deliberate Empty States:** Empty states are styled containers, not raw text

## Component Composition

Components are designed to be composed:

```tsx
<div className="mb-8">
  <SectionHeader title="Execution Risk" subtitle="Key Results overdue" />
  <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
    {/* Content */}
  </div>
</div>
```

## Future Enhancements

- [ ] Dark mode tokens
- [ ] Responsive breakpoint utilities
- [ ] Animation tokens (transition durations)
- [ ] Icon size standards

