# OKR Mini Sprint 4.0 – Validation Helper Script

**Purpose:** Browser console helper for capturing telemetry events during validation

## Setup

Paste this into browser console before starting validation:

```javascript
// Telemetry Event Listener
window.addEventListener('analytics', (e) => {
  console.log('[TELEMETRY]', e.detail.name, e.detail);
  window.__okrTelemetry = window.__okrTelemetry || [];
  window.__okrTelemetry.push({
    timestamp: new Date().toISOString(),
    event: e.detail.name,
    payload: e.detail
  });
});

// Helper to view captured events
window.getTelemetryEvents = () => {
  return window.__okrTelemetry || [];
};

// Helper to clear events
window.clearTelemetryEvents = () => {
  window.__okrTelemetry = [];
};

// Helper to filter by event name
window.getTelemetryByEvent = (eventName) => {
  return (window.__okrTelemetry || []).filter(e => e.event === eventName);
};

// Helper to export as JSON
window.exportTelemetry = () => {
  return JSON.stringify(window.__okrTelemetry || [], null, 2);
};

console.log('✅ OKR Telemetry listener active. Use getTelemetryEvents() to view captured events.');
```

## Usage

1. **Open browser console** before starting validation
2. **Paste the script above** and press Enter
3. **Perform validation steps** - events will be captured automatically
4. **View captured events:**
   - `getTelemetryEvents()` - View all events
   - `getTelemetryByEvent('attention_drawer_opened')` - Filter by event name
   - `exportTelemetry()` - Get JSON string for export

## Expected Events

### Attention Drawer
- `attention_drawer_opened` - When drawer opens
- `attention_empty_state_viewed` - When empty state shown

### Cycle Management
- `cycle_drawer_opened` - When drawer opens
- `cycle_created` - When cycle created
- `cycle_archived` - When cycle archived
- `cycle_set_active` - When cycle set active

## Network Request Capture

To capture network requests, use browser DevTools → Network tab:
- Filter by: `/okr/insights/attention` or `/okr/cycles`
- Right-click request → Copy → Copy as cURL
- Or use DevTools → Network → Export HAR

