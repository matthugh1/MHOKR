# Screenshot Documentation Guide

This document tracks where screenshots should be added to the documentation and any errors encountered during screenshot capture.

## Screenshots Needed

### Getting Started
- [ ] Registration page
- [ ] Login page
- [ ] Initial dashboard view

### Dashboard
- [ ] Organization health dashboard with KPIs
- [ ] Execution health section
- [ ] Operating rhythm feed
- [ ] My Dashboard personal view

### OKR Management
- [ ] OKRs list page
- [ ] Create objective modal
- [ ] Create key result modal
- [ ] Create initiative modal
- [ ] Expanded objective with key results
- [ ] Filter and search interface
- [ ] Attention drawer

### Visual Builder
- [ ] Visual builder canvas with nodes
- [ ] Node types (Objective, Key Result, Initiative)
- [ ] Edit panel
- [ ] Mini-map view
- [ ] Auto-layout example

### AI Assistant
- [ ] AI Assistant page
- [ ] Insights generated section
- [ ] Risk signals section
- [ ] Executive summary

### Check-ins
- [ ] Check-in modal
- [ ] Team check-in summary page
- [ ] Meeting mode view
- [ ] Check-in requests in My Dashboard

### Analytics
- [ ] Analytics page overview
- [ ] Key metrics cards
- [ ] Strategic coverage section
- [ ] Execution risk list
- [ ] Recent activity feed
- [ ] CSV export button

### Settings
- [ ] Organization settings page
- [ ] Workspace settings
- [ ] Team settings
- [ ] People/user management page
- [ ] User edit drawer with permissions

## Screenshot Capture Notes

1. **Login Required**: All screenshots except login/registration will require being logged into the application.

2. **Data Requirements**: To capture meaningful screenshots:
   - Need at least one organization with data
   - Should have objectives, key results, and initiatives
   - Multiple users and teams help show full functionality
   - Active cycle with check-ins

3. **Recommended Screenshot Tools**:
   - Browser DevTools (F12) → Command palette (Cmd+Shift+P) → "Capture screenshot"
   - Third-party tools like Shottr (Mac), Greenshot, or Snipping Tool
   - Browser extensions for full-page screenshots

4. **Screenshot Guidelines**:
   - Use high resolution (at least 1920x1080)
   - Include relevant UI elements
   - Crop to focus on specific features
   - Add annotations if needed (arrows, highlights)
   - Save as PNG for best quality

## Errors Encountered

### During Development
- Server already running on port 5173 (expected if app is running)
- No lint errors found in documentation files

### Potential Issues
- May need to create test data for comprehensive screenshots
- Some features may require specific permissions to access
- AI Assistant features are in beta and may show placeholder content

## Next Steps

1. Ensure the application is running
2. Log in with appropriate credentials
3. Create or ensure test data exists
4. Navigate to each documented page
5. Capture screenshots using preferred tool
6. Add screenshots to appropriate guide pages using `<img>` tags
7. Update this document to mark screenshots as complete

## Adding Screenshots to Documentation

Once screenshots are captured, add them to guide pages like this:

```tsx
<div className="my-6">
  <img 
    src="/screenshots/dashboard-overview.png" 
    alt="Organization health dashboard showing KPIs and metrics"
    className="rounded-lg border border-neutral-200 shadow-sm"
  />
  <p className="text-sm text-neutral-500 mt-2 text-center">
    Organization health dashboard with key performance indicators
  </p>
</div>
```

Store screenshots in: `/apps/web/public/screenshots/`


