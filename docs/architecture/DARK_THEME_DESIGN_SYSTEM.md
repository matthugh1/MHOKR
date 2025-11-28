# Dark Theme Design System

## Overview

This document defines the dark theme styling system used across the OKR Framework application. The styling is based on Tailwind CSS with a slate color palette and indigo accents.

## Color Palette

### Background Colors

**Primary Backgrounds:**
- `bg-slate-950`: Main page background (darkest)
- `bg-slate-900`: Panel backgrounds, sidebars, cards
- `bg-slate-900/50`: Semi-transparent overlays, headers
- `bg-slate-800`: Hover states, active elements, input backgrounds
- `bg-slate-800/50`: Subtle hover backgrounds
- `bg-slate-800/30`: Very subtle hover states
- `bg-slate-700`: Dividers, borders, disabled states
- `bg-slate-700/50`: Progress bar backgrounds

**Accent Backgrounds:**
- `bg-indigo-600`: Primary buttons, active states
- `bg-indigo-600/10`: Active navigation items, selected states
- `bg-indigo-500/20`: Icon backgrounds, subtle accents
- `bg-indigo-500`: Secondary buttons, avatars

### Text Colors

**Primary Text:**
- `text-white`: Headings, primary content, active states
- `text-slate-200`: Secondary headings, body text
- `text-indigo-100`: Selected item text

**Secondary Text:**
- `text-slate-300`: Secondary content, button text
- `text-slate-400`: Tertiary content, labels, metadata
- `text-slate-500`: Muted text, hints, timestamps
- `text-slate-600`: Very muted text, dividers

**Accent Text:**
- `text-indigo-400`: Active navigation, links
- `text-indigo-300`: Hover states for indigo text

### Border Colors

- `border-slate-800`: Primary borders, dividers
- `border-slate-800/50`: Subtle borders
- `border-slate-700`: Secondary borders, input borders
- `border-indigo-500`: Active/selected borders
- `border-indigo-500/30`: Subtle accent borders

### Status Colors

**On Track:**
- Background: `bg-emerald-500/10`
- Text: `text-emerald-400`
- Border: `border-emerald-500/20`
- Progress: `bg-emerald-500`

**At Risk:**
- Background: `bg-amber-500/10`
- Text: `text-amber-400`
- Border: `border-amber-500/20`
- Progress: `bg-amber-500`

**Off Track:**
- Background: `bg-rose-500/10`
- Text: `text-rose-400`
- Border: `border-rose-500/20`
- Progress: `bg-rose-500`

**Completed:**
- Background: `bg-emerald-600/20`
- Text: `text-emerald-300`
- Border: `border-emerald-600/30`

**Cancelled:**
- Background: `bg-slate-500/20`
- Text: `text-slate-400`
- Border: `border-slate-500/20`

## Typography

### Headings
- Page Title: `text-xl font-bold text-white`
- Section Title: `text-lg font-semibold text-white`
- Subsection Title: `text-sm font-semibold text-white`
- Card Title: `text-sm font-medium text-slate-200`

### Body Text
- Primary: `text-sm text-slate-200`
- Secondary: `text-sm text-slate-400`
- Tertiary: `text-xs text-slate-500`
- Muted: `text-xs text-slate-500`

### Labels
- Form Labels: `text-sm font-medium text-slate-200`
- Metadata Labels: `text-xs text-slate-400`
- Badge Labels: `text-xs`

## Spacing

### Padding
- Page Container: `p-6`
- Panel Content: `p-4` or `p-6`
- Card Content: `p-4`
- Form Fields: `px-3 py-2` or `px-3 py-1.5`
- Small Elements: `p-1` or `p-1.5`

### Margins
- Section Spacing: `mb-8` or `mb-6`
- Card Spacing: `mb-4`
- Field Spacing: `mb-2` or `space-y-4`
- Tight Spacing: `gap-2` or `gap-3`

### Gaps
- Standard: `gap-3` or `gap-4`
- Tight: `gap-2`
- Loose: `gap-6`

## Border Radius

