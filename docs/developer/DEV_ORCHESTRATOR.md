# Developer Orchestrator

A lightweight, production-safe developer orchestrator for running the local development stack from a single terminal with live logs, health checks, and one-key restarts.

## Quick Start

```bash
# Start all services (API + Web)
npm run dev:all

# Check service health status
npm run dev:status

# Stop all services
npm run dev:down

# Or use devctl directly
npm run devctl up
npm run devctl restart api
npm run devctl logs web
```

## Commands

### `devctl up`

Starts all configured services (API and Web) with prefixed, color-coded logs.

**Features:**
- Automatically detects package manager (pnpm or npm)
- Shows discovered commands before running
- Prefixed logs: `[API]` (cyan) and `[Web]` (magenta)
- Interactive mode with hotkeys enabled after services start
- Live health monitoring dashboard

**Example:**
```bash
$ npm run dev:all

📦 Package manager: npm
🚀 Starting services...

  API → npm run dev (cwd: /path/to/services/core-api)
  Web → npm run dev (cwd: /path/to/apps/web)

[API] 🚀 Core API is running on: http://localhost:3001
[Web] ▲ Next.js 14.2.33
[Web] - Local:        http://localhost:5173
```

### `devctl down`

Stops all running services gracefully.

```bash
npm run dev:down
```

### `devctl restart [service]`

Restarts a specific service or all services with debounced restarts (500ms) to prevent file change flaps.

**Usage:**
```bash
# Restart API only
npm run devctl restart api

# Restart Web only
npm run devctl restart web

# Restart all services
npm run devctl restart all
```

**Debouncing:**
- Restarts are automatically debounced to prevent rapid restarts
- If a service is restarted multiple times within 500ms, only the final restart executes
- Helps prevent terminal wedging during rapid file changes

### `devctl status`

Displays a health check status table for all services.

**Output:**
```
┌─────────────────────────────────────────────────────────────┐
│ Service Health Status                                        │
├──────────┬──────────┬──────────┬──────────────────────────────┤
│ Service │ Status   │ HTTP     │ Last Checked                  │
├──────────┼──────────┼──────────┼──────────────────────────────┤
│ API     │ UP       │ 200      │ 12:03:17 PM                   │
│ Web     │ UP       │ 200      │ 12:03:17 PM                   │
└──────────┴──────────┴──────────┴──────────────────────────────┘
```

**JSON Mode (for CI):**
```bash
npm run devctl status --json
```

Returns machine-readable JSON:
```json
[
  {
    "service": "api",
    "status": "UP",
    "httpStatus": 200,
    "lastChecked": "2024-01-15T12:03:17.000Z"
  },
  {
    "service": "web",
    "status": "UP",
    "httpStatus": 200,
    "lastChecked": "2024-01-15T12:03:17.000Z"
  }
]
```

### `devctl logs [service]`

Tails the last N lines (default: 50) and follows logs for a service.

**Usage:**
```bash
# View API logs
npm run devctl logs api

# View Web logs
npm run devctl logs web
```

**Note:** Logs are buffered (last 1000 lines) and can be viewed even after a service crashes.

## Interactive Mode Hotkeys

When running `devctl up`, interactive mode activates with the following hotkeys:

| Hotkey | Action |
|--------|--------|
| `Ctrl+r` | Restart focused service (or all if none focused) |
| `Ctrl+a` | Restart all services |
| `s` | Show full status table |
| `q` | Quit gracefully (stops all services) |
| `Ctrl+C` | Quit gracefully (stops all services) |

**Status Dashboard:**
A single-line dashboard appears at the bottom of the terminal (updates every 5 seconds):

```
API: UP (200)  •  Web: UP (200)  •  Last restart: 12:03:17  •  Press s=status, r=restart focused, a=restart all, q=quit
```

## Health Checks

### API Health Check

- **Endpoint:** `GET http://localhost:3001/system/status`
- **Expected Response:** `{ ok: true }`
- **Port Detection:**
  - `CORE_API_PORT` environment variable (first priority)
  - `PORT` environment variable (fallback)
  - Default: `3001`

