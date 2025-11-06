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

import { spawn, ChildProcess } from 'child_process';
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

  async start(serviceId?: ServiceId) {
    const targets = serviceId ? [serviceId] : (['api', 'web'] as ServiceId[]);

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
        svc.process.kill('SIGTERM');
        svc.process = undefined;
        console.log(colorize.dim(`✅ Stopped ${svc.config.name}`));
      }
    }

    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = undefined;
    }

    if (this.rl) {
      this.rl.close();
      this.rl = undefined;
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

    // Handle Ctrl+C
    process.on('SIGINT', async () => {
      process.stdout.write('\n\n');
      console.log(colorize.dim('Shutting down...\n'));
      await this.stop();
      process.exit(0);
    });
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