- Buttons: `rounded-md` or `rounded-lg`
- Cards: `rounded-lg` or `rounded-xl`
- Badges: `rounded-full`
- Inputs: `rounded-lg`
- Small Elements: `rounded-md`

## Shadows

- Cards: `shadow-sm` or `shadow-md`
- Hover States: `shadow-lg shadow-indigo-900/20`
- Buttons: `shadow-sm` or `shadow-md`

## Component Patterns

### Buttons

**Primary Button:**
```tsx
className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
```

**Secondary Button:**
```tsx
className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium border border-slate-700"
```

**Outline Button:**
```tsx
className="bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white px-4 py-2 rounded-lg text-sm font-medium"
```

### Cards

**Primary Card:**
```tsx
className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm"
```

**Secondary Card:**
```tsx
className="rounded-lg border border-slate-800 bg-slate-800/50 p-4"
```

**Hover Card:**
```tsx
className="rounded-lg border border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 hover:border-slate-700 cursor-pointer transition-all"
```

### Input Fields

**Standard Input:**
```tsx
className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-10 rounded-lg px-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
```

**Select/Dropdown:**
```tsx
className="bg-slate-800 border-slate-700 text-white h-9 rounded-lg px-3 focus:border-indigo-500 focus:ring-indigo-500"
```

### Navigation

**Active Nav Item:**
```tsx
className="bg-indigo-600/10 text-indigo-400 px-3 py-2 rounded-lg text-sm font-medium"
```

**Inactive Nav Item:**
```tsx
className="text-slate-400 hover:bg-slate-800/50 px-3 py-2 rounded-lg text-sm font-medium"
```

### Status Badges

```tsx
className="text-xs px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center gap-1"
```

### Progress Bars

**Background:**
```tsx
className="h-2 w-full bg-slate-700/50 rounded-full overflow-hidden"
```

**Fill:**
```tsx
className="h-full bg-emerald-500 transition-all duration-500"
```

## Layout Patterns

### Page Container
```tsx
<div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
```

### Sidebar
```tsx
<div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
```

### Main Content Area
```tsx
<div className="flex-1 flex flex-col min-w-0">
```

### Header
```tsx
<header className="border-b border-slate-800 bg-slate-900/50">
```

### Panel/Sidebar
```tsx
<div className="w-[420px] bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden shadow-xl">
```

## Opacity Patterns

Use opacity modifiers for subtle layering:
- `/10`: Very subtle backgrounds (status badges, active states)
- `/20`: Subtle backgrounds (icon containers)
- `/30`: Light backgrounds (hover states)
- `/50`: Medium backgrounds (overlays, semi-transparent)

## Transition Patterns

Standard transitions for interactive elements:
```tsx
className="transition-all duration-200"
className="transition-colors"
className="transition-opacity duration-200"
```

## Best Practices

1. **Consistency**: Always use the defined color tokens, avoid custom colors
2. **Contrast**: Ensure sufficient contrast for accessibility (WCAG AA minimum)
3. **Hierarchy**: Use opacity and color intensity to create visual hierarchy
4. **States**: Always define hover, active, and disabled states
5. **Spacing**: Use consistent spacing tokens throughout
6. **Borders**: Use subtle borders (`border-slate-800`) for separation
7. **Shadows**: Use sparingly, primarily for elevation and depth

## Migration Guide

When migrating from light theme (`neutral-*`) to dark theme (`slate-*`):

1. **Backgrounds:**
   - `bg-white` → `bg-slate-900`
   - `bg-neutral-50` → `bg-slate-800/50`
   - `bg-neutral-100` → `bg-slate-800`

2. **Text:**
   - `text-neutral-900` → `text-white` or `text-slate-200`
   - `text-neutral-800` → `text-slate-200`
   - `text-neutral-500` → `text-slate-400` or `text-slate-500`
   - `text-neutral-400` → `text-slate-500`

3. **Borders:**
   - `border-neutral-200` → `border-slate-800`
   - `border-neutral-100` → `border-slate-700`

4. **Page Background:**
   - Add `bg-slate-950` to root container
   - Ensure `text-slate-200` for base text color




