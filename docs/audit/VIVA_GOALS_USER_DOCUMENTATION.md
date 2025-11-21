# Viva Goals Feature Gaps - User Documentation

**Date:** 2025-01-27  
**Version:** 1.0  
**Status:** ✅ Complete

---

## Overview

This document describes the new features available to users in the OKR Nexus platform, added to support Viva Goals feature parity. These features enhance OKR management with goal classification, creator tracking, team assignment, and progress tracking.

---

## New Features

### 1. Goal Type Classification

**What it is:**
Goal Type allows you to classify your OKRs as either **Aspirational** (stretch goals) or **Committed** (must-achieve goals).

**Where to find it:**
- When creating a new Objective, Key Result, or Initiative
- When editing an existing Objective, Key Result, or Initiative
- Displayed as a badge on OKR rows

**How to use it:**

1. **Creating an OKR:**
   - Open the creation drawer/modal
   - Find the "Goal Type" dropdown
   - Select "Aspirational" (stretch goal) or "Committed" (must achieve)
   - Default is "Aspirational"

2. **Editing an OKR:**
   - Click "Edit" on an Objective, Key Result, or Initiative
   - Change the Goal Type dropdown
   - Save changes

**Visual Indicators:**
- Goal Type appears as a badge next to the OKR title
- "Aspirational" badge: Outline style
- "Committed" badge: Outline style

**Best Practices:**
- Use **Committed** for goals that are critical to business success
- Use **Aspirational** for stretch goals that push boundaries
- Consider aligning Goal Type across parent-child OKRs for consistency

---

### 2. Creator Tracking

**What it is:**
The system automatically tracks who created each OKR entity (Objective, Key Result, or Initiative).

**Where to find it:**
- Automatically populated when you create an OKR
- Visible in activity history
- Can be viewed in API responses

**How it works:**
- When you create an OKR, your user ID is automatically recorded as the creator
- This happens automatically - no action required
- Useful for auditing and understanding OKR ownership

**Note:** Creator tracking is automatic and cannot be manually changed through the UI (only via API for imports).

---

### 3. Team Assignment for Key Results and Initiatives

**What it is:**
You can now assign Key Results and Initiatives to specific teams, allowing better organization and visibility.

**Where to find it:**
- When creating a new Key Result or Initiative
- When editing an existing Key Result or Initiative
- Displayed as a badge on KR/Initiative rows (when assigned)

**How to use it:**

1. **Creating a Key Result or Initiative:**
   - Open the creation drawer/modal
   - Find the "Team" dropdown (if teams are available)
   - Select a team from the list
   - Leave as "None" if no team assignment needed

2. **Editing:**
   - Click "Edit" on a Key Result or Initiative
   - Change the Team dropdown
   - Save changes

**Inheritance:**
- If you don't specify a team, Key Results and Initiatives inherit the team from their parent Objective
- You can override this by explicitly selecting a different team

**Visual Indicators:**
- Team name appears as a badge when assigned
- Only shown when a team is assigned

**Best Practices:**
- Assign teams when the work is primarily owned by a specific team
- Use team assignment to improve visibility and accountability
- Consider team alignment when creating child OKRs

---

### 4. Progress Tracking for Initiatives

**What it is:**
You can now track progress percentage (0-100%) for Initiatives, providing a clear view of completion status.

**Where to find it:**
- When creating a new Initiative
- When editing an existing Initiative
- Displayed as a badge showing percentage (e.g., "75%")

**How to use it:**

1. **Creating an Initiative:**
   - Open the creation drawer/modal
   - Find the "Progress" field
   - Enter a number between 0 and 100
   - Leave empty if progress is not yet tracked

2. **Editing:**
   - Click "Edit" on an Initiative
   - Update the Progress field
   - Save changes

**Visual Indicators:**
- Progress appears as a badge showing percentage (e.g., "75%")
- Only shown when progress is set

**Best Practices:**
- Update progress regularly as work progresses
- Use progress to communicate status to stakeholders
- Combine with status (Not Started, In Progress, Completed) for complete visibility

---

### 5. "Not Started" Status

**What it is:**
A new status option for Objectives and Key Results to indicate work hasn't begun yet.

**Where to find it:**
- In all status dropdowns (create/edit forms)
- In status filter bar
- Displayed as a badge on OKR rows

