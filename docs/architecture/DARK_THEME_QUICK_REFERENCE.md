# Dark Theme Quick Reference

Quick lookup guide for migrating components to dark theme.

## Common Replacements

### Backgrounds
```tsx
// Old (Light)          →  New (Dark)
bg-white               →  bg-slate-900
bg-neutral-50          →  bg-slate-800/50
bg-neutral-100         →  bg-slate-800
bg-neutral-200         →  bg-slate-700
```

### Text Colors
```tsx
// Old (Light)          →  New (Dark)
text-neutral-900       →  text-white
text-neutral-800       →  text-slate-200
text-neutral-500       →  text-slate-400
text-neutral-400       →  text-slate-500
```

### Borders
```tsx
// Old (Light)          →  New (Dark)
border-neutral-200     →  border-slate-800
border-neutral-100     →  border-slate-700
```

### Hover States
```tsx
// Old (Light)          →  New (Dark)
hover:bg-neutral-100   →  hover:bg-slate-800/50
hover:bg-neutral-200   →  hover:bg-slate-700
hover:text-neutral-900 →  hover:text-white
```

## Component Templates

### Card
```tsx
// Light Theme
<div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">

// Dark Theme
<div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
```

### Button Primary
```tsx
// Light Theme
<button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">

// Dark Theme (same - indigo works on dark)
<button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">
```

### Button Secondary
```tsx
// Light Theme
<button className="bg-neutral-100 hover:bg-neutral-200 text-neutral-900 px-4 py-2 rounded-lg">

// Dark Theme
<button className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg">
```

### Input Field
```tsx
// Light Theme
<input className="bg-white border-neutral-200 text-neutral-900 placeholder:text-neutral-500">

// Dark Theme
<input className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500">
```

### Text Hierarchy
```tsx
// Light Theme
<h1 className="text-neutral-900">Title</h1>
<p className="text-neutral-800">Body</p>
<span className="text-neutral-500">Muted</span>

// Dark Theme
<h1 className="text-white">Title</h1>
<p className="text-slate-200">Body</p>
<span className="text-slate-400">Muted</span>
```

## Page Container Pattern

```tsx
// Root container (add to page root)
<div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
  {/* Content */}
</div>
```

## Status Colors (Same for Both Themes)

- On Track: `bg-emerald-500/10 text-emerald-400 border-emerald-500/20`
- At Risk: `bg-amber-500/10 text-amber-400 border-amber-500/20`
- Off Track: `bg-rose-500/10 text-rose-400 border-rose-500/20`

## Common Patterns from Hierarchy Page

### Sidebar
```tsx
<div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
```

### Header
```tsx
<header className="border-b border-slate-800 bg-slate-900/50">
```

### Panel
```tsx
<div className="bg-slate-900 border-l border-slate-800 flex flex-col">
```

### List Item (Hover)
```tsx
<div className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer">
```

### Active/Selected State
```tsx
<div className="bg-indigo-500/10 text-indigo-400 border-l-2 border-l-indigo-500">
```

## Tips

1. **Always test contrast** - Ensure text is readable on dark backgrounds
2. **Use opacity** - `/50`, `/30`, `/10` for subtle layering
3. **Indigo accents** - Keep indigo-600/500/400 for primary actions (works on dark)
4. **Status colors** - Emerald, amber, rose work well on dark backgrounds
5. **Borders** - Use `border-slate-800` for primary, `border-slate-700` for secondary

## See Also

- Full Design System: `docs/architecture/DARK_THEME_DESIGN_SYSTEM.md`
- Migration Plan: `docs/architecture/STYLING_MIGRATION_PLAN.md`







