# Clear Browser Cache After Deployment

After deploying a new version of the web app, users may see the old cached JavaScript files. Here's how to fix it:

## Quick Fix: Hard Refresh

### Chrome/Edge/Firefox
- **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

### Safari (Mac)
1. Press `Cmd + Option + E` to empty caches
2. Then `Cmd + R` to reload

## Alternative: Incognito/Private Mode

Test if the new version works by opening in incognito/private mode:
- **Chrome**: `Ctrl/Cmd + Shift + N`
- **Firefox**: `Ctrl/Cmd + Shift + P`
- **Safari**: `Cmd + Shift + N`

## Clear All Cache (if hard refresh doesn't work)

### Chrome/Edge
1. Press `Ctrl/Cmd + Shift + Delete`
2. Select "Cached images and files"
3. Choose "All time"
4. Click "Clear data"

### Firefox
1. Press `Ctrl/Cmd + Shift + Delete`
2. Select "Cache"
3. Choose "Everything"
4. Click "Clear Now"

### Safari
1. Go to Safari → Settings → Privacy
2. Click "Manage Website Data"
3. Click "Remove All"

## For Developers: Verify the Build

To verify the deployed version has the correct API URL:

```bash
# Check the Docker image
docker run --rm --entrypoint sh okrnexusregistry.azurecr.io/okr-nexus-web:latest -c \
  "grep -r 'API_URL' /app/apps/web/.next/cache/webpack/client-production/0.pack | head -1"
```

Should show the API Gateway URL, not localhost:3001.

## Why This Happens

Next.js bundles JavaScript files with content-based hashes (e.g., `1137-fcc9142a31ec80b7.js`). If the hash doesn't change, browsers will serve the cached version even after a new deployment.

## Future Improvement

Consider adding cache-busting headers or versioning to force cache invalidation on deployment.