**How to use it:**

1. **Setting Status:**
   - When creating an OKR, select "Not Started" from the status dropdown
   - When editing, change status to "Not Started"
   - Use the status filter to view only "Not Started" OKRs

**Visual Indicators:**
- "Not Started" badge appears with neutral styling
- Filter button available in the filter bar

**Best Practices:**
- Use "Not Started" for newly created OKRs that haven't begun work
- Transition to "On Track" once work begins
- Use status filters to identify OKRs that need attention

---

## Feature Comparison

### Before vs. After

| Feature | Before | After |
|---------|--------|-------|
| Goal Classification | ❌ Not available | ✅ Aspirational/Committed |
| Creator Tracking | ❌ Not tracked | ✅ Auto-tracked |
| Team Assignment (KR/Init) | ❌ Not available | ✅ Optional assignment |
| Progress (Initiatives) | ❌ Not available | ✅ 0-100% tracking |
| Status Options | 5 options | ✅ 6 options (added Not Started) |

---

## Common Workflows

### Creating a Committed Objective with Team-Assigned Key Results

1. Click "New Objective"
2. Fill in title, owner, cycle
3. Set Goal Type to "Committed"
4. Set Status to "Not Started" (optional)
5. Add Key Results
6. For each Key Result:
   - Set Goal Type (optional, defaults to Aspirational)
   - Assign to a Team (optional, inherits from Objective)
7. Review and publish

### Tracking Initiative Progress

1. Create or edit an Initiative
2. Set Progress to current percentage (e.g., 50)
3. Update Progress regularly as work progresses
4. Set Status to "Completed" when Progress reaches 100%

### Filtering by Status

1. Use the status filter bar at the top of the OKRs page
2. Click "Not Started" to view only not-started OKRs
3. Combine with other filters (cycle, owner, etc.) for targeted views

---

## Tips and Best Practices

### Goal Type
- **Committed** goals should be achievable and critical to success
- **Aspirational** goals can be stretch targets that push boundaries
- Consider your organization's culture when setting Goal Types
- Align Goal Types across related OKRs for consistency

### Team Assignment
- Assign teams when work is primarily owned by that team
- Use team assignment to improve cross-team visibility
- Consider team capacity when assigning work
- Review team assignments during OKR reviews

### Progress Tracking
- Update Initiative progress regularly (weekly or bi-weekly)
- Use progress to communicate status in check-ins
- Combine progress with status for complete picture
- Set realistic progress milestones

### Status Management
- Use "Not Started" for newly created OKRs
- Transition to "On Track" when work begins
- Update status regularly based on actual progress
- Use status filters to identify OKRs needing attention

---

## FAQs

**Q: Can I change the Goal Type after creating an OKR?**  
A: Yes, you can edit the Goal Type at any time through the edit form.

**Q: Do Key Results inherit Goal Type from their parent Objective?**  
A: No, Key Results default to "Aspirational" independently. You can set each KR's Goal Type separately.

**Q: Can I assign a Key Result to a different team than its parent Objective?**  
A: Yes, you can override the inherited team assignment by explicitly selecting a different team.

**Q: What happens if I don't set a team for a Key Result?**  
A: The Key Result will inherit the team from its parent Objective, if the Objective has a team assigned.

**Q: Can I track progress for Key Results?**  
A: Progress tracking is currently only available for Initiatives. Key Results use automatic progress calculation based on current/target values.

**Q: How do I filter OKRs by Goal Type?**  
A: Goal Type filtering is not yet available in the UI, but you can filter by status, cycle, owner, and other criteria.

**Q: Who can see the creator information?**  
A: Creator information is available in activity history and API responses. It's primarily used for auditing purposes.

---

## Related Features

- **Status Management**: Use status filters and updates to track OKR health
- **Team Management**: Assign teams to improve organization and visibility
- **Progress Tracking**: Use Initiative progress to communicate completion status
- **Activity History**: View creator and change history in the activity drawer

---

## Support

For questions or issues with these features:
1. Check the activity history to see creator information
2. Review the API documentation for technical details
3. Contact your system administrator for access or permission issues

---

**Last Updated:** 2025-01-27  
**Documentation Version:** 1.0

