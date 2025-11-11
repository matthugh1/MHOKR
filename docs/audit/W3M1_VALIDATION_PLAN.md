# Validation Plan for W3.M1

## Performance Validation

1. **Seed tenant with ~200 objectives, ~600 key results**
   - Use a test tenant or seed script to create large dataset
   - Ensure mix of visibility levels (PUBLIC_TENANT, PRIVATE, EXEC_ONLY)
   - Ensure mix of statuses (ON_TRACK, AT_RISK, BLOCKED, COMPLETED)

2. **Load `/dashboard/okrs` as TENANT_ADMIN**
   - Page should render within 2-3 seconds
   - Initial render should show first 20 objectives
   - Scroll should be smooth and responsive
   - Memory usage in React DevTools should not exceed 150MB for the list component
   - No console warnings about performance or excessive re-renders

3. **Test pagination**
   - Click "Next" button: should show objectives 21-40
   - Click "Previous" button: should return to objectives 1-20
   - Verify page indicator updates correctly
   - Verify "Previous" is disabled on first page
   - Verify "Next" is disabled on last page

4. **Test virtualisation**
   - Scroll through the virtualised list container
   - Verify rows mount/unmount cleanly without broken styles
   - Verify expand/collapse works correctly for objectives with many key results
   - Verify no visual glitches during scroll

## Pagination Validation

1. **Change pages using Next/Previous**
   - Page numbers should update correctly
   - List should show different subset of objectives
   - No backend API calls should occur when changing pages (verify in Network tab)
   - Data should be sliced client-side from the in-memory dataset

2. **Apply filters and verify pagination resets**
   - Change workspace filter: should reset to page 1
   - Change status filter: should reset to page 1
   - Change search query: should reset to page 1
   - Change cycle filter: should reset to page 1

## Security / Governance / Visibility Validation

1. **Login as TENANT_ADMIN**
   - Should see all objectives across pages (including PRIVATE and EXEC_ONLY)
   - Should see edit/delete buttons where allowed by governance rules
   - Should NOT see edit/delete buttons on locked/published objectives unless admin override applies
   - Should be able to scroll through all pages without console errors

2. **Login as WORKSPACE_LEAD**
   - Should NOT see PRIVATE exec-level OKRs in any page
   - Should see PUBLIC_TENANT and EXEC_ONLY OKRs (if whitelisted)
   - Should NOT see edit/delete buttons on locked/published objectives
   - Should NOT see edit/delete buttons for objectives outside their workspace/team (unless owner)
   - Should be able to scroll virtualised list with no console errors

3. **Login as CONTRIBUTOR**
   - Should only see OKRs they're allowed to view (owner or workspace/team member)
   - Should NOT see destructive actions (edit/delete) anywhere
   - Should NOT see PRIVATE exec-level OKRs
   - Should still be able to scroll virtualised list with no console errors
   - Should be able to check-in on KRs they own (if not locked)

4. **Test visibility edge cases**
   - Verify PRIVATE OKRs with whitelist work correctly
   - Verify EXEC_ONLY OKRs respect whitelist
   - Verify owner can always see their own OKRs
   - Verify cross-tenant isolation (should not see other tenants' OKRs)

## Regression Tests

1. **No forbidden "ghost" items**
   - Objectives should not render and then vanish
   - Key results should not appear and then disappear
   - No flickering or layout shifts during scroll

2. **No 403 buttons**
   - If edit/delete button is visible, action should succeed (or show lock dialog)
   - If check-in button is visible, action should succeed (or show lock dialog)
   - No console errors about permission denied

3. **No console warnings**
   - No React key warnings
   - No undefined prop warnings
   - No missing handler warnings
   - No memory leak warnings

4. **Functionality preserved**
   - Create new objective: should work and refresh list
   - Edit objective: should work and refresh list
   - Delete objective: should work and refresh list
   - Add key result: should work and refresh list
   - Add check-in: should work and refresh list
   - Add initiative: should work and refresh list
   - Open activity drawer: should load and display activity history
   - Expand/collapse objectives: should work smoothly

## Edge Cases

1. **Empty states**
   - No objectives: should show "No Objectives yet" message
   - No objectives after filter: should show "No OKRs found" message
   - Empty page (last page with fewer than 20 objectives): should render correctly

2. **Single page**
   - If filtered results ≤ 20: pagination controls should not show
   - If filtered results > 20: pagination controls should appear

3. **Filter combinations**
   - Multiple filters active: should show correct subset
   - Clear filters: should reset to all objectives
   - Change filters while on page 2+: should reset to page 1

4. **Very tall objectives**
   - Objectives with 20+ key results: should render correctly
   - Virtualisation should handle varying row heights gracefully
   - Expand/collapse should not break layout





