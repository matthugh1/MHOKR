import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VivaGoalsCSVParserService, ParsedVivaGoalsRow } from './viva-goals-csv-parser.service';
import { OkrCycleService } from './okr-cycle.service';
import { OkrTenantGuard } from './tenant-guard';
import { OKRStatus, MetricType, GoalType } from '@prisma/client';

export interface ImportResult {
  success: boolean;
  objectivesCreated: number;
  objectivesUpdated: number;
  keyResultsCreated: number;
  keyResultsUpdated: number;
  errors: ImportError[];
  warnings: string[];
}

export interface ImportError {
  row: number;
  externalId: string;
  title: string;
  error: string;
}

@Injectable()
export class OkrImportService {
  private readonly logger = new Logger(OkrImportService.name);
  private readonly SOURCE = 'VIVA_GOALS';

  constructor(
    private prisma: PrismaService,
    private csvParser: VivaGoalsCSVParserService,
    private cycleService: OkrCycleService,
  ) {}

  /**
   * Import OKRs from Viva Goals CSV content
   */
  async importFromCSV(
    csvContent: string,
    tenantId: string,
    userId: string,
  ): Promise<ImportResult> {
    OkrTenantGuard.assertCanMutateTenant(tenantId);

    // Parse CSV
    const parsedRows = this.csvParser.parseCSV(csvContent);
    if (parsedRows.length === 0) {
      throw new BadRequestException('CSV file is empty or invalid');
    }

    const result: ImportResult = {
      success: true,
      objectivesCreated: 0,
      objectivesUpdated: 0,
      keyResultsCreated: 0,
      keyResultsUpdated: 0,
      errors: [],
      warnings: [],
    };

    // Separate Objectives and Key Results
    const objectives = parsedRows.filter(r => r.objectType === 'Objective');
    const keyResults = parsedRows.filter(r => r.objectType === 'Key result');
    const deliverables = parsedRows.filter(r => r.objectType === 'Deliverable');

    if (deliverables.length > 0) {
      result.warnings.push(
        `Skipped ${deliverables.length} Deliverable(s) - Deliverables are not supported`,
      );
    }

    // Build external ID to internal ID mapping for parent lookups
    const externalIdToInternalId = new Map<string, string>();

    // Process Objectives first (they may be parents)
    for (let i = 0; i < objectives.length; i++) {
      try {
        const row = objectives[i];
        const row = objectives[i];
        const wasUpdate = await this.isObjectiveExisting(row.externalId, tenantId);
        const objective = await this.importObjective(row, tenantId, userId);
        if (objective) {
          externalIdToInternalId.set(row.externalId, objective.id);
          if (wasUpdate) {
            result.objectivesUpdated++;
          } else {
            result.objectivesCreated++;
          }
        }
      } catch (error) {
        result.success = false;
        result.errors.push({
          row: i + 2, // +2 for header row and 1-based indexing
          externalId: objectives[i].externalId,
          title: objectives[i].title,
          error: error instanceof Error ? error.message : String(error),
        });
        this.logger.error(`Error importing objective ${objectives[i].externalId}: ${error}`);
      }
    }

    // Process Key Results (they reference Objectives)
    for (let i = 0; i < keyResults.length; i++) {
      try {
        const row = keyResults[i];
        const wasUpdate = await this.isKeyResultExisting(row.externalId, tenantId);
        const keyResult = await this.importKeyResult(
          row,
          tenantId,
          userId,
          externalIdToInternalId,
        );
        if (keyResult) {
          if (wasUpdate) {
            result.keyResultsUpdated++;
          } else {
            result.keyResultsCreated++;
          }
        }
      } catch (error) {
        result.success = false;
        result.errors.push({
          row: objectives.length + i + 2,
          externalId: keyResults[i].externalId,
          title: keyResults[i].title,
          error: error instanceof Error ? error.message : String(error),
        });
        this.logger.error(`Error importing key result ${keyResults[i].externalId}: ${error}`);
      }
    }

    return result;
  }

  /**
   * Check if objective already exists
   */
  private async isObjectiveExisting(
    externalId: string,
    tenantId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.objective.findUnique({
      where: {
        tenantId_source_externalId: {
          tenantId,
          source: this.SOURCE,
          externalId,
        },
      },
    });
    return !!existing;
  }

