# Viva Goals-Inspired OKR Page Recommendations

## Overview
Based on the Viva Goals interface, here are specific recommendations to make our OKR page cleaner, more intuitive, and better aligned with modern OKR management UX patterns.

---

## 1. Two-Panel Layout (High Priority)

### Current State
- Single-column layout with expandable rows
- Details shown inline when rows are expanded
- Can only view one objective's details at a time

### Viva Goals Approach
- **Left Panel**: Hierarchical list of objectives/KPIs in table format
- **Right Panel**: Dedicated detail view showing selected objective/KR
- Both panels visible simultaneously
- Clicking an item in the left panel updates the right panel

### Recommendation
Implement a split-panel layout:
- **Left Panel (40-45% width)**: Table/list view with objectives and key results
- **Right Panel (55-60% width)**: Detail view panel showing:
  - Progress visualization (graph with expected vs actual)
  - Check-in history
  - Action buttons (Check-in, Comment, Share)
  - Tabs for Overview, Key Results, Deliverables, Child Objectives, Activity

**Benefits:**
- Faster navigation between objectives
- More space for detailed progress visualization
- Better for comparing objectives side-by-side
- Reduces need to expand/collapse rows

**Implementation Notes:**
- Use a resizable splitter between panels
- Right panel should be collapsible (show/hide button)
- On mobile, show list view by default, detail view as modal/drawer

---

## 2. Table-Based List View (High Priority)

### Current State
- Card-based rows with lots of visual elements
- Information scattered across badges, progress bars, avatars
- Hard to scan quickly

### Viva Goals Approach
- Clean table format with columns:
  - **Title** (with hierarchy indicators)
  - **Owner** (avatar + name)
  - **Team** (team name with icon)
  - **Status and progress** (combined column with colored bar + percentage)

### Recommendation
Convert the list to a table format:

```
| Title                          | Owner        | Team              | Status & Progress |
|-------------------------------|--------------|-------------------|-------------------|
| ▶ 2025 -- Build Leading CX... | Frederic L.  | Puzzel, All Puzzel| [At Risk] 100%   |
|   ⏰ Improve EBITDA to 134M   | Frederic L.  | Unassigned        | [On Track] 75%   |
|   ⏰ Improve NRR > 105%       | Frederic L.  | Unassigned        | [At Risk] 45%    |
```

**Key Features:**
- Collapsible parent objectives (▶ when collapsed, ▼ when expanded)
- Nested KPIs indented with clock icon (⏰)
- Status shown as colored bar + text label
- Progress shown as percentage or "X of Y" format
- Clicking a row selects it and shows details in right panel

**Benefits:**
- Much easier to scan and compare
- More information visible at once
- Familiar table pattern for users
- Better for large datasets

---

## 3. Cleaner Filter UI (Medium Priority)

### Current State
- Multiple rows of filter buttons
- Status filters shown as individual buttons
- Active filters shown as badges below filters

### Viva Goals Approach
- Filters shown as removable chips/pills at the top
- Each active filter has an "×" to remove it
- "+ Add filter" button to add more
- "Show less filters" link to collapse advanced filters

### Recommendation
Redesign filter bar:

```
[Object Type: objective... ×] [Time Period: Annual... ×] [Owner: Frederic Lazi... ×] [+ Add filter] [Show less filters]
```

**Key Features:**
- Active filters as removable chips (not separate badges)
- Inline filter removal (× button on each chip)
- Collapsible advanced filters section
- Cleaner, less cluttered appearance

**Benefits:**
- More compact
- Clearer indication of active filters
- Easier to remove individual filters
- Less visual noise

---

## 4. Enhanced Progress Visualization (High Priority)

### Current State
- Simple progress bars
- Trend charts shown inline when expanded
- Limited historical context

### Viva Goals Approach
- Large progress graph showing:
  - **Expected (phased targets)**: Grey dotted line with square markers
  - **Actual**: Blue solid line with circular markers
  - Time-based X-axis (months)
  - Value-based Y-axis
- Current value prominently displayed
- Progress bar showing percentage to target

### Recommendation
Enhance the detail panel with:

1. **Progress Graph Section:**
   - Toggle between "Graph" and "Table" views
   - Graph shows:
     - Expected trajectory (from start to target over time)
     - Actual check-in values over time
     - Clear markers for each data point
     - Month labels on X-axis
     - Value labels on Y-axis

