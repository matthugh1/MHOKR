# Feature Request: Fix Radix UI DialogContent Accessibility Warnings

## Story
As a developer, I want to resolve the Radix UI accessibility warnings for DialogContent components so that the application meets accessibility standards and console warnings are eliminated.

## Context
When clicking on the "Add Key Objective" or "Add Key Result" dropdown in the OKR screen, a right side panel (Sheet component) appears, and console errors are triggered:

```
DialogContent requires a DialogTitle for the component to be accessible for screen reader users.
Missing Description or aria-describedby={undefined} for {DialogContent}.
```

## Current State
- **OKRCreationDrawer** (`apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx`):
  - Has `SheetTitle` and `SheetDescription` components properly structured
  - Uses `SheetHeader` wrapper (matching other working Sheet components)
  - Includes explicit `aria-labelledby` and `aria-describedby` attributes
  - Components are always rendered with non-empty content
  
- **CommandDialog** (`apps/web/src/components/ui/command.tsx`):
  - ✅ Fixed: Added `DialogTitle` and `DialogDescription` wrapped in `VisuallyHidden`
  - This was missing the required accessibility components

## Issue
Despite having the correct structure, Radix UI is still not detecting the `SheetTitle` and `SheetDescription` components in `OKRCreationDrawer`. This could be due to:

1. React StrictMode double-render timing issues
2. Radix UI checking all DialogContent components when any dialog opens
3. Component detection happening before React finishes rendering
4. Portal rendering timing issues with Sheet components

## Attempted Solutions
1. ✅ Simplified conditional rendering in SheetTitle/SheetDescription
2. ✅ Made SheetTitle/SheetDescription direct children of SheetContent
3. ✅ Wrapped components in SheetHeader (matching working examples)
4. ✅ Added explicit aria-labelledby/aria-describedby attributes
5. ✅ Used useMemo for stable title/description references
6. ✅ Fixed CommandDialog component (missing Title/Description)

## Acceptance Criteria
- [ ] No console warnings when opening the OKR creation drawer
- [ ] SheetTitle and SheetDescription are properly detected by Radix UI
- [ ] All DialogContent components have associated DialogTitle and DialogDescription
- [ ] Accessibility is maintained for screen readers
- [ ] No visual regressions in the UI

## Technical Notes
- Radix UI uses React context to detect DialogTitle and DialogDescription components
- Components must be descendants of DialogContent (or SheetContent, which wraps DialogPrimitive.Content)
- If components need to be hidden, wrap them in VisuallyHidden from `@radix-ui/react-visually-hidden`
- The Sheet component wraps Radix UI's Dialog primitive

## Priority
**Medium** - This is a console warning that doesn't break functionality but impacts accessibility compliance and developer experience.

## Related Files
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx`
- `apps/web/src/components/ui/sheet.tsx`
- `apps/web/src/components/ui/command.tsx`
- `apps/web/src/components/ui/dialog.tsx`

## References
- [Radix UI Dialog Documentation](https://radix-ui.com/primitives/docs/components/dialog)
- [Radix UI VisuallyHidden Documentation](https://radix-ui.com/primitives/docs/utilities/visually-hidden)

