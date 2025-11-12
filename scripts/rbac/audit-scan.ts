#!/usr/bin/env ts-node
/**
 * RBAC Enforcement Scanner
 * 
 * Scans all controller files to map RBAC enforcement points:
 * - HTTP methods (POST, PATCH, PUT, DELETE)
 * - @RequireAction decorators
 * - @UseGuards(RBACGuard) presence
 * - Service method calls with tenant checks
 * - Audit log calls
 * 
 * Outputs:
 * - RBAC_ENFORCEMENT_MAP.md
 * - RBAC_ENFORCEMENT_MAP.csv
 * - RBAC_GUARD_CONSISTENCY_REPORT.md
 * - RBAC_CALLGRAPH_MERMAID.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob as globSync } from 'glob';

interface ControllerMethod {
  file: string;
  line: number;
  route: string;
  httpMethod: string;
  methodName: string;
  hasRequireAction: boolean;
  requireActionValue?: string;
  hasRBACGuard: boolean;
  hasRateLimitGuard: boolean;
  hasPublicDecorator: boolean;
  isMutation: boolean;
  serviceCalls: ServiceCall[];
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OK';
  issues: string[];
}

interface ServiceCall {
  serviceName: string;
  methodName: string;
  hasTenantGuard: boolean;
  hasAuditLog: boolean;
  hasRBACCheck: boolean;
}

const CONTROLLER_PATTERN = '**/*.controller.ts';
const BASE_PATH = path.join(__dirname, '../../services/core-api/src');
const MUTATION_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];
const MUTATION_METHOD_NAMES = /^(create|update|delete|assign|revoke|publish|remove|save|clear)/i;

class RBACScanner {
  private results: ControllerMethod[] = [];

  async scan(): Promise<void> {
    const controllerFiles = await globSync(CONTROLLER_PATTERN, {
      cwd: BASE_PATH,
      absolute: true,
    });

    console.log(`Found ${controllerFiles.length} controller files`);

    for (const file of controllerFiles) {
      await this.scanFile(file);
    }

    this.analyseResults();
    this.generateReports();
  }

