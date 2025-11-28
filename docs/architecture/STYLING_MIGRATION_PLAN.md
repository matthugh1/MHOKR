# Styling Migration Plan: Dark Theme Standardization

## Current Situation

The OKR Framework application currently has **inconsistent styling** across pages:

- **OKR Hierarchy Page**: Uses dark theme with `slate-*` colors (`bg-slate-950`, `bg-slate-900`, `text-slate-200`, etc.)
- **Other Dashboard Pages**: Use light theme with `neutral-*` colors (`bg-white`, `border-neutral-200`, `text-neutral-900`, etc.)

**Decision**: Standardize on the **dark theme** styling from the OKR hierarchy page across the entire application.

## Reference Documentation

- **Dark Theme Design System**: `docs/architecture/DARK_THEME_DESIGN_SYSTEM.md`
- **Original Design System**: `docs/architecture/DESIGN_SYSTEM.md` (to be updated)

## Migration Strategy

### Phase 1: Shared Components (Priority: High)

Update reusable components to use dark theme:

1. **Layout Components**
   - `components/dashboard-layout/DashboardLayout.tsx`
   - `components/ui/PageContainer.tsx`
   - `components/ui/PageHeader.tsx`

2. **UI Components**
   - `components/ui/card.tsx`
   - `components/ui/button.tsx`
   - `components/ui/input.tsx`
   - `components/ui/select.tsx`
   - `components/ui/StatCard.tsx`
   - `components/ui/SectionHeader.tsx`

3. **OKR Components**
   - `components/okr/StatusBadge.tsx`
   - `components/okr/ObjectiveCard.tsx`
   - `components/okr/ActivityItemCard.tsx`

### Phase 2: Dashboard Pages (Priority: Medium)

Migrate pages in this order:

1. **Main Dashboard** (`apps/web/src/app/dashboard/page.tsx`)
   - High visibility, entry point
   - Uses `PageContainer`, `PageHeader`, `StatCard`

2. **Analytics Page** (`apps/web/src/app/dashboard/analytics/page.tsx`)
   - Uses `StatCard`, `SectionHeader`, cards

3. **Settings Pages**
   - Organization Settings
   - People Settings
   - Workspaces Settings
   - Teams Settings

4. **Other Pages**
   - Builder Page
   - Check-ins Page
   - AI Page
   - Pillars Page

### Phase 3: Forms and Modals (Priority: Medium)

Update all form components and modals:

- `components/okr/NewObjectiveModal.tsx`
- `components/okr/EditObjectiveModal.tsx`
- `components/okr/NewCheckInModal.tsx`
- All form components in `components/okr/`

### Phase 4: Global Styles (Priority: Low)

Update `globals.css` to set dark theme as default:

- Update CSS variables if needed
- Ensure dark theme is applied globally
- Remove any light theme overrides

## Color Mapping Reference

### Backgrounds
| Light Theme | Dark Theme |
|------------|------------|
| `bg-white` | `bg-slate-900` |
| `bg-neutral-50` | `bg-slate-800/50` |
| `bg-neutral-100` | `bg-slate-800` |
| `bg-neutral-200` | `bg-slate-700` |

### Text
| Light Theme | Dark Theme |
|------------|------------|
| `text-neutral-900` | `text-white` or `text-slate-200` |
| `text-neutral-800` | `text-slate-200` |
| `text-neutral-500` | `text-slate-400` |
| `text-neutral-400` | `text-slate-500` |

### Borders
| Light Theme | Dark Theme |
|------------|------------|
| `border-neutral-200` | `border-slate-800` |
| `border-neutral-100` | `border-slate-700` |

## Implementation Checklist

### For Each Component/Page:

- [ ] Replace `bg-white` with `bg-slate-900`
- [ ] Replace `bg-neutral-*` with `bg-slate-*` equivalents
- [ ] Replace `text-neutral-*` with `text-slate-*` or `text-white`
- [ ] Replace `border-neutral-*` with `border-slate-*`
- [ ] Update hover states to use `hover:bg-slate-800/50` or `hover:bg-slate-700`
- [ ] Ensure sufficient contrast for accessibility
- [ ] Test interactive states (hover, active, disabled)
- [ ] Verify spacing and padding remain consistent
- [ ] Check that status colors (emerald, amber, rose) work well on dark backgrounds

## Testing Checklist

After migration:

- [ ] Visual regression testing
- [ ] Accessibility testing (contrast ratios)
- [ ] Interactive element testing (hover, focus, active states)
- [ ] Cross-browser testing
- [ ] Mobile responsiveness testing
- [ ] User acceptance testing

## Notes

- The OKR hierarchy page serves as the **reference implementation**
- All new components should follow the dark theme design system
- Consider creating a Storybook or component library for consistency
- Document any deviations from the standard with justification

## Timeline Estimate

- **Phase 1** (Shared Components): 2-3 days
- **Phase 2** (Dashboard Pages): 3-5 days
- **Phase 3** (Forms/Modals): 2-3 days
- **Phase 4** (Global Styles): 1 day

**Total**: ~8-12 days of focused development work

## Questions/Decisions Needed

1. Should we maintain light theme support for future use?
2. Do we need a theme toggle/switcher?
3. Should we update the original `DESIGN_SYSTEM.md` or keep both documents?
4. Are there any pages/components that should remain light theme for specific reasons?




