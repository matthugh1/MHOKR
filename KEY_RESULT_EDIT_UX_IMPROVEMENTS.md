# Key Result Edit UX Improvements

## Current UX Issues Identified

### 1. **Dual Editing Modes - Confusing**
- **Inline editors** exist for: title, current value, target value, owner, status
- **Edit drawer** exists for: all fields including the above
- **Problem**: Users don't know when to use inline vs drawer
- **Impact**: Cognitive load, inconsistent experience

### 2. **Edit Button Discoverability**
- Edit button is buried inside expanded KR section
- Located in Metrics header (small, easy to miss)
- Only visible when KR is expanded
- **Problem**: Users may not find comprehensive edit option
- **Impact**: Users think they can't edit certain fields

### 3. **Visual Clutter**
- KR expanded section has:
  - Inline title editor
  - Inline numeric editors (current/target)
  - Inline owner editor
  - Inline status editor
  - Edit button in header
  - Multiple badges
  - Progress bars
- **Problem**: Too many interactive elements competing for attention
- **Impact**: Overwhelming, hard to scan

### 4. **Inconsistent Patterns**
- Objectives: Have Edit button in actions menu (clear, discoverable)
- Key Results: Edit button hidden in expanded section
- **Problem**: Different patterns for similar actions
- **Impact**: Users don't know where to look

### 5. **No Clear Hierarchy**
- All editing options appear equal in importance
- No visual indication of "quick edit" vs "full edit"
- **Problem**: No guidance on which editing method to use
- **Impact**: Users may use wrong method for their task

---

## Proposed UX Improvements

### Strategy: **Progressive Disclosure with Clear Hierarchy**

#### Option A: **Quick Actions + Full Edit** (Recommended)
**Concept**: Keep inline editing for quick changes, but make full edit more discoverable

**Changes**:
1. **Move Edit button to KR collapsed header** (always visible)
   - Add small edit icon next to KR title
   - Tooltip: "Edit all Key Result fields"
   - More discoverable, consistent with Objective pattern

2. **Add "Edit all" link in expanded section**
   - Small text link: "Edit all fields..."
   - Placed below inline editors
   - Provides alternative entry point

3. **Visual distinction**:
   - Inline editors: Subtle, for quick edits
   - Edit button: More prominent, for comprehensive edits
   - Use icon + text: "Edit" or "Edit all"

4. **Consolidate inline editing**:
   - Keep only most-used: title, current/target values
   - Move owner/status to drawer (less frequently changed)
   - OR: Keep all but make drawer button more prominent

#### Option B: **Drawer-Only Editing** (Simpler but less efficient)
**Concept**: Remove inline editing, use drawer for all edits

**Changes**:
1. Remove all inline editors from KR
2. Add prominent Edit button in collapsed header
3. Clicking anywhere on KR opens edit drawer
4. **Pros**: Consistent, clear, less clutter
5. **Cons**: Slower for quick edits, more clicks

#### Option C: **Contextual Menu** (Most flexible)
**Concept**: Right-click or menu button for edit options

**Changes**:
1. Add three-dot menu to KR collapsed header
2. Menu options:
   - "Quick edit" (inline for common fields)
   - "Edit all fields" (drawer)
   - "View details" (expand)
3. **Pros**: Flexible, discoverable, scalable
4. **Cons**: More complex, requires menu component

---

## Recommended Solution: **Option A (Enhanced)**

### Implementation Plan

#### 1. **Improve Edit Button Discoverability**

**Location 1: KR Collapsed Header** (Primary)
- Add edit icon button next to KR title
- Always visible (not just when expanded)
- Small, subtle but discoverable
- Position: Right side of title area

**Location 2: Expanded Section** (Secondary)
- Keep current Edit button in Metrics header
- Add "Edit all fields..." text link below inline editors
- Provides alternative entry point

#### 2. **Clarify Editing Hierarchy**

**Quick Edits (Inline)**:
- Title (most common)
- Current/Target values (frequent updates)
- Status (quick status changes)

**Full Edit (Drawer)**:
- All fields including above
- Description, metric type, cadence, dates, etc.
- Metadata (tags, contributors)

**Visual Cues**:
- Inline editors: Subtle hover states
- Edit button: More prominent, icon + text
- Tooltip on Edit: "Edit all Key Result fields"

#### 3. **Reduce Visual Clutter**

**Collapsed Header**:
- Title (with inline edit)
- Status badge
- Progress bar
- Edit icon button (new)

**Expanded Section**:
- Group related fields
- Use accordion/collapsible sections
- Reduce spacing where appropriate
- Clear visual hierarchy

#### 4. **Consistent Patterns**

**Match Objective Pattern**:
- Objectives have Edit button in actions area
- KRs should have similar discoverability
- Use same button style/placement pattern

---

## Specific UI Changes

### Change 1: Add Edit Icon to KR Collapsed Header

```tsx
{/* KR Collapsed Header */}
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2 flex-1">
    <InlineTitleEditor ... />
    {/* Edit button - always visible */}
    {onEditKeyResult && canEditKeyResult?.(kr.id) && (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onEditKeyResult(kr.id)
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-violet-100 rounded"
        aria-label="Edit all Key Result fields"
      >
        <Edit2 className="h-3.5 w-3.5 text-violet-600" />
      </button>
    )}
  </div>
  {/* Status badge, progress, etc. */}
</div>
```

### Change 2: Enhance Edit Button in Expanded Section

```tsx
{/* Metrics Section Header */}
<div className="flex items-center justify-between">
  <h5>Metrics</h5>
  {onEditKeyResult && canEditKeyResult?.(kr.id) && (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onEditKeyResult(kr.id)}
      className="text-violet-600 hover:text-violet-700"
    >
      <Edit2 className="h-3.5 w-3.5 mr-1.5" />
      Edit all fields
    </Button>
  )}
</div>
```

### Change 3: Add "Edit all" Link Below Inline Editors

```tsx
{/* After inline editors */}
{onEditKeyResult && canEditKeyResult?.(kr.id) && (
  <button
    onClick={() => onEditKeyResult(kr.id)}
    className="text-xs text-violet-600 hover:text-violet-700 hover:underline mt-2"
  >
    Edit all fields...
  </button>
)}
```

---

## Accessibility Improvements

1. **Keyboard Navigation**:
   - Tab order: Title → Edit button → Inline editors → Edit all link
   - Enter/Space on Edit button opens drawer
   - Escape closes drawer

2. **Screen Reader**:
   - Clear labels: "Edit all Key Result fields"
   - Announce when drawer opens/closes
   - Describe inline vs drawer editing options

3. **Focus Management**:
   - Focus moves to drawer when opened
   - Returns to trigger button when closed
   - Focus trap in drawer

---

## Testing Checklist

- [ ] Edit button visible in collapsed header
- [ ] Edit button works from collapsed header
- [ ] Edit button visible in expanded section
- [ ] "Edit all" link visible below inline editors
- [ ] All three entry points work correctly
- [ ] Keyboard navigation works
- [ ] Screen reader announces correctly
- [ ] Visual hierarchy is clear
- [ ] No visual clutter
- [ ] Consistent with Objective editing pattern

---

## Estimated Effort

- **UI Changes**: 2-3 hours
- **Accessibility**: 1 hour
- **Testing**: 1 hour
- **Total**: 4-5 hours

---

## Success Metrics

- Users can find Edit button within 3 seconds
- Edit button usage increases (analytics)
- Reduced support questions about editing KRs
- Consistent editing experience across Objectives and KRs