  private async scanFile(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(BASE_PATH, filePath);

    // Extract controller route
    const controllerRouteMatch = content.match(/@Controller\(['"]([^'"]+)['"]\)/);
    const controllerRoute = controllerRouteMatch ? controllerRouteMatch[1] : '';

    // Check if class has RBACGuard
    const classHasRBACGuard = /@UseGuards\([^)]*RBACGuard[^)]*\)/.test(content);

    // Find all methods with HTTP decorators - improved pattern
    // Match decorators before method definition
    const lines = content.split('\n');
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i];
      
      // Look for HTTP decorator
      const httpMatch = line.match(/@(Get|Post|Patch|Put|Delete|All)\((['"][^'"]*['"])?\)/);
      if (httpMatch) {
        const httpMethod = httpMatch[1].toUpperCase();
        const routeParam = httpMatch[2] ? httpMatch[2].replace(/['"]/g, '') : '';
        const fullRoute = routeParam ? `${controllerRoute}${routeParam}` : controllerRoute;
        
        // Look ahead for method name and decorators
        let methodName = '';
        let hasRequireAction = false;
        let requireActionValue: string | undefined;
        let hasRBACGuard = classHasRBACGuard;
        let hasRateLimitGuard = false;
        let hasPublicDecorator = false;
        
        let j = i + 1;
        while (j < lines.length && j < i + 20) {
          const nextLine = lines[j];
          
          // Check for RequireAction
          const requireActionMatch = nextLine.match(/@RequireAction\(['"]([^'"]+)['"]\)/);
          if (requireActionMatch) {
            hasRequireAction = true;
            requireActionValue = requireActionMatch[1];
          }
          
          // Check for guards
          if (nextLine.includes('@UseGuards')) {
            if (nextLine.includes('RBACGuard')) {
              hasRBACGuard = true;
            }
            if (nextLine.includes('RateLimitGuard')) {
              hasRateLimitGuard = true;
            }
          }
          
          // Check for Public
          if (nextLine.includes('@Public()')) {
            hasPublicDecorator = true;
          }
          
          // Extract method name
          const methodMatch = nextLine.match(/(?:async\s+)?(\w+)\s*\(/);
          if (methodMatch && !methodName) {
            methodName = methodMatch[1];
            break;
          }
          
          j++;
        }
        
        if (!methodName) {
          i++;
          continue;
        }
        
        // Check if mutation
        const isMutation = MUTATION_METHODS.includes(httpMethod) || MUTATION_METHOD_NAMES.test(methodName);
        
        // Extract method body for service call analysis
        const methodStartIdx = content.indexOf(`async ${methodName}(`, i * 100) >= 0 
          ? content.indexOf(`async ${methodName}(`, i * 100)
          : content.indexOf(`${methodName}(`, i * 100) >= 0
          ? content.indexOf(`${methodName}(`, i * 100)
          : -1;
        const methodBlock = methodStartIdx > 0 ? this.extractMethodBlock(content, methodStartIdx) : '';
        
        // Find service calls
        const serviceCalls = this.extractServiceCalls(methodBlock);
        
        // Analyse severity
        const issues: string[] = [];
        let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OK' = 'OK';

        if (isMutation && !hasPublicDecorator) {
          if (!hasRequireAction) {
            issues.push('Missing @RequireAction decorator');
            severity = 'CRITICAL';
          }
          if (!hasRBACGuard) {
            issues.push('Missing RBACGuard');
            severity = 'CRITICAL';
          }

          // Check for tenant guard in service calls or method body
          const hasTenantGuardInService = serviceCalls.some(sc => sc.hasTenantGuard) ||
                                          /OkrTenantGuard\.(assert|build)/.test(methodBlock);
          if (!hasTenantGuardInService && !hasPublicDecorator) {
            issues.push('No tenant guard assertion found in service methods');
            severity = severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
          }

          // Check for audit log
          const hasAuditLogInService = serviceCalls.some(sc => sc.hasAuditLog) ||
                                        /auditLogService\.(record|log)/i.test(methodBlock) ||
                                        /AuditLogService\.(record|log)/i.test(methodBlock);
          if (!hasAuditLogInService && !hasPublicDecorator) {
            issues.push('No audit log call found');
            severity = severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
          }
        }

        if (issues.length === 0 && isMutation) {
          severity = 'OK';
        }

        this.results.push({
          file: relativePath,
          line: i + 1,
          route: fullRoute,
          httpMethod,
          methodName,
          hasRequireAction,
          requireActionValue,
          hasRBACGuard,
          hasRateLimitGuard,
          hasPublicDecorator,
          isMutation,
          serviceCalls,
          severity,
          issues,
        });
      }
      
      i++;
    }
  }

  private extractMethodBlock(content: string, startIndex: number): string {
    let braceCount = 0;
    let inMethod = false;
    let endIndex = startIndex;

    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];
      if (char === '{') {
        braceCount++;
        inMethod = true;
      } else if (char === '}') {
        braceCount--;
        if (inMethod && braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }

    return content.substring(startIndex, endIndex);
  }

  private extractServiceCalls(methodBlock: string): ServiceCall[] {
    const serviceCalls: ServiceCall[] = [];

    // Match patterns like: this.serviceName.methodName(...)
    const serviceCallPattern = /this\.(\w+)\.(\w+)\s*\(/g;
    let match;

    while ((match = serviceCallPattern.exec(methodBlock)) !== null) {
      const serviceName = match[1];
      const methodName = match[2];

      // Check for tenant guard calls
      const hasTenantGuard = /OkrTenantGuard\.(assert|build)/.test(methodBlock);

      // Check for audit log calls
      const hasAuditLog = /auditLogService\.(record|log)/i.test(methodBlock) ||
                          /AuditLogService\.(record|log)/i.test(methodBlock);

      // Check for RBAC checks
      const hasRBACCheck = /rbacService\.(can|canPerformAction)/i.test(methodBlock) ||
                          /RBACService\.(can|canPerformAction)/i.test(methodBlock) ||
                          /\.can(Edit|Delete|View|Create)/.test(methodBlock);

      serviceCalls.push({
        serviceName,
        methodName,
        hasTenantGuard,
        hasAuditLog,
        hasRBACCheck,
      });
    }

    return serviceCalls;
  }

  private analyseResults(): void {
    const critical = this.results.filter(r => r.severity === 'CRITICAL');
    const high = this.results.filter(r => r.severity === 'HIGH');
    const medium = this.results.filter(r => r.severity === 'MEDIUM');
    const low = this.results.filter(r => r.severity === 'LOW');

    console.log(`\nAnalysis complete:`);
    console.log(`  Total endpoints: ${this.results.length}`);
    console.log(`  Mutations: ${this.results.filter(r => r.isMutation).length}`);
    console.log(`  CRITICAL issues: ${critical.length}`);
    console.log(`  HIGH issues: ${high.length}`);
    console.log(`  MEDIUM issues: ${medium.length}`);
    console.log(`  LOW issues: ${low.length}`);

    if (critical.length > 0) {
      process.exitCode = 1;
    }
  }

  private generateReports(): void {
    this.generateMarkdownReport();
    this.generateCSVReport();
    this.generateConsistencyReport();
    this.generateMermaidDiagram();
  }

  private generateMarkdownReport(): void {
    const output = ['# RBAC Enforcement Map\n', `Generated: ${new Date().toISOString()}\n\n`];

    // Group by file
    const byFile = new Map<string, ControllerMethod[]>();
    for (const result of this.results) {
      if (!byFile.has(result.file)) {
        byFile.set(result.file, []);
      }
      byFile.get(result.file)!.push(result);
    }

    for (const [file, methods] of byFile.entries()) {
      output.push(`## ${file}\n\n`);
      output.push('| Route | Method | HTTP | RequireAction | RBACGuard | Tenant Guard | Audit Log | Severity | Issues |\n');
      output.push('|-------|--------|------|---------------|-----------|--------------|-----------|----------|--------|\n');

      for (const method of methods) {
        const tenantGuard = method.serviceCalls.some(sc => sc.hasTenantGuard) ? '✓' : '✗';
        const auditLog = method.serviceCalls.some(sc => sc.hasAuditLog) ? '✓' : '✗';
        const action = method.requireActionValue || '-';
        const rbacGuard = method.hasRBACGuard ? '✓' : '✗';
        const issues = method.issues.join('; ') || '-';
        const severity = method.severity;

        output.push(`| \`${method.route}\` | \`${method.methodName}\` | ${method.httpMethod} | ${action} | ${rbacGuard} | ${tenantGuard} | ${auditLog} | ${severity} | ${issues} |\n`);
      }
      output.push('\n');
    }

    fs.writeFileSync(
      path.join(__dirname, '../../docs/audit/RBAC_ENFORCEMENT_MAP.md'),
      output.join('')
    );
  }

  private generateCSVReport(): void {
    const headers = [
      'File',
      'Line',
      'Route',
      'HTTP Method',
      'Method Name',
      'Is Mutation',
      'Has RequireAction',
      'RequireAction Value',
      'Has RBACGuard',
      'Has RateLimitGuard',
      'Has Public Decorator',
      'Has Tenant Guard',
      'Has Audit Log',
      'Has RBAC Check',
      'Severity',
      'Issues',
    ];

    const rows = this.results.map(r => [
      r.file,
      r.line.toString(),
      r.route,
      r.httpMethod,
      r.methodName,
      r.isMutation.toString(),
      r.hasRequireAction.toString(),
      r.requireActionValue || '',
      r.hasRBACGuard.toString(),
      r.hasRateLimitGuard.toString(),
      r.hasPublicDecorator.toString(),
      r.serviceCalls.some(sc => sc.hasTenantGuard).toString(),
      r.serviceCalls.some(sc => sc.hasAuditLog).toString(),
      r.serviceCalls.some(sc => sc.hasRBACCheck).toString(),
      r.severity,
      r.issues.join('; '),
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');

    fs.writeFileSync(
      path.join(__dirname, '../../docs/audit/RBAC_ENFORCEMENT_MAP.csv'),
      csv
    );
  }

  private generateConsistencyReport(): void {
    const output = ['# RBAC Guard Consistency Report\n', `Generated: ${new Date().toISOString()}\n\n`];

    const critical = this.results.filter(r => r.severity === 'CRITICAL');
    const high = this.results.filter(r => r.severity === 'HIGH');
    const medium = this.results.filter(r => r.severity === 'MEDIUM');

    if (critical.length > 0) {
      output.push('## CRITICAL Issues\n\n');
      for (const result of critical) {
        output.push(`### ${result.file}:${result.line} - ${result.methodName}\n\n`);
        output.push(`- **Route:** \`${result.route}\`\n`);
        output.push(`- **HTTP Method:** ${result.httpMethod}\n`);
        output.push(`- **Issues:**\n`);
        for (const issue of result.issues) {
          output.push(`  - ${issue}\n`);
        }
        output.push('\n');
      }
    }

    if (high.length > 0) {
      output.push('## HIGH Issues\n\n');
      for (const result of high) {
        output.push(`### ${result.file}:${result.line} - ${result.methodName}\n\n`);
        output.push(`- **Route:** \`${result.route}\`\n`);
        output.push(`- **HTTP Method:** ${result.httpMethod}\n`);
        output.push(`- **Issues:**\n`);
        for (const issue of result.issues) {
          output.push(`  - ${issue}\n`);
        }
        output.push('\n');
      }
    }

    if (medium.length > 0) {
      output.push('## MEDIUM Issues\n\n');
      for (const result of medium) {
        output.push(`### ${result.file}:${result.line} - ${result.methodName}\n\n`);
        output.push(`- **Route:** \`${result.route}\`\n`);
        output.push(`- **HTTP Method:** ${result.httpMethod}\n`);
        output.push(`- **Issues:**\n`);
        for (const issue of result.issues) {
          output.push(`  - ${issue}\n`);
        }
        output.push('\n');
      }
    }

    if (critical.length === 0 && high.length === 0 && medium.length === 0) {
      output.push('## No Issues Found\n\nAll endpoints have proper RBAC enforcement.\n');
    }

    fs.writeFileSync(
      path.join(__dirname, '../../docs/audit/RBAC_GUARD_CONSISTENCY_REPORT.md'),
      output.join('')
    );
  }

  private generateMermaidDiagram(): void {
    const output = ['# RBAC Call Graph\n', `Generated: ${new Date().toISOString()}\n\n`, '```mermaid\n', 'graph TD\n'];

    for (const result of this.results) {
      if (!result.isMutation) continue;

      const controllerName = path.basename(result.file, '.controller.ts');
      const nodeId = `${controllerName}_${result.methodName}`;

      output.push(`  ${nodeId}["${controllerName}.${result.methodName}<br/>${result.httpMethod} ${result.route}"]\n`);

      for (const serviceCall of result.serviceCalls) {
        const serviceNodeId = `${serviceCall.serviceName}_${serviceCall.methodName}`;
        output.push(`  ${nodeId} --> ${serviceNodeId}["${serviceCall.serviceName}.${serviceCall.methodName}"]\n`);

        if (serviceCall.hasTenantGuard) {
          output.push(`  ${serviceNodeId} -.-> TenantGuard["OkrTenantGuard"]\n`);
        }
        if (serviceCall.hasAuditLog) {
          output.push(`  ${serviceNodeId} -.-> AuditLog["AuditLogService"]\n`);
        }
        if (serviceCall.hasRBACCheck) {
          output.push(`  ${serviceNodeId} -.-> RBAC["RBACService"]\n`);
        }
      }
    }

    output.push('```\n');

    fs.writeFileSync(
      path.join(__dirname, '../../docs/audit/RBAC_CALLGRAPH_MERMAID.md'),
      output.join('')
    );
  }
}

// Run scanner
if (require.main === module) {
  const scanner = new RBACScanner();
  scanner.scan().catch(err => {
    console.error('Scanner error:', err);
    process.exit(1);
  });
}

export { RBACScanner };