### Web Health Check

- **Endpoint:** `GET http://localhost:5173/`
- **Expected Response:** HTTP 200-399 status code
- **Port Detection:**
  - `WEB_PORT` environment variable
  - Default: `5173` (Next.js default)

### Health Check Behavior

- Polls every 5 seconds (configurable in code)
- Timeout: 2 seconds per check
- Non-blocking: Services continue running even if health checks fail
- Status colors:
  - 🟢 Green: Service is UP
  - 🔴 Red: Service is DOWN

## Error Handling

### Service Crashes

If a service exits with a non-zero code:

1. **Error Display:**
   - Service name and exit code are highlighted
   - Last 20 log lines are displayed in red
   - Other services continue running

2. **Example Output:**
   ```
   ❌ API exited with code 1
   Last 20 lines:
     [API] Error: Cannot connect to database
     [API]   at Database.connect (db.js:42)
     ...
   
   Run 'devctl down' to stop all services
   ```

### Common Failure Signatures

#### Port Already in Use

**Symptoms:**
- Service fails to start
- Error: `EADDRINUSE: address already in use`

**Solution:**
```bash
# Find process using port
lsof -i :3001
lsof -i :5173

# Kill process or change port via env
CORE_API_PORT=3002 npm run dev:all
WEB_PORT=5174 npm run dev:all
```

#### Environment Variables Missing

**Symptoms:**
- Service starts but health checks fail
- Database connection errors in API logs

**Solution:**
- Ensure `.env` files exist in service directories
- Check `services/core-api/.env` for database credentials
- Verify required environment variables are set

#### Database Offline

**Symptoms:**
- API health check fails
- Logs show connection timeouts

**Solution:**
```bash
# Start database (if using Docker)
npm run docker:up

# Or check database status
# (PostgreSQL, MySQL, etc.)
```

#### Package Manager Issues

**Symptoms:**
- "Command not found" errors
- Services don't start

**Solution:**
- Ensure `npm` or `pnpm` is installed
- Run `npm install` or `pnpm install` in root
- Verify `package.json` scripts exist

## Package Manager Detection

The orchestrator automatically detects and uses the appropriate package manager:

1. **Checks for pnpm first** (if `pnpm` is in PATH)
2. **Falls back to npm** if pnpm is not available

**Package Manager Commands:**

- **pnpm:** Uses `pnpm --filter <package> run dev`
- **npm:** Uses `npm run dev` with workspace support or `cd` fallback

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CORE_API_PORT` | API server port | `3001` |
| `PORT` | Fallback for API port | `3001` |
| `WEB_PORT` | Web server port | `5173` |

### Service Detection

The orchestrator automatically detects:
- Service package paths (`services/core-api`, `apps/web`)
- Dev scripts from `package.json`
- Health check endpoints

## Optional: tmux Helper

For developers who prefer tmux, an optional helper script creates a session with separate panes:

```bash
./scripts/dev/tmux-dev.sh
```

**Layout:**
- **Pane 0 (left):** API service logs
- **Pane 1 (middle):** Web service logs
- **Pane 2 (right):** Live status monitor (refreshes every 5s)

**Useful Commands:**
- Attach: `tmux attach -t okr-dev`
- Detach: `Ctrl+b` then `d`
- Kill: `tmux kill-session -t okr-dev`
- Switch panes: `Ctrl+b` then arrow keys

**Note:** tmux is optional. `devctl` works without it.

## Architecture

### Process Management

- Uses Node.js `child_process.spawn()` for service processes
- Logs are captured via `stdout`/`stderr` pipes
- Process lifecycle: start → monitor → restart/stop

### Log Buffering

- Each service maintains a circular buffer (last 1000 lines)
- Buffers persist even after service crashes
- Used for error reporting and log viewing

### Health Monitoring

- Runs in separate interval (5s polling)
- Non-blocking async health checks
- Updates in-place status dashboard

### Interactive Mode

- Uses Node.js `readline` with raw mode for keypress detection
- Only active when `devctl up` is running
- Graceful shutdown on `SIGINT` (Ctrl+C)

## Zero Runtime Dependencies

The orchestrator uses only Node.js built-in modules:

- `child_process` - Process spawning
- `http` / `https` - Health checks
- `readline` - Interactive mode
- `fs` / `path` - File system operations

**TypeScript Execution:**
- Uses `ts-node` (already in devDependencies)
- No compilation step required
- Direct TypeScript execution

## Examples

### Example Session: Start → API Up → Web Up → Restart Web → Status

```bash
$ npm run dev:all

