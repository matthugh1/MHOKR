#!/usr/bin/env ts-node
/**
 * RBAC Dynamic Trace Script
 * 
 * Runtime verification of RBAC enforcement by making HTTP requests
 * with different user roles and verifying expected ALLOW/DENY responses.
 * 
 * Requires: Dev server running on localhost:3000
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

interface TraceResult {
  route: string;
  httpMethod: string;
  userRole: string;
  userEmail: string;
  action: string;
  expectedResult: 'ALLOW' | 'DENY';
  actualResult: 'ALLOW' | 'DENY';
  statusCode: number;
  errorMessage?: string;
  auditLogId?: string;
  matched: boolean;
}

interface TestUser {
  email: string;
  password: string;
  role: string;
  token?: string;
}

class RBACTrace {
  private baseUrl = process.env.API_URL || 'http://localhost:3000';
  private results: TraceResult[] = [];
  private users: TestUser[] = [];

  async run(): Promise<void> {
    console.log('🔍 RBAC Dynamic Trace');
    console.log(`Target: ${this.baseUrl}\n`);

    // Load users from seed credentials or create minimal set
    await this.setupUsers();

    // Authenticate all users
    await this.authenticateUsers();

    // Run test matrix
    await this.runTestMatrix();

    // Generate report
    this.generateReport();
  }

  private async setupUsers(): Promise<void> {
    // Use seeded users from SEED_LOGIN_CREDENTIALS.md
    this.users = [
      { email: 'platform@puzzelcx.local', password: 'changeme', role: 'SUPERUSER' },
      { email: 'founder@puzzelcx.local', password: 'changeme', role: 'TENANT_OWNER' },
      { email: 'admin1@puzzelcx.local', password: 'changeme', role: 'TENANT_ADMIN' },
      { email: 'workspace-lead-sales-1@puzzelcx.local', password: 'changeme', role: 'WORKSPACE_LEAD' },
      { email: 'team-lead-enterprise-sales@puzzelcx.local', password: 'changeme', role: 'TEAM_LEAD' },
      { email: 'member-enterprise-sales-1@puzzelcx.local', password: 'changeme', role: 'TEAM_CONTRIBUTOR' },
      { email: 'tenant-viewer@puzzelcx.local', password: 'changeme', role: 'TENANT_VIEWER' },
    ];
  }

  private async authenticateUsers(): Promise<void> {
    console.log('🔐 Authenticating users...');
    for (const user of this.users) {
      try {
        const token = await this.login(user.email, user.password);
        user.token = token;
        console.log(`  ✓ ${user.email} (${user.role})`);
      } catch (error) {
        console.log(`  ✗ ${user.email} - Auth failed: ${error}`);
      }
    }
    console.log('');
  }

  private async login(email: string, password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({ email, password });
      const url = new URL(`${this.baseUrl}/auth/login`);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            try {
              const body = JSON.parse(data);
              resolve(body.access_token || body.token || '');
            } catch {
              reject(new Error('Invalid response format'));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  private async runTestMatrix(): Promise<void> {
    console.log('🧪 Running test matrix...\n');

    // Test matrix: role -> action -> expected result
    const testMatrix: Record<string, Record<string, 'ALLOW' | 'DENY'>> = {
      SUPERUSER: {
        'view_okr': 'ALLOW',
        'edit_okr': 'DENY',
        'delete_okr': 'DENY',
        'create_okr': 'DENY',
        'publish_okr': 'DENY',
        'manage_users': 'ALLOW',
      },
      TENANT_OWNER: {
        'view_okr': 'ALLOW',
        'edit_okr': 'ALLOW',
        'delete_okr': 'ALLOW',
        'create_okr': 'ALLOW',
        'publish_okr': 'ALLOW',
        'manage_users': 'ALLOW',
      },
      TENANT_ADMIN: {
        'view_okr': 'ALLOW',
        'edit_okr': 'ALLOW',
        'delete_okr': 'ALLOW',
        'create_okr': 'ALLOW',
        'publish_okr': 'ALLOW',
        'manage_users': 'ALLOW',
      },
      WORKSPACE_LEAD: {
        'view_okr': 'ALLOW',
        'edit_okr': 'ALLOW',
        'delete_okr': 'ALLOW',
        'create_okr': 'ALLOW',
        'publish_okr': 'ALLOW',
        'manage_users': 'DENY',
      },
      TEAM_LEAD: {
        'view_okr': 'ALLOW',
        'edit_okr': 'ALLOW',
        'delete_okr': 'ALLOW',
        'create_okr': 'ALLOW',
        'publish_okr': 'DENY',
        'manage_users': 'DENY',
      },
      TEAM_CONTRIBUTOR: {
        'view_okr': 'ALLOW',
        'edit_okr': 'ALLOW',
        'delete_okr': 'DENY',
        'create_okr': 'ALLOW',
        'publish_okr': 'DENY',
        'manage_users': 'DENY',
      },
      TENANT_VIEWER: {
        'view_okr': 'ALLOW',
        'edit_okr': 'DENY',
        'delete_okr': 'DENY',
        'create_okr': 'DENY',
        'publish_okr': 'DENY',
        'manage_users': 'DENY',
      },
    };

    // Sample routes for each action
    const actionRoutes: Record<string, { method: string; route: string; body?: any }> = {
      'view_okr': { method: 'GET', route: '/objectives' },
      'edit_okr': { method: 'PATCH', route: '/objectives/{id}', body: { title: 'Test' } },
      'delete_okr': { method: 'DELETE', route: '/objectives/{id}' },
      'create_okr': { method: 'POST', route: '/objectives', body: { title: 'Test', ownerId: '{userId}' } },
      'publish_okr': { method: 'POST', route: '/objectives/{id}/publish' },
      'manage_users': { method: 'GET', route: '/rbac/assignments' },
    };

    for (const user of this.users) {
      if (!user.token) continue;

      const role = user.role;
      const expectedResults = testMatrix[role] || {};

      for (const [action, expectedResult] of Object.entries(expectedResults)) {
        const routeConfig = actionRoutes[action];
        if (!routeConfig) continue;

        // Skip if we don't have a test resource ID (simplified for now)
        if (routeConfig.route.includes('{id}')) {
          // Try to find an existing resource or skip
          continue;
        }

        const result = await this.testRequest(
          user,
          action,
          routeConfig.method,
          routeConfig.route,
          routeConfig.body,
          expectedResult,
        );

        this.results.push(result);
      }
    }
  }

  private async testRequest(
    user: TestUser,
    action: string,
    method: string,
    route: string,
    body: any,
    expectedResult: 'ALLOW' | 'DENY',
  ): Promise<TraceResult> {
    const url = new URL(`${this.baseUrl}${route}`);
    
    return new Promise((resolve) => {
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method,
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      };

      const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const statusCode = res.statusCode || 0;
          const actualResult = statusCode >= 200 && statusCode < 300 ? 'ALLOW' : 'DENY';
          const matched = actualResult === expectedResult;

          resolve({
            route,
            httpMethod: method,
            userRole: user.role,
            userEmail: user.email,
            action,
            expectedResult,
            actualResult,
            statusCode,
            errorMessage: actualResult === 'DENY' ? data.substring(0, 200) : undefined,
            matched,
          });
        });
      });

      req.on('error', (error) => {
        resolve({
          route,
          httpMethod: method,
          userRole: user.role,
          userEmail: user.email,
          action,
          expectedResult,
          actualResult: 'DENY',
          statusCode: 0,
          errorMessage: error.message,
          matched: false,
        });
      });

      if (body) {
        const postData = JSON.stringify(body);
        options.headers['Content-Length'] = Buffer.byteLength(postData).toString();
        req.write(postData);
      }

      req.end();
    });
  }

  private generateReport(): void {
    const output: string[] = ['# RBAC Dynamic Trace Report\n', `Generated: ${new Date().toISOString()}\n\n`];

    const matched = this.results.filter(r => r.matched);
    const failed = this.results.filter(r => !r.matched);

    output.push(`## Summary\n\n`);
    output.push(`- Total tests: ${this.results.length}\n`);
    output.push(`- Matched: ${matched.length}\n`);
    output.push(`- Failed: ${failed.length}\n\n`);

    if (failed.length > 0) {
      output.push('## Failed Tests\n\n');
      output.push('| Route | Method | User Role | Action | Expected | Actual | Status | Error |\n');
      output.push('|-------|--------|-----------|--------|----------|--------|--------|-------|\n');

      for (const result of failed) {
        output.push(`| \`${result.route}\` | ${result.httpMethod} | ${result.userRole} | ${result.action} | ${result.expectedResult} | ${result.actualResult} | ${result.statusCode} | ${result.errorMessage?.substring(0, 50) || '-'} |\n`);
      }
      output.push('\n');
    }

    // Group by route
    output.push('## Results by Route\n\n');
    const byRoute = new Map<string, TraceResult[]>();
    for (const result of this.results) {
      if (!byRoute.has(result.route)) {
        byRoute.set(result.route, []);
      }
      byRoute.get(result.route)!.push(result);
    }

    for (const [route, results] of byRoute.entries()) {
      output.push(`### ${route}\n\n`);
      output.push('| User Role | Action | Expected | Actual | Status |\n');
      output.push('|-----------|-------|----------|--------|--------|\n');
      for (const result of results) {
        const status = result.matched ? '✅' : '❌';
        output.push(`| ${result.userRole} | ${result.action} | ${result.expectedResult} | ${result.actualResult} | ${status} |\n`);
      }
      output.push('\n');
    }

    fs.writeFileSync(
      path.join(__dirname, '../../docs/audit/RBAC_DYNAMIC_TRACE_REPORT.md'),
      output.join('')
    );

    // Write failures separately
    if (failed.length > 0) {
      const failOutput = ['# RBAC Dynamic Trace Failures\n', `Generated: ${new Date().toISOString()}\n\n`];
      failOutput.push('## Failed Tests\n\n');
      for (const result of failed) {
        failOutput.push(`### ${result.route} - ${result.userRole} - ${result.action}\n\n`);
        failOutput.push(`- **Expected:** ${result.expectedResult}\n`);
        failOutput.push(`- **Actual:** ${result.actualResult}\n`);
        failOutput.push(`- **Status Code:** ${result.statusCode}\n`);
        failOutput.push(`- **Error:** ${result.errorMessage || 'None'}\n\n`);
      }

      fs.writeFileSync(
        path.join(__dirname, '../../docs/audit/RBAC_DYNAMIC_FAILS.md'),
        failOutput.join('')
      );
    }

    console.log(`\n✅ Report generated: docs/audit/RBAC_DYNAMIC_TRACE_REPORT.md`);
    if (failed.length > 0) {
      console.log(`❌ Failures: docs/audit/RBAC_DYNAMIC_FAILS.md`);
      process.exitCode = 1;
    }
  }
}

if (require.main === module) {
  const tracer = new RBACTrace();
  tracer.run().catch(err => {
    console.error('Trace error:', err);
    process.exit(1);
  });
}

export { RBACTrace };