  /**
   * Import a single Objective
   */
  private async importObjective(
    row: ParsedVivaGoalsRow,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    // Check if already imported (deduplication)
    const existing = await this.prisma.objective.findUnique({
      where: {
        tenantId_source_externalId: {
          tenantId,
          source: this.SOURCE,
          externalId: row.externalId,
        },
      },
    });

    // Resolve owner (first owner from list)
    const ownerId = await this.resolveUserNameToUserId(
      row.owners[0] || row.creator || null,
      tenantId,
    );
    if (!ownerId) {
      throw new BadRequestException(
        `Could not resolve owner for objective "${row.title}"`,
      );
    }

    // Resolve parent Objective if Aligned To is set
    let parentId: string | null = null;
    if (row.parentExternalId) {
      const parent = await this.prisma.objective.findFirst({
        where: {
          tenantId,
          source: this.SOURCE,
          externalId: row.parentExternalId,
        },
      });
      if (parent) {
        parentId = parent.id;
      } else {
        this.logger.warn(
          `Parent objective with externalId ${row.parentExternalId} not found for "${row.title}"`,
        );
      }
    }

    // Resolve cycle
    const cycleId = await this.resolveCycle(
      row.period,
      tenantId,
      row.startDate,
      row.endDate,
    );

    // Resolve team (optional)
    const teamId = row.team
      ? await this.resolveTeamNameToTeamId(row.team, tenantId)
      : null;

    // Resolve creator
    const createdBy = row.creator
      ? await this.resolveUserNameToUserId(row.creator, tenantId)
      : null;

    // Map status
    const status = this.mapStatus(row.status);

    // Map goal type
    const goalType = this.mapGoalType(row.goalType);

    // Parse dates
    const startDate = new Date(row.startDate);
    const endDate = new Date(row.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException(`Invalid dates for "${row.title}"`);
    }

    const data = {
      tenantId,
      title: row.title,
      description: row.description,
      ownerId,
      parentId,
      cycleId,
      teamId,
      createdBy,
      startDate,
      endDate,
      status,
      goalType,
      progress: row.progressPercent || 0,
      externalId: row.externalId,
      source: this.SOURCE,
      importedAt: new Date(),
      importedBy: userId,
      visibilityLevel: 'PUBLIC_TENANT' as const,
      state: 'DRAFT' as const,
    };

    if (existing) {
      // Update existing
      const updated = await this.prisma.objective.update({
        where: { id: existing.id },
        data: {
          ...data,
          // Don't update importedAt/importedBy on update
          importedAt: existing.importedAt,
          importedBy: existing.importedBy,
        },
      });
      // Note: objectivesUpdated is tracked in the calling method
      return updated;
    } else {
      // Create new
      const objective = await this.prisma.objective.create({ data });

      // Add additional owners as contributors
      if (row.owners.length > 1) {
        for (let i = 1; i < row.owners.length; i++) {
          const contributorId = await this.resolveUserNameToUserId(
            row.owners[i],
            tenantId,
          );
          if (contributorId) {
            await this.prisma.objectiveContributor.upsert({
              where: {
                objectiveId_userId: {
                  objectiveId: objective.id,
                  userId: contributorId,
                },
              },
              create: {
                objectiveId: objective.id,
                userId: contributorId,
                tenantId,
              },
              update: {},
            });
          }
        }
      }

      return objective;
    }
  }

  /**
   * Check if key result already exists
   */
  private async isKeyResultExisting(
    externalId: string,
    tenantId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.keyResult.findUnique({
      where: {
        tenantId_source_externalId: {
          tenantId,
          source: this.SOURCE,
          externalId,
        },
      },
    });
    return !!existing;
  }