2. **Current Progress Display:**
   - Large, prominent current value
   - Format: "Current: 102.42M (START: 0 | TARGET: 134M)"
   - Visual progress bar showing percentage complete
   - Status indicator (On Track / At Risk / Not Started)

3. **Last Check-in Section:**
   - Show last check-in with:
     - Owner avatar and name
     - Timestamp (relative: "3mo ago")
     - Check-in value and notes
     - Status comparison (Behind / Ahead / On Track)

**Benefits:**
- Better understanding of progress trajectory
- Easier to spot trends and issues
- More context for decision-making
- Professional, data-driven appearance

---

## 5. Improved Status Indicators (Medium Priority)

### Current State
- Status badges with text labels
- Color coding exists but could be clearer

### Viva Goals Approach
- Colored horizontal bars for status:
  - **Green bar**: On Track
  - **Red bar**: At Risk
  - **Grey bar**: Not Started
- Status text next to the bar
- More visual, less text-heavy

### Recommendation
Replace status badges with colored bars:

```
Status: [████████░░] On Track
Status: [█████░░░░░] At Risk  
Status: [░░░░░░░░░░] Not Started
```

Or use a simpler approach:
- Colored bar indicator (not a progress bar, just a status indicator)
- Status text label
- Combined in the "Status & Progress" column

**Benefits:**
- More visual, faster to scan
- Less text clutter
- Consistent with Viva Goals pattern

---

## 6. Hierarchical Display Improvements (Medium Priority)

### Current State
- Hierarchy exists but could be clearer
- Uses indentation and icons

### Viva Goals Approach
- Parent objectives shown with caret (▶ collapsed, ▼ expanded)
- KPIs nested under objectives with clock icon (⏰)
- Clear visual hierarchy
- Collapse/expand at objective level

### Recommendation
Enhance hierarchy display:

1. **Visual Indicators:**
   - ▶ for collapsed parent objectives
   - ▼ for expanded parent objectives  
   - ⏰ for key results (KPIs)
   - 🎯 for objectives (if needed)

2. **Indentation:**
   - Parent objectives: no indent
   - Key results: 1 level indent (e.g., 24px)
   - Child objectives: 1 level indent
   - Nested items: 2+ levels indent

3. **Interaction:**
   - Click caret to expand/collapse
   - Click row to select and show in detail panel
   - Visual feedback on hover

**Benefits:**
- Clearer parent-child relationships
- Easier to navigate large hierarchies
- More intuitive collapse/expand behavior

---

## 7. Detail Panel Action Buttons (Low Priority)

### Current State
- Actions scattered in various places
- Check-in buttons on individual KRs
- Edit/Delete in menus

### Viva Goals Approach
- Prominent action buttons in detail panel header:
  - **Check-in** (primary, blue button with checkmark)
  - **Comment**
  - **Share** (with dropdown)
  - **More** (ellipsis menu)

### Recommendation
Add action buttons to detail panel header:

```
[Improve EBITDA to 134M]  [✓ Check-in] [💬 Comment] [↗ Share ▼] [...]
```

**Key Features:**
- Primary action (Check-in) most prominent
- Secondary actions (Comment, Share) visible but less prominent
- More menu for additional actions (Edit, Delete, History, etc.)
- Context-aware (e.g., Check-in only for KRs, not objectives)

**Benefits:**
- Clearer call-to-action
- More discoverable actions
- Better organization of actions
- Consistent with Viva Goals pattern

---

## 8. Tabbed Detail View (Medium Priority)

### Current State
- All information shown in expanded row
- No clear organization of different content types

### Viva Goals Approach
- Tabs in detail panel:
  - **Overview** (default)
  - **Key Results**
  - **Deliverables**
  - **Child Objectives**
  - **Activity**

### Recommendation
Add tabs to detail panel:

1. **Overview Tab:**
   - Progress graph
   - Current value and target
   - Status and progress bar
   - Last check-in
   - Owner and team info

2. **Key Results Tab:**
   - List of all key results
   - Progress for each KR
   - Status indicators
   - Quick actions (Check-in, Edit)

3. **Deliverables Tab:**
   - List of initiatives/deliverables
   - Status and due dates
   - Progress tracking

