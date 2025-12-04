#!/usr/bin/env node
/**
 * Developer Orchestrator CLI
 * 
 * Manages local development stack with live logs, health checks, and one-key restarts.
 * Usage: devctl [command] [options]
 * 
 * Commands:
 *   up            Start all services with prefixed logs
 *   down          Stop all running services
 *   restart [svc] Restart specific service (api|web|all) or all
 *   status        Show health check status table
 *   logs [svc]    Tail logs for a service (api|web)
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import * as http from 'http';
import * as readline from 'readline';
import { join } from 'path';

// ============================================================================
// Types & Configuration
// ============================================================================

type ServiceId = 'api' | 'web';
type ServiceStatus = 'UP' | 'DOWN' | 'STARTING' | 'UNKNOWN';

interface ServiceConfig {
  id: ServiceId;
  name: string;
  packagePath: string;
  packageName: string;
  port: number;
  healthUrl: string;
  healthCheck: (url: string) => Promise<{ ok: boolean; status?: number }>;
  color: (text: string) => string;
}

interface HealthStatus {
  service: ServiceId;
  status: ServiceStatus;
  httpStatus?: number;
  lastChecked: Date;
  error?: string;
}

interface ServiceProcess {
  config: ServiceConfig;
  process?: ChildProcess;
  logBuffer: string[];
  restartDebounce?: NodeJS.Timeout;
  lastRestart?: Date;
}

// ANSI Color codes
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

const colorize = {
  api: (text: string) => `${colors.cyan}${text}${colors.reset}`,
  web: (text: string) => `${colors.magenta}${text}${colors.reset}`,
  success: (text: string) => `${colors.green}${text}${colors.reset}`,
  error: (text: string) => `${colors.red}${text}${colors.reset}`,
  warn: (text: string) => `${colors.yellow}${text}${colors.reset}`,
  dim: (text: string) => `${colors.dim}${text}${colors.reset}`,
  bold: (text: string) => `${colors.bold}${text}${colors.reset}`,
};

// ============================================================================
// Package Manager Detection
// ============================================================================

function detectPackageManager(): 'pnpm' | 'npm' {
  // Check if pnpm is available
  try {
    require('child_process').execSync('which pnpm', { stdio: 'ignore' });
    return 'pnpm';
  } catch {
    return 'npm';
  }
}

function getRunCommand(
  pm: 'pnpm' | 'npm',
  packageName: string,
  packagePath: string
): { cmd: string[]; cwd: string } {
  if (pm === 'pnpm') {
    return {
      cmd: ['pnpm', '--filter', packageName, 'run', 'dev'],
      cwd: process.cwd(),
    };
  } else {
    // For npm workspaces, try workspace flag first, fallback to cd
    // Check if we're in a workspace context
    try {
      const pkg = require(join(process.cwd(), 'package.json'));
      if (pkg.workspaces) {
        // Try workspace command (npm 7+)
        return {
          cmd: ['npm', 'run', 'dev', '--workspace', packagePath],
          cwd: process.cwd(),
        };
      }
    } catch {
      // Fall through to cd approach
    }
    // Fallback: cd into directory
    return {
      cmd: ['npm', 'run', 'dev'],
      cwd: packagePath,
    };
  }
}

// ============================================================================
// Health Checks
// ============================================================================

async function checkApiHealth(url: string): Promise<{ ok: boolean; status?: number }> {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 2000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            ok: res.statusCode === 200 && json.ok === true,
            status: res.statusCode,
          });
        } catch {
          resolve({ ok: res.statusCode === 200, status: res.statusCode });
        }
      });
    });

    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false });
    });
  });
}

async function checkWebHealth(url: string): Promise<{ ok: boolean; status?: number }> {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 2000 }, (res) => {
      const statusCode = res.statusCode ?? 0;
      resolve({
        ok: statusCode >= 200 && statusCode < 400,
        status: statusCode,
      });
      res.resume(); // Consume response to free memory
    });

    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false });
    });
  });
}

// ============================================================================
// Service Configuration
// ============================================================================

function getServiceConfigs(pm: 'pnpm' | 'npm'): ServiceConfig[] {
  const apiPort = parseInt(process.env.CORE_API_PORT || process.env.PORT || '3001', 10);
  const webPort = parseInt(process.env.WEB_PORT || '5173', 10);

  const rootPath = join(__dirname, '..', '..');

  return [
    {
      id: 'api',
      name: 'API',
      packagePath: join(rootPath, 'services', 'core-api'),
      packageName: pm === 'pnpm' ? '@okr-nexus/core-api' : join(rootPath, 'services', 'core-api'),
      port: apiPort,
      healthUrl: `http://localhost:${apiPort}/system/status`,
      healthCheck: checkApiHealth,
      color: colorize.api,
    },
    {
      id: 'web',
      name: 'Web',
      packagePath: join(rootPath, 'apps', 'web'),
      packageName: pm === 'pnpm' ? '@okr-nexus/web' : join(rootPath, 'apps', 'web'),
      port: webPort,
      healthUrl: `http://localhost:${webPort}/`,
      healthCheck: checkWebHealth,
      color: colorize.web,
    },
  ];
}

// ============================================================================
// Port Management
// ============================================================================

async function killProcessOnPort(port: number): Promise<boolean> {
  try {
    // Use lsof/netstat to find processes using the port
    const platform = process.platform;
    
    if (platform === 'win32') {
      // Windows: use netstat to find PID, then taskkill
      const netstatOutput = execSync(`netstat -ano | findstr :${port}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      
      const lines = netstatOutput.trim().split('\n');
      const pids = new Set<string>();
      
      for (const line of lines) {
        const match = line.match(/\s+(\d+)$/);
        if (match) {
          pids.add(match[1]);
        }
      }
      
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        } catch {
          // Process might already be dead
        }
      }
      
      return pids.size > 0;
    } else {
      // macOS/Linux: use lsof
      try {
        const output = execSync(`lsof -ti :${port}`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        
        const pids = output.trim().split('\n').filter(Boolean);
        
        for (const pid of pids) {
          try {
            execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          } catch {
            // Process might already be dead
          }
        }
        
        return pids.length > 0;
      } catch {
        // No process found on port (lsof exits with non-zero)
        return false;
      }
    }
  } catch (error: any) {
    // If lsof/netstat isn't available or fails, return false
    return false;
  }
}

async function ensurePortsAvailable(configs: ServiceConfig[]): Promise<void> {
  const portsToCheck = configs.map((c) => c.port);
  const killedProcesses: number[] = [];
  
  for (const port of portsToCheck) {
    const killed = await killProcessOnPort(port);
    if (killed) {
      killedProcesses.push(port);
    }
  }
  
  if (killedProcesses.length > 0) {
    console.log(colorize.warn(`\n⚠️  Killed processes on ports: ${killedProcesses.join(', ')}\n`));
    // Give ports a moment to be released
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

// ============================================================================
// Docker Management
// ============================================================================

async function checkDockerRunning(): Promise<boolean> {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function checkDockerContainer(containerName: string): Promise<boolean> {
  try {
    const output = execSync(`docker ps --filter "name=${containerName}" --format "{{.Names}}"`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return output.trim() === containerName;
  } catch {
    return false;
  }
}

async function startDockerDesktop(): Promise<boolean> {
  const platform = process.platform;
  
  try {
    if (platform === 'darwin') {
      // macOS: Try to start Docker Desktop
      console.log(colorize.dim('🐳 Attempting to start Docker Desktop...\n'));
      execSync('open -a Docker', { stdio: 'ignore' });
      return true;
    } else if (platform === 'win32') {
      // Windows: Try to start Docker Desktop
      console.log(colorize.dim('🐳 Attempting to start Docker Desktop...\n'));
      execSync('start "" "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"', { stdio: 'ignore' });
      return true;
    } else if (platform === 'linux') {
      // Linux: Try to start Docker daemon
      console.log(colorize.dim('🐳 Attempting to start Docker daemon...\n'));
      try {
        execSync('sudo systemctl start docker', { stdio: 'ignore' });
        return true;
      } catch {
        // Might not have sudo or systemctl
        return false;
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function waitForDockerReady(maxWaitSeconds = 60): Promise<boolean> {
  console.log(colorize.dim(`⏳ Waiting for Docker to be ready (max ${maxWaitSeconds}s)...\n`));
  
  const startTime = Date.now();
  const maxWait = maxWaitSeconds * 1000;
  
  while (Date.now() - startTime < maxWait) {
    if (await checkDockerRunning()) {
      console.log(colorize.success('✅ Docker is ready!\n'));
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Check every 2 seconds
    process.stdout.write('.');
  }
  
  process.stdout.write('\n');
  return false;
}

async function ensureDockerServices(): Promise<void> {
  // Check if Docker is running
  let dockerRunning = await checkDockerRunning();
  
  if (!dockerRunning) {
    console.log(colorize.warn('\n⚠️  Docker is not running!\n'));
    
    // Try to start Docker Desktop
    const started = await startDockerDesktop();
    
    if (started) {
      // Wait for Docker to be ready
      dockerRunning = await waitForDockerReady(60);
      
      if (!dockerRunning) {
        console.error(colorize.error('\n❌ Docker Desktop took too long to start.\n'));
        console.error(colorize.warn('Please start Docker Desktop manually and try again.\n'));
        process.exit(1);
      }
    } else {
      console.error(colorize.error('\n❌ Could not start Docker Desktop automatically.\n'));
      console.error(colorize.warn('Please start Docker Desktop manually and try again.\n'));
      process.exit(1);
    }
  }

  // Check required infrastructure containers
  const postgresRunning = await checkDockerContainer('okr-nexus-postgres');
  const redisRunning = await checkDockerContainer('okr-nexus-redis');
  const keycloakRunning = await checkDockerContainer('okr-nexus-keycloak');

  const requiredServices = [];
  if (!postgresRunning) requiredServices.push('postgres');
  if (!redisRunning) requiredServices.push('redis');
  if (!keycloakRunning) requiredServices.push('keycloak');

  if (requiredServices.length > 0) {
    console.log(colorize.dim(`\n🐳 Starting Docker infrastructure services (${requiredServices.join(', ')})...\n`));
    
    try {
      // Start infrastructure services
      const servicesToStart = requiredServices.join(' ');
      execSync(`docker-compose up -d ${servicesToStart}`, {
        stdio: 'inherit',
        cwd: join(__dirname, '..', '..'),
      });
      
      // Wait for services to be healthy
      console.log(colorize.dim('⏳ Waiting for infrastructure services to be ready...\n'));
      
      let attempts = 0;
      const maxAttempts = 90; // 90 seconds max wait (keycloak can take a while)
      
      while (attempts < maxAttempts) {
        const postgresReady = postgresRunning || await checkDockerContainer('okr-nexus-postgres');
        const redisReady = redisRunning || await checkDockerContainer('okr-nexus-redis');
        const keycloakReady = keycloakRunning || await checkDockerContainer('okr-nexus-keycloak');
        
        if (postgresReady && redisReady && keycloakReady) {
          // Additional check: verify postgres is actually accepting connections
          try {
            execSync('docker exec okr-nexus-postgres pg_isready -U okr_user', {
              stdio: 'ignore',
            });
            // Check redis
            execSync('docker exec okr-nexus-redis redis-cli ping', {
              stdio: 'ignore',
            });
            console.log(colorize.success('✅ Docker infrastructure services are ready!\n'));
            return;
          } catch {
            // Services exist but not ready yet
          }
        }
        
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
        
        // Show progress every 10 seconds
        if (attempts % 10 === 0) {
          process.stdout.write('.');
        }
      }
      
      process.stdout.write('\n');
      console.error(colorize.error('\n⚠️  Docker services took too long to start. Continuing anyway...\n'));
    } catch (error: any) {
      console.error(colorize.error(`\n❌ Failed to start Docker services: ${error.message}\n`));
      console.error(colorize.warn('You may need to start them manually: npm run docker:up\n'));
      process.exit(1);
    }
  } else {
    console.log(colorize.dim('✅ Docker infrastructure services (postgres, redis, keycloak) are running\n'));
  }
}

// ============================================================================
// Service Management
// ============================================================================

class DevOrchestrator {
  private services: Map<ServiceId, ServiceProcess> = new Map();
  private pm: 'pnpm' | 'npm';
  private configs: ServiceConfig[];
  private healthInterval?: NodeJS.Timeout;
  private rl?: readline.Interface;
  private focusedService: ServiceId | 'all' = 'all';
  private isInteractive = false;
  private sigintHandlerSetup = false;

  constructor() {
    this.pm = detectPackageManager();
    this.configs = getServiceConfigs(this.pm);
    
    for (const config of this.configs) {
      this.services.set(config.id, {
        config,
        logBuffer: [],
      });
    }
  }

  private setupSigintHandler() {
    if (this.sigintHandlerSetup) return;
    this.sigintHandlerSetup = true;

    // Handle Ctrl+C - set up immediately so it works from the start
    process.on('SIGINT', async () => {
      process.stdout.write('\n\n');
      console.log(colorize.dim('Shutting down...\n'));
      await this.stop();
      process.exit(0);
    });
  }

  async start(serviceId?: ServiceId) {
    // Set up SIGINT handler immediately so Ctrl+C works from the start
    this.setupSigintHandler();

    // Kill any processes using the ports we need
    const targets = serviceId ? [serviceId] : (['api', 'web'] as ServiceId[]);
    const configsToCheck = this.configs.filter((c) => targets.includes(c.id));
    await ensurePortsAvailable(configsToCheck);

    // Ensure Docker services are running before starting app services
    await ensureDockerServices();

    console.log(colorize.dim(`\n📦 Package manager: ${this.pm}`));
    console.log(colorize.dim(`🚀 Starting services...\n`));

    for (const id of targets) {
      const svc = this.services.get(id);
      if (!svc) continue;

      if (svc.process) {
        console.log(colorize.warn(`⚠️  ${svc.config.name} already running`));
        continue;
      }

      const { config } = svc;
      const { cmd, cwd } = getRunCommand(this.pm, config.packageName, config.packagePath);

      const spawnOpts: any = {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      };

      console.log(colorize.dim(`  ${config.name} → ${cmd.join(' ')} (cwd: ${cwd})`));

      const proc = spawn(cmd[0], cmd.slice(1), spawnOpts);

      proc.stdout?.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(Boolean);
        lines.forEach((line) => {
          svc.logBuffer.push(line);
          if (svc.logBuffer.length > 1000) svc.logBuffer.shift();
          
          const prefixed = `${config.color(`[${config.name}]`)} ${line}`;
          console.log(prefixed);
        });
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(Boolean);
        lines.forEach((line) => {
          svc.logBuffer.push(line);
          if (svc.logBuffer.length > 1000) svc.logBuffer.shift();
          
          const prefixed = `${config.color(`[${config.name}]`)} ${colorize.error(line)}`;
          console.error(prefixed);
        });
      });

      proc.on('exit', (code) => {
        svc.process = undefined;
        if (code !== 0 && code !== null) {
          console.error(colorize.error(`\n❌ ${config.name} exited with code ${code}`));
          console.error(colorize.error(`Last 20 lines:\n`));
          const lastLines = svc.logBuffer.slice(-20);
          lastLines.forEach((line) => console.error(colorize.error(`  ${line}`)));
          console.error(colorize.error(`\nRun 'devctl down' to stop all services\n`));
        }
      });

      svc.process = proc;
      svc.lastRestart = new Date();
    }

    if (!serviceId) {
      // Start health monitoring and interactive mode
      setTimeout(() => {
        this.startHealthMonitoring();
        this.startInteractiveMode();
      }, 2000);
    }
  }

  async stop(serviceId?: ServiceId) {
    const targets = serviceId ? [serviceId] : (['api', 'web'] as ServiceId[]);

    for (const id of targets) {
      const svc = this.services.get(id);
      if (svc?.process) {
        const proc = svc.process;
        svc.process = undefined; // Clear reference immediately
        
        try {
          // Try graceful shutdown first
          proc.kill('SIGTERM');
          
          // Wait a bit for graceful shutdown
          await new Promise((resolve) => setTimeout(resolve, 1000));
          
          // Force kill if still running
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
          
          console.log(colorize.dim(`✅ Stopped ${svc.config.name}`));
        } catch (error) {
          // Process might already be dead
          console.log(colorize.dim(`✅ Stopped ${svc.config.name}`));
        }
      }
    }

    // Also kill any processes on the ports (in case process references were lost)
    const configsToCheck = this.configs.filter((c) => targets.includes(c.id));
    await ensurePortsAvailable(configsToCheck);

    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = undefined;
    }

    if (this.rl) {
      this.rl.close();
      this.rl = undefined;
    }

    // Restore stdin if raw mode was enabled
    if (process.stdin.isTTY && process.stdin.isRaw) {
      process.stdin.setRawMode(false);
    }
  }

  async restart(serviceId?: ServiceId | 'all') {
    const targets = serviceId === 'all' ? (['api', 'web'] as ServiceId[]) : serviceId ? [serviceId] : (['api', 'web'] as ServiceId[]);

    for (const id of targets) {
      const svc = this.services.get(id);
      if (!svc) continue;

      // Debounce restarts
      if (svc.restartDebounce) {
        clearTimeout(svc.restartDebounce);
      }

      svc.restartDebounce = setTimeout(async () => {
        console.log(colorize.dim(`\n🔄 Restarting ${svc.config.name}...\n`));
        await this.stop(id);
        await new Promise((resolve) => setTimeout(resolve, 500));
        await this.start(id);
      }, 500);
    }
  }

  async status(json = false) {
    const results: HealthStatus[] = [];

    for (const config of this.configs) {
      try {
        const result = await config.healthCheck(config.healthUrl);
        results.push({
          service: config.id,
          status: result.ok ? 'UP' : 'DOWN',
          httpStatus: result.status,
          lastChecked: new Date(),
        });
      } catch (error: any) {
        results.push({
          service: config.id,
          status: 'DOWN',
          lastChecked: new Date(),
          error: error.message,
        });
      }
    }

    if (json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    // Print table
    console.log(colorize.dim('\n┌─────────────────────────────────────────────────────────────┐'));
    console.log(colorize.dim('│') + ' ' + colorize.bold('Service Health Status') + ' '.repeat(37) + colorize.dim('│'));
    console.log(colorize.dim('├──────────┬──────────┬──────────┬──────────────────────────────┤'));
    console.log(colorize.dim('│ Service │ Status   │ HTTP     │ Last Checked                  │'));
    console.log(colorize.dim('├──────────┼──────────┼──────────┼──────────────────────────────┤'));

    for (const result of results) {
      const config = this.configs.find((c) => c.id === result.service);
      const statusColor = result.status === 'UP' ? colorize.success : colorize.error;
      const statusText = statusColor(result.status.padEnd(8));
      const httpText = result.httpStatus ? result.httpStatus.toString().padEnd(8) : 'N/A'.padEnd(8);
      const timeText = result.lastChecked.toLocaleTimeString();

      console.log(
        colorize.dim('│') +
        ` ${config?.name.padEnd(8)} ` +
        colorize.dim('│') +
        ` ${statusText} ` +
        colorize.dim('│') +
        ` ${httpText} ` +
        colorize.dim('│') +
        ` ${timeText.padEnd(28)} ` +
        colorize.dim('│')
      );
    }

    console.log(colorize.dim('└──────────┴──────────┴──────────┴──────────────────────────────┘\n'));
  }

  logs(serviceId: ServiceId, lines = 50) {
    const svc = this.services.get(serviceId);
    if (!svc) {
      console.error(colorize.error(`Service ${serviceId} not found`));
      return;
    }

    const logLines = svc.logBuffer.slice(-lines);
    logLines.forEach((line) => {
      console.log(`${svc.config.color(`[${svc.config.name}]`)} ${line}`);
    });

    if (svc.process) {
      // Follow logs
      console.log(colorize.dim(`\nFollowing logs (Ctrl+C to stop)...\n`));
      const stdout = svc.process.stdout;
      const stderr = svc.process.stderr;

      if (stdout) {
        stdout.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n').filter(Boolean);
          lines.forEach((line) => {
            console.log(`${svc.config.color(`[${svc.config.name}]`)} ${line}`);
          });
        });
      }

      if (stderr) {
        stderr.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n').filter(Boolean);
          lines.forEach((line) => {
            console.error(`${svc.config.color(`[${svc.config.name}]`)} ${colorize.error(line)}`);
          });
        });
      }
    }
  }

  private startHealthMonitoring() {
    if (this.healthInterval) return;

    this.healthInterval = setInterval(async () => {
      if (!this.isInteractive) return;

      const statuses: { service: string; status: string; httpStatus?: number }[] = [];

      for (const config of this.configs) {
        try {
          const result = await config.healthCheck(config.healthUrl);
          statuses.push({
            service: config.name,
            status: result.ok ? 'UP' : 'DOWN',
            httpStatus: result.status,
          });
        } catch {
          statuses.push({
            service: config.name,
            status: 'DOWN',
          });
        }
      }

      const lastRestart = Array.from(this.services.values())
        .map((s) => s.lastRestart)
        .filter(Boolean)
        .sort((a, b) => (b?.getTime() || 0) - (a?.getTime() || 0))[0];

      const statusLine = statuses
        .map((s) => {
          const color = s.status === 'UP' ? colorize.success : colorize.error;
          return `${s.service}: ${color(s.status)} ${s.httpStatus ? `(${s.httpStatus})` : ''}`;
        })
        .join('  •  ');

      const restartText = lastRestart
        ? `  •  Last restart: ${lastRestart.toLocaleTimeString()}`
        : '';

      const helpText =
        `  •  Press ${colorize.warn('s')}=status, ${colorize.warn('r')}=restart focused, ${colorize.warn('a')}=restart all, ${colorize.warn('q')}=quit`;

      // Clear line and write status (ANSI escape: \x1b[2K clears line, \r returns cursor)
      process.stdout.write(`\r\x1b[2K${colorize.dim(statusLine + restartText + helpText)}`);
    }, 5000);
  }

  private startInteractiveMode() {
    if (this.rl || !process.stdin.isTTY) return;

    this.isInteractive = true;

    // Set up readline for keypress events
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdin.on('keypress', async (_str, key) => {
      if (!key) return;

      // Ctrl+r: restart focused service
      if (key.ctrl && key.name === 'r') {
        if (this.focusedService !== 'all') {
          process.stdout.write('\n');
          await this.restart(this.focusedService);
        }
      }
      // Ctrl+a: restart all
      else if (key.ctrl && key.name === 'a') {
        process.stdout.write('\n');
        await this.restart('all');
      }
      // s: show status
      else if (key.name === 's') {
        process.stdout.write('\n\n');
        await this.status();
      }
      // q: quit
      else if (key.name === 'q') {
        process.stdout.write('\n\n');
        console.log(colorize.dim('Shutting down...\n'));
        await this.stop();
        process.exit(0);
      }
    });

    // Note: SIGINT handler is already set up in setupSigintHandler()
    // This method only handles interactive keypress events
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const orchestrator = new DevOrchestrator();

  switch (command) {
    case 'up':
      await orchestrator.start();
      // Keep process alive
      await new Promise(() => {});
      break;

    case 'down':
      await orchestrator.stop();
      break;

    case 'restart': {
      const service = args[1] as ServiceId | 'all' | undefined;
      if (service && service !== 'api' && service !== 'web' && service !== 'all') {
        console.error(colorize.error(`Invalid service: ${service}. Use api, web, or all`));
        process.exit(1);
      }
      await orchestrator.restart(service);
      break;
    }

    case 'status': {
      const json = args.includes('--json');
      await orchestrator.status(json);
      break;
    }

    case 'logs': {
      const service = args[1] as ServiceId;
      if (!service || (service !== 'api' && service !== 'web')) {
        console.error(colorize.error('Usage: devctl logs <api|web>'));
        process.exit(1);
      }
      orchestrator.logs(service);
      break;
    }

    default:
      console.log(`
Usage: devctl <command> [options]

Commands:
  up            Start all services with prefixed logs
  down          Stop all running services
  restart [svc] Restart specific service (api|web|all) or all
  status        Show health check status table
  logs [svc]    Tail logs for a service (api|web)

Examples:
  devctl up
  devctl restart api
  devctl status
  devctl logs web
`);
      process.exit(command ? 1 : 0);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(colorize.error(`Error: ${error.message}`));
    process.exit(1);
  });
}

