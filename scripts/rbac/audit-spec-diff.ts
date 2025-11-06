#!/usr/bin/env ts-node
/**
 * RBAC Spec vs Code Diff
 * 
 * Compares the auto-generated RBAC matrix with the actual enforcement map
 * to detect drift between specification and implementation.
 */

import * as fs from 'fs';
import * as path from 'path';

interface EnforcementEntry {
  file: string;
  route: string;
  httpMethod: string;
  requireActionValue?: string;
}

interface SpecAction {
  role: string;
  action: string;
  allowed: boolean;
  lineReference?: string;
}

class SpecDiff {
  private enforcementMap: EnforcementEntry[] = [];
  private specActions: SpecAction[] = [];
  private issues: string[] = [];

  async run(): Promise<void> {
    console.log('🔍 RBAC Spec vs Code Diff\n');

    // Load enforcement map CSV
    await this.loadEnforcementMap();

    // Load spec matrix
    await this.loadSpecMatrix();

    // Compare
    this.compareSpecVsCode();
    this.compareCodeVsSpec();

    // Generate report
    this.generateReport();
  }

  private async loadEnforcementMap(): Promise<void> {
    const csvPath = path.join(__dirname, '../../docs/audit/RBAC_ENFORCEMENT_MAP.csv');
    if (!fs.existsSync(csvPath)) {
      console.log('⚠️  Enforcement map CSV not found. Run audit-scan.ts first.');
      return;
    }

    const csv = fs.readFileSync(csvPath, 'utf-8');
    const lines = csv.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const records = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.replace(/^"|"$/g, '').trim());
      const record: any = {};
      headers.forEach((h, i) => {
        record[h] = values[i] || '';
      });
      return record;
    });

    this.enforcementMap = records.map((r: any) => ({
      file: r.File,
      route: r.Route,
      httpMethod: r['HTTP Method'],
      requireActionValue: r['RequireAction Value'] || undefined,
    })).filter((e: EnforcementEntry) => e.requireActionValue);
  }

  private async loadSpecMatrix(): Promise<void> {
    const specPath = path.join(__dirname, '../../docs/audit/RBAC_MATRIX_AUTO.md');
    if (!fs.existsSync(specPath)) {
      console.log('⚠️  Spec matrix not found.');
      return;
    }

    const content = fs.readFileSync(specPath, 'utf-8');
    const lines = content.split('\n');

    // Extract role-action mappings from the markdown table format
    let currentRole = '';
    for (const line of lines) {
      // Match role headers
      const roleMatch = line.match(/^### (SUPERUSER|TENANT_OWNER|TENANT_ADMIN|WORKSPACE_LEAD|TEAM_LEAD|TEAM_CONTRIBUTOR|TENANT_VIEWER)/);
      if (roleMatch) {
        currentRole = roleMatch[1];
        continue;
      }

      // Match action rows in tables
      const actionMatch = line.match(/\| `(\w+)` \| (✅|❌)/);
      if (actionMatch && currentRole) {
        const action = actionMatch[1];
        const allowed = actionMatch[2] === '✅';
        this.specActions.push({
          role: currentRole,
          action,
          allowed,
        });
      }
    }
  }

  private compareSpecVsCode(): void {
    // Find actions in spec but not enforced in code
    const enforcedActions = new Set(
      this.enforcementMap.map(e => e.requireActionValue).filter(Boolean)
    );

    const specActionsSet = new Set(this.specActions.map(s => s.action));

    for (const action of specActionsSet) {
      if (!enforcedActions.has(action)) {
        this.issues.push(`Action "${action}" is in spec but not found in any controller endpoint`);
      }
    }
  }

  private compareCodeVsSpec(): void {
    // Find endpoints enforcing actions not in spec
    const specActionsSet = new Set(this.specActions.map(s => s.action));

    for (const entry of this.enforcementMap) {
      if (entry.requireActionValue && !specActionsSet.has(entry.requireActionValue)) {
        this.issues.push(
          `Endpoint ${entry.route} (${entry.httpMethod}) enforces action "${entry.requireActionValue}" not in spec (${entry.file})`
        );
      }
    }

    // Check role-action mismatches (simplified - would need more context)
    for (const entry of this.enforcementMap) {
      if (!entry.requireActionValue) continue;

      // Check if action is allowed for any role (simplified check)
      const actionSpec = this.specActions.filter(s => s.action === entry.requireActionValue);
      if (actionSpec.length === 0) {
        this.issues.push(
          `Action "${entry.requireActionValue}" enforced at ${entry.route} has no spec definition`
        );
      }
    }
  }

  private generateReport(): void {
    const output: string[] = ['# RBAC Spec Drift Report\n', `Generated: ${new Date().toISOString()}\n\n`];

    output.push('## Summary\n\n');
    output.push(`- Total issues found: ${this.issues.length}\n`);
    output.push(`- Enforcement map entries: ${this.enforcementMap.length}\n`);
    output.push(`- Spec actions: ${this.specActions.length}\n\n`);

    if (this.issues.length > 0) {
      output.push('## Issues\n\n');
      for (let i = 0; i < this.issues.length; i++) {
        output.push(`${i + 1}. ${this.issues[i]}\n`);
      }
    } else {
      output.push('## No Issues Found\n\n');
      output.push('All enforced actions match the specification.\n');
    }

    // Detailed comparison
    output.push('\n## Detailed Comparison\n\n');

    // Group by action
    const actionGroups = new Map<string, { spec: SpecAction[]; code: EnforcementEntry[] }>();
    for (const action of this.specActions) {
      if (!actionGroups.has(action.action)) {
        actionGroups.set(action.action, { spec: [], code: [] });
      }
      actionGroups.get(action.action)!.spec.push(action);
    }

    for (const entry of this.enforcementMap) {
      if (entry.requireActionValue) {
        if (!actionGroups.has(entry.requireActionValue)) {
          actionGroups.set(entry.requireActionValue, { spec: [], code: [] });
        }
        actionGroups.get(entry.requireActionValue)!.code.push(entry);
      }
    }

    for (const [action, group] of actionGroups.entries()) {
      output.push(`### ${action}\n\n`);
      output.push(`**Spec:** ${group.spec.length} role(s)\n`);
      output.push(`**Code:** ${group.code.length} endpoint(s)\n\n`);

      if (group.code.length > 0) {
        output.push('Enforced at:\n');
        for (const entry of group.code) {
          output.push(`- \`${entry.route}\` (${entry.httpMethod}) in \`${entry.file}\`\n`);
        }
        output.push('\n');
      }
    }

    fs.writeFileSync(
      path.join(__dirname, '../../docs/audit/RBAC_SPEC_DRIFT.md'),
      output.join('')
    );

    console.log(`✅ Report generated: docs/audit/RBAC_SPEC_DRIFT.md`);
    if (this.issues.length > 0) {
      console.log(`⚠️  Found ${this.issues.length} issues`);
      process.exitCode = 1;
    }
  }
}

if (require.main === module) {
  const diff = new SpecDiff();
  diff.run().catch(err => {
    console.error('Diff error:', err);
    process.exit(1);
  });
}

export { SpecDiff };