4. **Child Objectives Tab:**
   - Nested objectives (if any)
   - Alignment visualization

5. **Activity Tab:**
   - Check-in history
   - Comments
   - Status changes
   - Timeline view

**Benefits:**
- Better organization of information
- Less overwhelming detail view
- Easier to find specific information
- More scalable as features grow

---

## 9. Team Display Enhancement (Low Priority)

### Current State
- Team shown as text or badge

### Viva Goals Approach
- Team shown with icon:
  - 🌐 Globe icon for organization-wide teams
  - 👥 Two-person icon for smaller teams
  - Clear visual distinction

### Recommendation
Add team icons:
- Use globe icon (🌐) for organization/workspace-level teams
- Use people icon (👥) for smaller teams
- Show "Unassigned" clearly when no team

**Benefits:**
- Quick visual identification
- Better at-a-glance understanding
- Consistent with Viva Goals pattern

---

## 10. Progress Display Format (Low Priority)

### Current State
- Progress shown as percentage
- Some numeric values shown

### Viva Goals Approach
- Progress shown as "Reach 134M" or "Stay above 105%"
- Current value: "102.42M"
- Clear start/target context: "START: 0 | TARGET: 134M"

### Recommendation
Improve progress display format:

1. **For Numeric KRs:**
   - Current: "102.42M"
   - Context: "EBITDA: 102.42M (START: 0 | TARGET: 134M)"
   - Progress bar showing percentage

2. **For Percentage KRs:**
   - Current: "105.2%"
   - Context: "NRR: 105.2% (TARGET: > 105%)"
   - Progress bar showing percentage

3. **For Completion KRs:**
   - "Measure as 100% complete"
   - Or "X of Y completed"

**Benefits:**
- More context for progress
- Clearer understanding of targets
- Better for numeric metrics
- More informative

---

## Implementation Priority

### Phase 1 (High Impact, High Priority)
1. ✅ Two-panel layout
2. ✅ Table-based list view
3. ✅ Enhanced progress visualization

### Phase 2 (Medium Impact, Medium Priority)
4. ✅ Cleaner filter UI
5. ✅ Improved status indicators
6. ✅ Hierarchical display improvements
7. ✅ Tabbed detail view

### Phase 3 (Polish, Lower Priority)
8. ✅ Detail panel action buttons
9. ✅ Team display enhancement
10. ✅ Progress display format improvements

---

## Technical Considerations

### Component Structure
```
OKRsPage
├── FilterBar (top, full width)
├── SplitPanelLayout
│   ├── LeftPanel (40-45% width)
│   │   └── OKRTable
│   │       ├── TableHeader
│   │       └── TableRows (virtualized)
│   │           ├── ObjectiveRow
│   │           └── KeyResultRow (nested)
│   └── RightPanel (55-60% width, collapsible)
│       └── OKRDetailPanel
│           ├── DetailHeader (title, actions)
│           ├── DetailTabs (Overview, Key Results, etc.)
│           └── DetailContent (tab-specific content)
```

### State Management
- Selected OKR ID stored in URL query params (for shareability)
- Panel width preferences stored in localStorage
- Filter state in URL query params

### Performance
- Virtualize table rows (already done)
- Lazy load detail panel content
- Debounce filter changes
- Cache detail panel data

### Responsive Design
- Desktop: Two-panel layout
- Tablet: Two-panel layout (narrower)
- Mobile: List view by default, detail view as drawer/modal

---

## Migration Strategy

1. **Phase 1**: Implement two-panel layout alongside existing expandable rows (feature flag)
2. **Phase 2**: Convert list to table format
3. **Phase 3**: Add enhanced progress visualization
4. **Phase 4**: Migrate filters to chip-based UI
5. **Phase 5**: Add tabs to detail panel
6. **Phase 6**: Polish and refinements

---

## Success Metrics

- **Usability**: Time to find specific OKR reduced by 30%
- **Engagement**: Check-in rate increased by 20%
- **Satisfaction**: User satisfaction score improved
- **Performance**: Page load time maintained or improved
- **Adoption**: 80%+ users prefer new layout after 2 weeks

---

## Conclusion

These recommendations will transform the OKR page into a cleaner, more intuitive interface that matches the quality of Viva Goals while maintaining our unique features and capabilities. The two-panel layout and table-based list view are the highest-impact changes that will provide immediate value to users.


