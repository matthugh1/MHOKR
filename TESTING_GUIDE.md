# Visual Builder Testing Guide

## 🚀 Quick Start

1. **Access the application**: http://localhost:5173
2. **Login**: Use your existing account or register a new one
3. **Navigate**: Dashboard → Visual Builder

---

## ✅ Testing Checklist

### 1. Slide-Out Edit Panel ✅
**Test Steps**:
1. Click on any node (Objective, Key Result, or Initiative)
2. **Expected**: Slide-out panel appears from the right side
3. **Expected**: Canvas remains visible on the left
4. **Expected**: Backdrop overlay dims the canvas slightly
5. Click outside the panel (on backdrop) or X button
6. **Expected**: Panel closes smoothly

**What to Verify**:
- ✅ Panel slides in smoothly from right
- ✅ Canvas is still visible and not blocked
- ✅ Can reference other nodes while editing
- ✅ Backdrop click closes panel
- ✅ X button closes panel

---

### 2. Inline Title Editing ✅
**Test Steps**:
1. Double-click on any node title
2. **Expected**: Input field appears directly on the node
3. Type a new title
4. Press **Enter** to save
5. **Expected**: Title updates immediately
6. **Expected**: Change is saved to backend

**Alternative Test**:
1. Double-click title
2. Type new title
3. Press **Escape** to cancel
4. **Expected**: Original title restored

**What to Verify**:
- ✅ Double-click triggers inline edit
- ✅ Input field appears on node
- ✅ Enter saves, Escape cancels
- ✅ Changes persist after refresh
- ✅ Works for all node types

---

### 3. Progressive Disclosure Tabs ✅
**Test Steps**:
1. Click on a node to open edit panel
2. **Expected**: See three tabs: "Basic", "Details", "Advanced"
3. Click each tab
4. **Expected**: Form content changes appropriately

**Basic Tab Should Show**:
- Title field
- Description (for Objectives)
- Progress/Status fields
- Current/Target values (for Key Results)

**Details Tab Should Show**:
- Period selector
- Date fields
- Time frame options

**Advanced Tab Should Show**:
- Owner selection
- Context assignment (Organization/Workspace/Team)
- Parent objective (for Objectives)
- Metric type (for Key Results)

**What to Verify**:
- ✅ Tabs switch smoothly
- ✅ Each tab shows relevant fields only
- ✅ Common fields in Basic tab
- ✅ Advanced options don't clutter Basic view

---

### 4. Auto-Save Positions ✅
**Test Steps**:
1. Drag a node to a new position
2. Stop dragging and wait ~1 second
3. **Expected**: See "Saving..." indicator in top toolbar
4. **Expected**: Indicator changes to "Saved ✓" after ~1 second
5. Refresh the page
6. **Expected**: Node position is preserved

**What to Verify**:
- ✅ No manual "Save Layout" button needed
- ✅ "Saving..." indicator appears after drag
- ✅ "Saved ✓" confirmation appears
- ✅ Positions persist after refresh
- ✅ Doesn't save excessively (debounced)

---

### 5. Enhanced Node Visuals ✅
**Test Steps**:
1. Hover over different nodes
2. **Expected**: Nodes scale slightly (1.02x) and shadow increases
3. **Expected**: Connection handles are always visible (small circles)
4. Click and drag from bottom handle
5. **Expected**: Connection line appears
6. Drop on another node's top handle
7. **Expected**: Connection is created

**What to Verify**:
- ✅ Nodes are larger (260px width)
- ✅ Hover effects work smoothly
- ✅ Connection handles are visible
- ✅ Handles are easier to grab (4px vs 3px)
- ✅ Visual feedback on all interactions

---

### 6. Full Edit Workflow ✅
**Test Steps**:
1. Click on an Objective node
2. Panel opens → Edit fields in Basic tab
3. Change title
4. Switch to Details tab → Change period
5. Switch to Advanced tab → Change owner
6. Click "Save Changes" button
7. **Expected**: Changes saved
8. **Expected**: Panel closes
9. **Expected**: Node updates on canvas

**What to Verify**:
- ✅ Full edit workflow works end-to-end
- ✅ All tabs save correctly
- ✅ Node updates after save
- ✅ Panel closes after save
- ✅ Can cancel without saving

---

## 🐛 Known Issues to Watch For

1. **Panel Animation**: Should slide smoothly from right
2. **Inline Edit Focus**: Input should auto-focus and select text
3. **Auto-Save Timing**: Should debounce properly (not save too frequently)
4. **Tab Switching**: Should preserve form data when switching tabs
5. **Connection Handles**: Should be visible but not too prominent

---

## 📝 Test Scenarios

### Scenario 1: Quick Title Change
1. Double-click node title
2. Change title
3. Press Enter
4. **Result**: Title updates, no panel opens ✅

### Scenario 2: Full Edit Session
1. Click node
2. Panel opens
3. Edit multiple fields across tabs
4. Save
5. **Result**: All changes saved ✅

### Scenario 3: Cancel Edit
1. Click node
2. Panel opens
3. Make changes
4. Click Cancel or backdrop
5. **Result**: Changes discarded, panel closes ✅

### Scenario 4: Repositioning Nodes
1. Drag node to new position
2. Wait for auto-save
3. Refresh page
4. **Result**: Position preserved ✅

---

## ✅ Success Criteria

- [ ] Slide-out panel doesn't block canvas
- [ ] Inline editing works for quick edits
- [ ] Auto-save works without manual intervention
- [ ] Tabbed form reduces overwhelm
- [ ] All edits persist correctly
- [ ] Visual feedback is clear
- [ ] No console errors
- [ ] Smooth animations throughout

---

## 🚨 If Something Doesn't Work

1. **Check Browser Console**: Look for JavaScript errors
2. **Check Network Tab**: Verify API calls are successful
3. **Try Refresh**: Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
4. **Check Services**: Ensure all services are running (ports 3000-3003, 5173)

---

## 🎯 Before Phase 2

Please test all the above and provide feedback on:
- What works well ✅
- What needs improvement ⚠️
- Any bugs or issues 🐛
- Suggestions for Phase 2 💡

---

**Happy Testing!** 🚀