  /**
   * Import a single Key Result
   */
  private async importKeyResult(
    row: ParsedVivaGoalsRow,
    tenantId: string,
    userId: string,
    externalIdToInternalId: Map<string, string>,
  ): Promise<any> {
    // Check if already imported
    const existing = await this.prisma.keyResult.findUnique({
      where: {
        tenantId_source_externalId: {
          tenantId,
          source: this.SOURCE,
          externalId: row.externalId,
        },
      },
    });

    // Resolve owner
    const ownerId = await this.resolveUserNameToUserId(
      row.owners[0] || row.creator || null,
      tenantId,
    );
    if (!ownerId) {
      throw new BadRequestException(
        `Could not resolve owner for key result "${row.title}"`,
      );
    }

    // Resolve parent Objective
    let objectiveId: string | null = null;
    let weight: number = 1.0;

    if (row.parentExternalId) {
      // Try to find by externalId first
      const parentObjective = await this.prisma.objective.findFirst({
        where: {
          tenantId,
          source: this.SOURCE,
          externalId: row.parentExternalId,
        },
      });

      if (parentObjective) {
        objectiveId = parentObjective.id;
      } else if (externalIdToInternalId.has(row.parentExternalId)) {
        // Use mapping from current import batch
        objectiveId = externalIdToInternalId.get(row.parentExternalId)!;
      } else {
        throw new NotFoundException(
          `Parent objective with externalId ${row.parentExternalId} not found for "${row.title}"`,
        );
      }

      // Convert weight percentage to decimal (0-100% -> 0.0-1.0)
      if (row.parentWeight !== null) {
        weight = row.parentWeight / 100.0;
      }
    } else {
      throw new BadRequestException(
        `Key result "${row.title}" must have a parent objective`,
      );
    }

    // Resolve cycle
    const cycleId = await this.resolveCycle(
      row.period,
      tenantId,
      row.startDate,
      row.endDate,
    );

    // Resolve team
    const teamId = row.team
      ? await this.resolveTeamNameToTeamId(row.team, tenantId)
      : null;

    // Resolve creator
    const createdBy = row.creator
      ? await this.resolveUserNameToUserId(row.creator, tenantId)
      : null;

    // Map status
    const status = this.mapStatus(row.status);

    // Map goal type
    const goalType = this.mapGoalType(row.goalType);

    // Infer metric type
    const metricType = this.inferMetricType(
      row.start || 0,
      row.target || 100,
      row.unit,
    );

    // Calculate current value from actual progress percentage
    const currentValue = this.calculateCurrentValue(
      row.start || 0,
      row.target || 100,
      row.actualProgress,
      row.unit,
    );

    // Parse dates
    const startDate = row.startDate ? new Date(row.startDate) : null;
    const endDate = row.endDate ? new Date(row.endDate) : null;

    const data = {
      tenantId,
      title: row.title,
      description: row.description,
      ownerId,
      cycleId,
      teamId,
      createdBy,
      startDate,
      endDate,
      metricType,
      startValue: row.start || 0,
      targetValue: row.target || 100,
      currentValue,
      unit: row.unit,
      status,
      goalType,
      progress: row.progressPercent || 0,
      externalId: row.externalId,
      source: this.SOURCE,
      importedAt: new Date(),
      importedBy: userId,
      visibilityLevel: 'PUBLIC_TENANT' as const,
      state: 'DRAFT' as const,
    };

    let keyResult;
    if (existing) {
      keyResult = await this.prisma.keyResult.update({
        where: { id: existing.id },
        data: {
          ...data,
          importedAt: existing.importedAt,
          importedBy: existing.importedBy,
        },
      });
      // Note: keyResultsUpdated is tracked in the calling method
    } else {
      keyResult = await this.prisma.keyResult.create({ data });
    }

    // Link to Objective with weight
    if (objectiveId) {
      await this.prisma.objectiveKeyResult.upsert({
        where: {
          objectiveId_keyResultId: {
            objectiveId,
            keyResultId: keyResult.id,
          },
        },
        create: {
          objectiveId,
          keyResultId: keyResult.id,
          tenantId,
          weight,
        },
        update: {
          weight,
        },
      });
    }

    // Add additional owners as contributors
    if (row.owners.length > 1) {
      for (let i = 1; i < row.owners.length; i++) {
        const contributorId = await this.resolveUserNameToUserId(
          row.owners[i],
          tenantId,
        );
        if (contributorId) {
          await this.prisma.keyResultContributor.upsert({
            where: {
              keyResultId_userId: {
                keyResultId: keyResult.id,
                userId: contributorId,
              },
            },
            create: {
              keyResultId: keyResult.id,
              userId: contributorId,
              tenantId,
            },
            update: {},
          });
        }
      }
    }

    return keyResult;
  }

