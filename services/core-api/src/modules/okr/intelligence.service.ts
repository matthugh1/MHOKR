import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OkrTenantGuard } from './tenant-guard';
import { OkrReportingService } from './okr-reporting.service';

/**
 * Intelligence Service
 * 
 * Provides AI-powered insights and analysis for user work items.
 * Analyzes patterns, identifies blockers, suggests focus areas, and integrates
 * with existing AI personas for deeper insights.
 */
@Injectable()
export class IntelligenceService {
  private readonly logger = new Logger(IntelligenceService.name);

  constructor(
    private prisma: PrismaService,
    private reportingService: OkrReportingService,
  ) {}

  /**
   * Get work insights for a user.
   * 
   * Analyzes user's work items to identify:
   * - Blockers and bottlenecks
   * - Focus areas
   * - Patterns (e.g., stale items, workload distribution)
   * - Suggested actions
   * 
   * @param userId - The user ID
   * @param userOrganizationId - null for superuser (all orgs), string for specific org, undefined/falsy for no access
   * @returns Insights object with analysis and suggestions
   */
  async getUserWorkInsights(
    userId: string,
    userOrganizationId: string | null | undefined,
  ): Promise<{
    overdueCount: number;
    dueThisWeekCount: number;
    atRiskCount: number;
    staleCount: number;
    blockedCount: number;
    focusSuggestion: string | null;
    patterns: Array<{
      type: string;
      message: string;
      severity: 'low' | 'medium' | 'high';
    }>;
    workloadDistribution: {
      byType: Record<string, number>;
      byStatus: Record<string, number>;
    };
  }> {
    // Tenant isolation: if user has no org, return empty insights
    if (userOrganizationId === undefined || userOrganizationId === '') {
      return {
        overdueCount: 0,
        dueThisWeekCount: 0,
        atRiskCount: 0,
        staleCount: 0,
        blockedCount: 0,
        focusSuggestion: null,
        patterns: [],
        workloadDistribution: {
          byType: {},
          byStatus: {},
        },
      };
    }

    // Get all user's work items
    const [objectives, keyResults, initiatives, tasks, todos] = await Promise.all([
      this.reportingService.getUserOwnedObjectives(userId, userOrganizationId),
      this.reportingService.getUserOwnedKeyResults(userId, userOrganizationId),
      this.reportingService.getUserOwnedInitiatives(userId, userOrganizationId),
      this.reportingService.getUserOwnedTasks(userId, userOrganizationId),
      this.reportingService.getMyTodos(userId, userOrganizationId),
    ]);

    // Calculate counts
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const overdueCount = todos.filter(t => t.reason.includes('Overdue')).length;
    const dueThisWeekCount = todos.filter(t => {
      if (!t.dueDate) return false;
      const dueDate = new Date(t.dueDate);
      return dueDate >= today && dueDate <= nextWeek;
    }).length;
    const atRiskCount = objectives.filter(o => o.status === 'AT_RISK' || o.status === 'OFF_TRACK').length +
                       keyResults.filter(kr => kr.status === 'AT_RISK' || kr.status === 'OFF_TRACK').length;
    const staleCount = todos.filter(t => t.reason.includes('No update')).length;
    const blockedCount = initiatives.filter(i => i.status === 'BLOCKED').length +
                        tasks.filter(t => t.status === 'BLOCKED').length;

    // Identify patterns
    const patterns: Array<{
      type: string;
      message: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    // Pattern: Multiple stale items
    if (staleCount >= 3) {
      patterns.push({
        type: 'STALE_ITEMS',
        message: `${staleCount} items haven't been updated in 14+ days`,
        severity: staleCount >= 5 ? 'high' : 'medium',
      });
    }

    // Pattern: Many overdue check-ins
    if (overdueCount >= 3) {
      patterns.push({
        type: 'OVERDUE_CHECKINS',
        message: `${overdueCount} check-ins are overdue`,
        severity: overdueCount >= 5 ? 'high' : 'medium',
      });
    }

    // Pattern: Multiple blocked items
    if (blockedCount >= 3) {
      patterns.push({
        type: 'BLOCKED_ITEMS',
        message: `${blockedCount} items are blocked - consider addressing blockers`,
        severity: 'high',
      });
    }

    // Pattern: High at-risk count
    if (atRiskCount >= 3) {
      patterns.push({
        type: 'AT_RISK_ITEMS',
        message: `${atRiskCount} items are at risk - focus may be needed`,
        severity: atRiskCount >= 5 ? 'high' : 'medium',
      });
    }

    // Pattern: Tasks due soon
    if (dueThisWeekCount >= 5) {
      patterns.push({
        type: 'UPCOMING_DEADLINES',
        message: `${dueThisWeekCount} items due this week - plan your time accordingly`,
        severity: 'medium',
      });
    }

    // Advanced Pattern Detection

    // Pattern: High workload concentration (many items of same type)
    const workloadByType = {
      OBJECTIVE: objectives.length,
      KEY_RESULT: keyResults.length,
      INITIATIVE: initiatives.length,
      TASK: tasks.length,
    };
    const maxWorkloadType = Object.entries(workloadByType).reduce((a, b) => 
      workloadByType[a[0] as keyof typeof workloadByType] > workloadByType[b[0] as keyof typeof workloadByType] ? a : b
    );
    if (maxWorkloadType[1] >= 10 && maxWorkloadType[1] / (objectives.length + keyResults.length + initiatives.length + tasks.length) > 0.5) {
      patterns.push({
        type: 'WORKLOAD_CONCENTRATION',
        message: `High concentration of ${maxWorkloadType[0].toLowerCase()}s (${maxWorkloadType[1]}) - consider delegating or redistributing`,
        severity: 'medium',
      });
    }

    // Pattern: Progress stagnation (items with same progress for 14+ days)
    const staleProgressItems = todos.filter(t => 
      t.reason.includes('No update') && 
      t.metadata.progress !== undefined && 
      t.metadata.progress > 0 && 
      t.metadata.progress < 100
    );
    if (staleProgressItems.length >= 3) {
      patterns.push({
        type: 'PROGRESS_STAGNATION',
        message: `${staleProgressItems.length} items show no progress updates - review blockers or adjust targets`,
        severity: staleProgressItems.length >= 5 ? 'high' : 'medium',
      });
    }

    // Pattern: Dependency bottlenecks (multiple blocked items linked to same parent)
    const blockedByParent = new Map<string, number>();
    initiatives.filter(i => i.status === 'BLOCKED').forEach(init => {
      const parentId = init.objectiveId || 'unknown';
      blockedByParent.set(parentId, (blockedByParent.get(parentId) || 0) + 1);
    });
    tasks.filter(t => t.status === 'BLOCKED').forEach(task => {
      const parentId = task.keyResultId || task.initiativeId || 'unknown';
      blockedByParent.set(parentId, (blockedByParent.get(parentId) || 0) + 1);
    });
    const bottleneckParents = Array.from(blockedByParent.entries()).filter(([_, count]) => count >= 2);
    if (bottleneckParents.length > 0) {
      patterns.push({
        type: 'DEPENDENCY_BOTTLENECK',
        message: `${bottleneckParents.length} parent item${bottleneckParents.length !== 1 ? 's' : ''} have multiple blocked dependencies - address root causes`,
        severity: 'high',
      });
    }

    // Pattern: Overdue check-ins clustering (multiple overdue check-ins for same objective)
    const overdueByObjective = new Map<string, number>();
    todos.filter(t => t.type === 'CHECK_IN' && t.reason.includes('Overdue')).forEach(todo => {
      const objId = todo.metadata.objectiveId || 'unknown';
      overdueByObjective.set(objId, (overdueByObjective.get(objId) || 0) + 1);
    });
    const clusteredOverdue = Array.from(overdueByObjective.entries()).filter(([_, count]) => count >= 2);
    if (clusteredOverdue.length > 0) {
      patterns.push({
        type: 'CHECKIN_CLUSTERING',
        message: `${clusteredOverdue.length} objective${clusteredOverdue.length !== 1 ? 's' : ''} have multiple overdue check-ins - consider adjusting cadence`,
        severity: 'medium',
      });
    }

    // Pattern: Status consistency (all items in same status category)
    const statusDistribution = {
      ON_TRACK: objectives.filter(o => o.status === 'ON_TRACK').length + keyResults.filter(kr => kr.status === 'ON_TRACK').length,
      AT_RISK: objectives.filter(o => o.status === 'AT_RISK').length + keyResults.filter(kr => kr.status === 'AT_RISK').length,
      OFF_TRACK: objectives.filter(o => o.status === 'OFF_TRACK').length + keyResults.filter(kr => kr.status === 'OFF_TRACK').length,
    };
    const totalTracked = statusDistribution.ON_TRACK + statusDistribution.AT_RISK + statusDistribution.OFF_TRACK;
    if (totalTracked > 0) {
      const atRiskRatio = statusDistribution.AT_RISK / totalTracked;
      const offTrackRatio = statusDistribution.OFF_TRACK / totalTracked;
      if (atRiskRatio >= 0.5 || offTrackRatio >= 0.3) {
        patterns.push({
          type: 'STATUS_CONSISTENCY',
          message: `${Math.round((atRiskRatio + offTrackRatio) * 100)}% of items are at risk or off track - review overall strategy`,
          severity: offTrackRatio >= 0.3 ? 'high' : 'medium',
        });
      }
    }

    // Workload distribution
    const workloadDistribution = {
      byType: {
        OBJECTIVE: objectives.length,
        KEY_RESULT: keyResults.length,
        INITIATIVE: initiatives.length,
        TASK: tasks.length,
      },
      byStatus: {
        ON_TRACK: objectives.filter(o => o.status === 'ON_TRACK').length +
                 keyResults.filter(kr => kr.status === 'ON_TRACK').length,
        AT_RISK: objectives.filter(o => o.status === 'AT_RISK').length +
                keyResults.filter(kr => kr.status === 'AT_RISK').length,
        OFF_TRACK: objectives.filter(o => o.status === 'OFF_TRACK').length +
                  keyResults.filter(kr => kr.status === 'OFF_TRACK').length,
        COMPLETED: objectives.filter(o => o.status === 'COMPLETED').length +
                  keyResults.filter(kr => kr.status === 'COMPLETED').length +
                  initiatives.filter(i => i.status === 'COMPLETED').length +
                  tasks.filter(t => t.status === 'COMPLETED').length,
        BLOCKED: blockedCount,
      },
    };

    // Generate focus suggestion
    let focusSuggestion: string | null = null;
    
    if (overdueCount > 0) {
      focusSuggestion = `Focus on ${overdueCount} overdue check-in${overdueCount !== 1 ? 's' : ''} - these are blocking progress`;
    } else if (blockedCount >= 3) {
      focusSuggestion = `Address ${blockedCount} blocked items - resolving blockers will unblock progress`;
    } else if (atRiskCount >= 3) {
      focusSuggestion = `${atRiskCount} items are at risk - review and update status`;
    } else if (staleCount >= 3) {
      focusSuggestion = `Update ${staleCount} stale item${staleCount !== 1 ? 's' : ''} - they haven't been updated in 14+ days`;
    } else if (dueThisWeekCount > 0) {
      focusSuggestion = `${dueThisWeekCount} item${dueThisWeekCount !== 1 ? 's' : ''} due this week - plan your time`;
    } else {
      focusSuggestion = 'All items are on track - great work!';
    }

    return {
      overdueCount,
      dueThisWeekCount,
      atRiskCount,
      staleCount,
      blockedCount,
      focusSuggestion,
      patterns,
      workloadDistribution,
    };
  }
}