📦 Package manager: npm
🚀 Starting services...

  API → npm run dev (cwd: /path/to/services/core-api)
  Web → npm run dev (cwd: /path/to/apps/web)

[API] 🚀 Core API is running on: http://localhost:3001
[API] 📚 API Documentation: http://localhost:3001/api/docs
[Web] ▲ Next.js 14.2.33
[Web] - Local:        http://localhost:5173
[Web] - ready started server on 0.0.0.0:5173

API: UP (200)  •  Web: UP (200)  •  Last restart: 12:03:15  •  Press s=status, r=restart focused, a=restart all, q=quit

# Press 'a' to restart all
🔄 Restarting API...
🔄 Restarting Web...

[API] 🚀 Core API is running on: http://localhost:3001
[Web] ▲ Next.js 14.2.33

# Press 's' to show status
┌─────────────────────────────────────────────────────────────┐
│ Service Health Status                                        │
├──────────┬──────────┬──────────┬──────────────────────────────┤
│ Service │ Status   │ HTTP     │ Last Checked                  │
├──────────┼──────────┼──────────┼──────────────────────────────┤
│ API     │ UP       │ 200      │ 12:03:25 PM                   │
│ Web     │ UP       │ 200      │ 12:03:25 PM                   │
└──────────┴──────────┴──────────┴──────────────────────────────┘

# Press 'q' to quit
Shutting down...
✅ Stopped API
✅ Stopped Web
```

### CI Usage (JSON Status)

```bash
# In CI pipeline
npm run devctl status --json | jq '.[] | select(.status != "UP")'
```

Returns exit code 0 if all services are UP (requires minor modification for CI).

## Troubleshooting

### Services Won't Start

1. **Check package.json scripts:**
   ```bash
   cat services/core-api/package.json | grep '"dev"'
   cat apps/web/package.json | grep '"dev"'
   ```

2. **Verify paths:**
   ```bash
   ls -la services/core-api
   ls -la apps/web
   ```

3. **Check dependencies:**
   ```bash
   npm install
   ```

### Health Checks Fail

1. **Manual test:**
   ```bash
   curl http://localhost:3001/system/status
   curl http://localhost:5173/
   ```

2. **Check ports:**
   ```bash
   lsof -i :3001
   lsof -i :5173
   ```

3. **Verify environment:**
   ```bash
   echo $CORE_API_PORT
   echo $WEB_PORT
   ```

### Interactive Mode Not Working

1. **Check TTY:**
   - Interactive mode only works in terminals (not pipes)
   - Ensure `process.stdin.isTTY === true`

2. **Raw mode:**
   - Some terminals don't support raw mode
   - Try a different terminal (iTerm2, Terminal.app, etc.)

## Development

### Adding New Services

1. Update `getServiceConfigs()` in `devctl.ts`:
   ```typescript
   {
     id: 'worker',
     name: 'Worker',
     packagePath: join(rootPath, 'services', 'worker'),
     packageName: pm === 'pnpm' ? '@okr-nexus/worker' : join(rootPath, 'services', 'worker'),
     port: 3002,
     healthUrl: `http://localhost:3002/health`,
     healthCheck: checkApiHealth, // or custom
     color: colorize.yellow,
   }
   ```

2. Add health check function if needed

3. Update this documentation

### Testing

```bash
# Dry run (status only)
npm run dev:status

# Start and immediately stop
npm run dev:all &
sleep 5
npm run dev:down
```

## License

Internal tool for OKR Framework development.