  /**
   * Resolve user name to User ID (exact match)
   */
  private async resolveUserNameToUserId(
    name: string | null,
    tenantId: string,
  ): Promise<string | null> {
    if (!name || !name.trim()) {
      return null;
    }

    // Try exact match first
    const user = await this.prisma.user.findFirst({
      where: {
        name: {
          equals: name.trim(),
          mode: 'insensitive',
        },
        primaryOrganizationId: tenantId,
      },
    });

    return user?.id || null;
  }

  /**
   * Resolve team name to Team ID (exact match, takes first if semicolon-separated)
   */
  private async resolveTeamNameToTeamId(
    teamName: string,
    tenantId: string,
  ): Promise<string | null> {
    if (!teamName || !teamName.trim()) {
      return null;
    }

    // Handle semicolon-separated teams (take first)
    const firstTeam = teamName.split(';')[0].trim();

    const team = await this.prisma.team.findFirst({
      where: {
        name: {
          equals: firstTeam,
          mode: 'insensitive',
        },
        tenantId,
      },
    });

    return team?.id || null;
  }

  /**
   * Resolve or create Cycle from period name
   */
  private async resolveCycle(
    periodName: string,
    tenantId: string,
    startDateStr: string,
    endDateStr: string,
  ): Promise<string | null> {
    if (!periodName || !periodName.trim()) {
      return null;
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return null;
    }

    // Try to find existing cycle by name and dates
    const existing = await this.prisma.cycle.findFirst({
      where: {
        tenantId,
        name: periodName.trim(),
        startDate: startDate,
        endDate: endDate,
      },
    });

    if (existing) {
      return existing.id;
    }

    // Create new cycle
    try {
      const cycle = await this.cycleService.create(
        {
          name: periodName.trim(),
          startDate,
          endDate,
          status: 'DRAFT',
        },
        tenantId,
      );
      return cycle.id;
    } catch (error) {
      this.logger.warn(
        `Failed to create cycle "${periodName}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Map Viva Goals status to OKRStatus enum
   */
  private mapStatus(vivaStatus: string): OKRStatus {
    const normalized = vivaStatus?.toLowerCase().trim() || '';
    switch (normalized) {
      case 'not started':
        return OKRStatus.NOT_STARTED;
      case 'on track':
        return OKRStatus.ON_TRACK;
      case 'at risk':
        return OKRStatus.AT_RISK;
      case 'behind':
        return OKRStatus.AT_RISK;
      case 'off track':
        return OKRStatus.OFF_TRACK;
      case 'closed':
      case 'completed':
        return OKRStatus.COMPLETED;
      case 'postponed':
      case 'cancelled':
        return OKRStatus.CANCELLED;
      default:
        return OKRStatus.ON_TRACK; // Default
    }
  }

  /**
   * Map Viva Goals goal type to GoalType enum
   */
  private mapGoalType(vivaGoalType: string): GoalType | null {
    const normalized = vivaGoalType?.toLowerCase().trim() || '';
    if (normalized.includes('aspirational')) {
      return GoalType.ASPIRATIONAL;
    } else if (normalized.includes('committed')) {
      return GoalType.COMMITTED;
    }
    return GoalType.ASPIRATIONAL; // Default
  }

  /**
   * Infer metric type from Start/Target relationship
   */
  private inferMetricType(
    start: number,
    target: number,
    unit: string | null,
  ): MetricType {
    // Special case: percentage-based metrics with Start=0, Target=100
    if (unit === '%' && start === 0 && target === 100) {
      return MetricType.REACH;
    }

    if (start < target) {
      return MetricType.INCREASE;
    } else if (start > target) {
      return MetricType.DECREASE;
    } else {
      return MetricType.MAINTAIN;
    }
  }

  /**
   * Calculate current value from actual progress percentage
   */
  private calculateCurrentValue(
    start: number,
    target: number,
    actualProgress: number | null,
    unit: string | null,
  ): number {
    if (actualProgress === null) {
      return start; // Default to start value
    }

    // If unit is percentage, calculate absolute value
    if (unit === '%') {
      return start + (actualProgress / 100.0) * (target - start);
    }

    // Otherwise, assume actualProgress is already absolute
    return actualProgress;
  }
}

