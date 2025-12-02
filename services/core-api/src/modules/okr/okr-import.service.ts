  import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VivaGoalsCSVParserService, ParsedVivaGoalsRow } from './viva-goals-csv-parser.service';
import { VivaGoalsJSONParserService, ParsedVivaGoalsJSONRow } from './viva-goals-json-parser.service';
import { OkrCycleService } from './okr-cycle.service';
import { OkrTenantGuard } from './tenant-guard';
import { ObjectiveOwnerService } from './objective-owner.service';
import { KeyResultOwnerService } from './key-result-owner.service';
import { PhasedTargetService } from './phased-target.service';
import { InitiativeService } from './initiative.service';
import { OKRStatus, MetricType, GoalType, PhasedTargetInterval, InitiativeStatus } from '@prisma/client';

export interface ImportResult {
  success: boolean;
  objectivesCreated: number;
  objectivesUpdated: number;
  keyResultsCreated: number;
  keyResultsUpdated: number;
  initiativesCreated: number;
  initiativesUpdated: number;
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
    private jsonParser: VivaGoalsJSONParserService,
    public cycleService: OkrCycleService, // Public for external access; direct prisma used in resolveCycle
    private objectiveOwnerService: ObjectiveOwnerService,
    private keyResultOwnerService: KeyResultOwnerService,
    private phasedTargetService: PhasedTargetService,
    private initiativeService: InitiativeService,
  ) { }

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
      initiativesCreated: 0,
      initiativesUpdated: 0,
      errors: [],
      warnings: [],
    };

    // Separate Objectives, Key Results, and Deliverables
    const objectives = parsedRows.filter(r => r.objectType === 'Objective');
    const keyResults = parsedRows.filter(r => r.objectType === 'Key result');
    const deliverables = parsedRows.filter(r => r.objectType === 'Deliverable');

    // Build external ID to internal ID mapping for parent lookups
    const externalIdToInternalId = new Map<string, string>();

    // Topologically sort Objectives to ensure parents are imported before children
    const sortedObjectives = this.topologicalSortObjectives(objectives);

    if (sortedObjectives.length !== objectives.length) {
      result.warnings.push(
        `Some objectives could not be sorted (circular dependencies or missing parents) - importing in original order`,
      );
      // Fallback to original order if sorting fails
      sortedObjectives.length = 0;
      sortedObjectives.push(...objectives);
    }

    // Phase 1: Import all Objectives WITHOUT parent relationships
    // This ensures all objectives exist before we try to link them
    for (let i = 0; i < objectives.length; i++) {
      const row = objectives[i];
      try {
        const wasUpdate = await this.isObjectiveExisting(row.externalId, tenantId);
        // Pass skipParentResolution=true to import without parent relationships
        const objective = await this.importObjective(row, tenantId, userId, externalIdToInternalId, true);
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
        const originalIndex = objectives.findIndex(o => o.externalId === row.externalId);
        result.errors.push({
          row: originalIndex >= 0 ? originalIndex + 2 : i + 2, // +2 for header row and 1-based indexing
          externalId: row.externalId,
          title: row.title,
          error: error instanceof Error ? error.message : String(error),
        });
        this.logger.error(`Error importing objective ${row.externalId}: ${error}`);
      }
    }

    // Phase 2: Update all Objectives to establish parent relationships
    // Now that all objectives exist, we can safely link them
    this.logger.log(`Establishing parent-child relationships for ${objectives.length} objectives...`);
    let relationshipsEstablished = 0;
    for (const row of objectives) {
      if (row.parentExternalId) {
        try {
          const childObjectiveId = externalIdToInternalId.get(row.externalId);
          const parentObjectiveId = externalIdToInternalId.get(row.parentExternalId);
          
          if (childObjectiveId && parentObjectiveId) {
            // Both exist - establish relationship
            await this.prisma.objective.update({
              where: { id: childObjectiveId },
              data: { parentId: parentObjectiveId },
            });
            relationshipsEstablished++;
          } else if (childObjectiveId && !parentObjectiveId) {
            // Parent might exist in database from previous import
            const parent = await this.prisma.objective.findFirst({
              where: {
                tenantId,
                source: this.SOURCE,
                externalId: row.parentExternalId,
              },
            });
            if (parent) {
              await this.prisma.objective.update({
                where: { id: childObjectiveId },
                data: { parentId: parent.id },
              });
              relationshipsEstablished++;
            } else {
              this.logger.warn(
                `Parent objective with externalId ${row.parentExternalId} not found for "${row.title}" - skipping parent relationship`,
              );
            }
          }
        } catch (error) {
          this.logger.warn(
            `Failed to establish parent relationship for objective "${row.title}": ${(error as Error).message}`,
          );
        }
      }
    }
    this.logger.log(`Established ${relationshipsEstablished} parent-child relationships`);

    // Topologically sort Key Results to ensure parent KRs are imported before child KRs
    const sortedKeyResults = this.topologicalSortKeyResults(keyResults, objectives);

    if (sortedKeyResults.length !== keyResults.length) {
      result.warnings.push(
        `Some key results could not be sorted (circular dependencies or missing parents) - importing in original order`,
      );
      sortedKeyResults.length = 0;
      sortedKeyResults.push(...keyResults);
    }

    // Process Key Results in topological order
    for (let i = 0; i < sortedKeyResults.length; i++) {
      try {
        const row = sortedKeyResults[i];
        const wasUpdate = await this.isKeyResultExisting(row.externalId, tenantId);
        const keyResult = await this.importKeyResult(
          row,
          tenantId,
          userId,
          externalIdToInternalId,
        );
        if (keyResult) {
          // Add KR to mapping for nested KR support
          externalIdToInternalId.set(row.externalId, keyResult.id);
          if (wasUpdate) {
            result.keyResultsUpdated++;
          } else {
            result.keyResultsCreated++;
          }
        }
      } catch (error) {
        result.success = false;
        const originalIndex = keyResults.findIndex(kr => kr.externalId === sortedKeyResults[i].externalId);
        result.errors.push({
          row: objectives.length + (originalIndex >= 0 ? originalIndex : i) + 2,
          externalId: sortedKeyResults[i].externalId,
          title: sortedKeyResults[i].title,
          error: error instanceof Error ? error.message : String(error),
        });
        this.logger.error(`Error importing key result ${sortedKeyResults[i].externalId}: ${error}`);
      }
    }

    // Process Deliverables as Initiatives (after objectives and key results are imported)
    if (deliverables.length > 0) {
      for (let i = 0; i < deliverables.length; i++) {
        try {
          const row = deliverables[i];
          const wasUpdate = await this.isInitiativeExisting(row.externalId, tenantId);
          const initiative = await this.importInitiative(
            row,
            tenantId,
            userId,
            externalIdToInternalId,
          );
          if (initiative) {
            externalIdToInternalId.set(row.externalId, initiative.id);
            if (wasUpdate) {
              result.initiativesUpdated++;
            } else {
              result.initiativesCreated++;
            }
          }
        } catch (error) {
          result.success = false;
          const originalIndex = deliverables.findIndex(d => d.externalId === deliverables[i].externalId);
          result.errors.push({
            row: objectives.length + keyResults.length + (originalIndex >= 0 ? originalIndex : i) + 2,
            externalId: deliverables[i].externalId,
            title: deliverables[i].title,
            error: error instanceof Error ? error.message : String(error),
          });
          this.logger.error(`Error importing deliverable/initiative ${deliverables[i].externalId}: ${error}`);
        }
      }
    }

    return result;
  }

  /**
   * Import OKRs from Viva Goals JSON content
   */
  async importFromJSON(
    jsonContent: string,
    tenantId: string,
    userId: string,
  ): Promise<ImportResult> {
    OkrTenantGuard.assertCanMutateTenant(tenantId);

    // Parse JSON
    const parsedRows = this.jsonParser.parseObjectives(jsonContent);
    if (parsedRows.length === 0) {
      throw new BadRequestException('JSON file is empty or invalid');
    }

    // Convert JSON format to CSV format for reuse of existing import logic
    const csvFormatRows: ParsedVivaGoalsRow[] = parsedRows.map(row =>
      this.convertJSONRowToCSVRow(row)
    );

    const result: ImportResult = {
      success: true,
      objectivesCreated: 0,
      objectivesUpdated: 0,
      keyResultsCreated: 0,
      keyResultsUpdated: 0,
      initiativesCreated: 0,
      initiativesUpdated: 0,
      errors: [],
      warnings: [],
    };

    // Separate Objectives, Key Results, and Deliverables
    const objectives = csvFormatRows.filter(r => r.objectType === 'Objective');
    const keyResults = csvFormatRows.filter(r => r.objectType === 'Key result');
    const deliverables = csvFormatRows.filter(r => r.objectType === 'Deliverable');

    // Build external ID to internal ID mapping for parent lookups (used for deliverables too)
    const externalIdToInternalId = new Map<string, string>();

    // Phase 1: Import all Objectives WITHOUT parent relationships
    // This ensures all objectives exist before we try to link them
    for (let i = 0; i < objectives.length; i++) {
      const row = objectives[i];
      try {
        const wasUpdate = await this.isObjectiveExisting(row.externalId, tenantId);
        // Pass skipParentResolution=true to import without parent relationships
        const objective = await this.importObjective(row, tenantId, userId, externalIdToInternalId, true);
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
        const originalIndex = objectives.findIndex(o => o.externalId === row.externalId);
        result.errors.push({
          row: originalIndex >= 0 ? originalIndex + 1 : i + 1,
          externalId: row.externalId,
          title: row.title,
          error: error instanceof Error ? error.message : String(error),
        });
        this.logger.error(`Error importing objective ${row.externalId}: ${error}`);
      }
    }

    // Phase 2: Update all Objectives to establish parent relationships
    // Now that all objectives exist, we can safely link them
    this.logger.log(`Establishing parent-child relationships for ${objectives.length} objectives...`);
    let relationshipsEstablished = 0;
    for (const row of objectives) {
      if (row.parentExternalId) {
        try {
          const childObjectiveId = externalIdToInternalId.get(row.externalId);
          const parentObjectiveId = externalIdToInternalId.get(row.parentExternalId);
          
          if (childObjectiveId && parentObjectiveId) {
            // Both exist - establish relationship
            await this.prisma.objective.update({
              where: { id: childObjectiveId },
              data: { parentId: parentObjectiveId },
            });
            relationshipsEstablished++;
          } else if (childObjectiveId && !parentObjectiveId) {
            // Parent might exist in database from previous import
            const parent = await this.prisma.objective.findFirst({
              where: {
                tenantId,
                source: this.SOURCE,
                externalId: row.parentExternalId,
              },
            });
            if (parent) {
              await this.prisma.objective.update({
                where: { id: childObjectiveId },
                data: { parentId: parent.id },
              });
              relationshipsEstablished++;
            } else {
              this.logger.warn(
                `Parent objective with externalId ${row.parentExternalId} not found for "${row.title}" - skipping parent relationship`,
              );
            }
          }
        } catch (error) {
          this.logger.warn(
            `Failed to establish parent relationship for objective "${row.title}": ${(error as Error).message}`,
          );
        }
      }
    }
    this.logger.log(`Established ${relationshipsEstablished} parent-child relationships`);

    // Topologically sort Key Results to ensure parent KRs are imported before child KRs
    const sortedKeyResults = this.topologicalSortKeyResults(keyResults, objectives);

    if (sortedKeyResults.length !== keyResults.length) {
      result.warnings.push(
        `Some key results could not be sorted (circular dependencies or missing parents) - importing in original order`,
      );
      sortedKeyResults.length = 0;
      sortedKeyResults.push(...keyResults);
    }

    // Process Key Results in topological order
    for (let i = 0; i < sortedKeyResults.length; i++) {
      try {
        const row = sortedKeyResults[i];
        const wasUpdate = await this.isKeyResultExisting(row.externalId, tenantId);
        const keyResult = await this.importKeyResult(
          row,
          tenantId,
          userId,
          externalIdToInternalId,
        );
        if (keyResult) {
          // Add KR to mapping for nested KR support
          externalIdToInternalId.set(row.externalId, keyResult.id);
          if (wasUpdate) {
            result.keyResultsUpdated++;
          } else {
            result.keyResultsCreated++;
          }
        }
      } catch (error) {
        result.success = false;
        const originalIndex = keyResults.findIndex(kr => kr.externalId === sortedKeyResults[i].externalId);
        result.errors.push({
          row: objectives.length + (originalIndex >= 0 ? originalIndex : i) + 1,
          externalId: sortedKeyResults[i].externalId,
          title: sortedKeyResults[i].title,
          error: error instanceof Error ? error.message : String(error),
        });
        this.logger.error(`Error importing key result ${sortedKeyResults[i].externalId}: ${error}`);
      }
    }

    // Process Deliverables as Initiatives (after objectives and key results are imported)
    if (deliverables.length > 0) {
      for (let i = 0; i < deliverables.length; i++) {
        try {
          const row = deliverables[i];
          const wasUpdate = await this.isInitiativeExisting(row.externalId, tenantId);
          const initiative = await this.importInitiative(
            row,
            tenantId,
            userId,
            externalIdToInternalId,
          );
          if (initiative) {
            externalIdToInternalId.set(row.externalId, initiative.id);
            if (wasUpdate) {
              result.initiativesUpdated++;
            } else {
              result.initiativesCreated++;
            }
          }
        } catch (error) {
          result.success = false;
          const originalIndex = deliverables.findIndex(d => d.externalId === deliverables[i].externalId);
          result.errors.push({
            row: objectives.length + keyResults.length + (originalIndex >= 0 ? originalIndex : i) + 1,
            externalId: deliverables[i].externalId,
            title: deliverables[i].title,
            error: error instanceof Error ? error.message : String(error),
          });
          this.logger.error(`Error importing deliverable/initiative ${deliverables[i].externalId}: ${error}`);
        }
      }
    }

    return result;
  }

  /**
   * Convert ParsedVivaGoalsJSONRow to ParsedVivaGoalsRow format
   */
  private convertJSONRowToCSVRow(jsonRow: ParsedVivaGoalsJSONRow): ParsedVivaGoalsRow {
    // Extract parent info from alignment or parentIds
    let parentExternalId: string | null = null;
    let parentTitle: string | null = null;
    let parentWeight: number | null = null;

    if (jsonRow.parentIds && jsonRow.parentIds.length > 0) {
      const firstParentId = jsonRow.parentIds[0];
      parentExternalId = String(firstParentId);
      // Try to find title from alignment
      if (jsonRow.alignment) {
        const parentAlignment = jsonRow.alignment.find(a => a.id === firstParentId);
        if (parentAlignment) {
          parentTitle = parentAlignment.title;
          parentWeight = parentAlignment.weight;
        }
      }
    }

    // Convert owners array to names array
    const ownerNames = jsonRow.owners.map(o => o.name);
    const creatorName = jsonRow.creator?.name || null;

    // Get first team name
    const teamName = jsonRow.teams.length > 0 ? jsonRow.teams[0].name : null;

    // Get period name
    const periodName = jsonRow.timePeriod?.name || '';

    return {
      externalId: jsonRow.externalId,
      title: jsonRow.title,
      team: teamName,
      creator: creatorName,
      owners: ownerNames,
      period: periodName,
      startDate: jsonRow.startDate || '',
      endDate: jsonRow.endDate || '',
      description: jsonRow.description,
      alignedTo: jsonRow.alignment ? JSON.stringify(jsonRow.alignment) : null,
      parentTitle: parentTitle ?? null,
      parentWeight: parentWeight ?? null,
      parentExternalId: parentExternalId ?? null,
      metricName: jsonRow.metricName ?? null,
      unit: jsonRow.unit ?? null,
      target: jsonRow.target ?? null,
      objectType: jsonRow.type === 'Key result' ? 'Key result' : jsonRow.type === 'Deliverable' ? 'Deliverable' : 'Objective',
      goalType: jsonRow.goalType || 'Aspirational',
      start: jsonRow.start ?? null,
      createdAt: jsonRow.createdAt ?? null,
      lastCheckin: jsonRow.lastCheckin ?? null,
      // Handle Progress field correctly based on unit
      // When unit is "Number" or "Dollar", Progress is the currentValue, not a percentage
      // When unit is "Percentage", Progress might be currentValue or completion %
      progress: jsonRow.progress ?? null, // Store Progress field for calculateCurrentValue
      progressPercent: this.determineProgressPercent(jsonRow),
      actualProgress: jsonRow.actualProgress ?? null,
      status: jsonRow.status || 'On Track',
      lastCheckinNote: null,
      score: null,
      checkins: [], // Check-ins imported separately
      phasedTargets: jsonRow.phasedTargets || null,
    };
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
   * Topologically sort Objectives to ensure parents are imported before children
   * Uses Kahn's algorithm for topological sorting
   */
  private topologicalSortObjectives(
    objectives: ParsedVivaGoalsRow[],
  ): ParsedVivaGoalsRow[] {
    // Build a map of externalId -> objective for quick lookup
    const objectiveMap = new Map<string, ParsedVivaGoalsRow>();
    objectives.forEach(obj => {
      objectiveMap.set(obj.externalId, obj);
    });

    // Build adjacency list: child -> parent
    // And count in-degrees (number of dependencies)
    const inDegree = new Map<string, number>();
    const children = new Map<string, string[]>(); // parent -> children

    objectives.forEach(obj => {
      inDegree.set(obj.externalId, 0);
      children.set(obj.externalId, []);
    });

    // Build graph: for each objective with a parent, add edge
    objectives.forEach(obj => {
      if (obj.parentExternalId) {
        // Check if parent exists in current batch
        if (objectiveMap.has(obj.parentExternalId)) {
          const parentChildren = children.get(obj.parentExternalId) || [];
          parentChildren.push(obj.externalId);
          children.set(obj.parentExternalId, parentChildren);
          inDegree.set(obj.externalId, (inDegree.get(obj.externalId) || 0) + 1);
        }
        // If parent doesn't exist in batch, it might be in database (in-degree stays 0)
      }
    });

    // Kahn's algorithm: start with nodes that have no dependencies
    const queue: ParsedVivaGoalsRow[] = [];
    const sorted: ParsedVivaGoalsRow[] = [];
    const visited = new Set<string>();

    // Find all root nodes (no parent or parent not in batch)
    objectives.forEach(obj => {
      if ((inDegree.get(obj.externalId) || 0) === 0) {
        queue.push(obj);
        visited.add(obj.externalId);
      }
    });

    // Process queue
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      // Process children
      const currentChildren = children.get(current.externalId) || [];
      for (const childId of currentChildren) {
        const currentInDegree = (inDegree.get(childId) || 0) - 1;
        inDegree.set(childId, currentInDegree);

        if (currentInDegree === 0 && !visited.has(childId)) {
          const childObj = objectiveMap.get(childId);
          if (childObj) {
            queue.push(childObj);
            visited.add(childId);
          }
        }
      }
    }

    // Add any remaining objectives (circular dependencies or disconnected)
    objectives.forEach(obj => {
      if (!visited.has(obj.externalId)) {
        sorted.push(obj);
      }
    });

    return sorted;
  }

  /**
   * Topologically sort Key Results to ensure parent KRs are imported before child KRs.
   * This handles nested KR hierarchies (Viva Goals pattern).
   */
  private topologicalSortKeyResults(
    keyResults: ParsedVivaGoalsRow[],
    _objectives?: ParsedVivaGoalsRow[],
  ): ParsedVivaGoalsRow[] {
    // Build sets for quick lookup
    const krExternalIds = new Set(keyResults.map(kr => kr.externalId));
    const krMap = new Map<string, ParsedVivaGoalsRow>();
    keyResults.forEach(kr => krMap.set(kr.externalId, kr));

    // Build adjacency list: child -> parent
    const inDegree = new Map<string, number>();
    const children = new Map<string, string[]>(); // parent -> children

    keyResults.forEach(kr => {
      inDegree.set(kr.externalId, 0);
      children.set(kr.externalId, []);
    });

    // Build graph: for each KR with a parent KR, add edge
    keyResults.forEach(kr => {
      if (kr.parentExternalId && krExternalIds.has(kr.parentExternalId)) {
        // Parent is another KR in current batch
        const parentChildren = children.get(kr.parentExternalId) || [];
        parentChildren.push(kr.externalId);
        children.set(kr.parentExternalId, parentChildren);
        inDegree.set(kr.externalId, (inDegree.get(kr.externalId) || 0) + 1);
      }
      // If parent is an Objective or external, in-degree stays 0
    });

    // Kahn's algorithm
    const queue: ParsedVivaGoalsRow[] = [];
    const sorted: ParsedVivaGoalsRow[] = [];
    const visited = new Set<string>();

    // Find all root KRs (parent is an Objective or not in batch)
    keyResults.forEach(kr => {
      if ((inDegree.get(kr.externalId) || 0) === 0) {
        queue.push(kr);
        visited.add(kr.externalId);
      }
    });

    // Process queue
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      const currentChildren = children.get(current.externalId) || [];
      for (const childId of currentChildren) {
        const currentInDegree = (inDegree.get(childId) || 0) - 1;
        inDegree.set(childId, currentInDegree);

        if (currentInDegree === 0 && !visited.has(childId)) {
          const childKr = krMap.get(childId);
          if (childKr) {
            queue.push(childKr);
            visited.add(childId);
          }
        }
      }
    }

    // Add any remaining KRs (circular dependencies or disconnected)
    keyResults.forEach(kr => {
      if (!visited.has(kr.externalId)) {
        sorted.push(kr);
      }
    });

    return sorted;
  }

  /**
   * Import a single Objective
   * @param skipParentResolution - If true, skip parent resolution and set parentId to null
   */
  private async importObjective(
    row: ParsedVivaGoalsRow,
    tenantId: string,
    userId: string,
    externalIdToInternalId: Map<string, string>,
    skipParentResolution: boolean = false,
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
    // Skip parent resolution if skipParentResolution=true (for two-phase import)
    let parentId: string | null = null;
    if (!skipParentResolution && row.parentExternalId) {
      // Check if parent was imported in current batch
      if (externalIdToInternalId.has(row.parentExternalId)) {
        parentId = externalIdToInternalId.get(row.parentExternalId)!;
      } else {
        // Check database for previously imported parent
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
          // Parent not found - will be resolved in Phase 2
          this.logger.debug(
            `Parent objective with externalId ${row.parentExternalId} not found for "${row.title}" - will resolve in Phase 2`,
          );
        }
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

    // Build metadata object with all Viva Goals data not yet in dedicated fields
    const metadata = this.buildObjectiveMetadata(row);

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
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    let objective;
    if (existing) {
      // Update existing
      objective = await this.prisma.objective.update({
        where: { id: existing.id },
        data: {
          ...data,
          // Don't update importedAt/importedBy on update
          importedAt: existing.importedAt,
          importedBy: existing.importedBy,
        },
      });
      // Note: objectivesUpdated is tracked in the calling method
    } else {
      // Create new
      objective = await this.prisma.objective.create({ data });
    }

    // Add additional owners (for both new and updated records)
    // Viva Goals supports multiple owners - add them as additional owners
    if (row.owners.length > 1) {
      for (let i = 1; i < row.owners.length; i++) {
        const additionalOwnerId = await this.resolveUserNameToUserId(
          row.owners[i],
          tenantId,
        );
        if (additionalOwnerId && additionalOwnerId !== ownerId) {
          try {
            // Check if already an owner
            const isOwner = await this.objectiveOwnerService.isOwner(
              objective.id,
              additionalOwnerId,
              tenantId,
            );

            if (!isOwner) {
              // Add as additional owner
              await this.objectiveOwnerService.addOwner(
                objective.id,
                additionalOwnerId,
                tenantId,
                userId,
              );
            }
          } catch (error) {
            // Log warning but don't fail import if owner can't be added
            this.logger.warn(
              `Could not add additional owner "${row.owners[i]}" to objective "${row.title}": ${(error as Error).message}`,
            );
          }
        }
      }
    }

    // Import phased targets if present
    if (row.phasedTargets && row.phasedTargets.targets && row.phasedTargets.targets.length > 0) {
      try {
        // Map interval from Viva Goals format to Prisma enum
        const intervalMap: Record<string, PhasedTargetInterval> = {
          'monthly': 'MONTHLY',
          'quarterly': 'QUARTERLY',
          'custom': 'CUSTOM',
        };
        const interval = intervalMap[row.phasedTargets.interval?.toLowerCase()] || 'CUSTOM';

        // Create phased targets
        for (let i = 0; i < row.phasedTargets.targets.length; i++) {
          const target = row.phasedTargets.targets[i];
          try {
            await this.phasedTargetService.create(
              {
                objectiveId: objective.id,
                interval,
                targetValue: target.targetValue,
                targetDate: target.targetDate,
                order: i + 1,
              },
              tenantId,
            );
          } catch (error) {
            // Log warning but don't fail import if phased target can't be created
            this.logger.warn(
              `Could not create phased target ${i + 1} for objective "${row.title}": ${(error as Error).message}`,
            );
          }
        }
      } catch (error) {
        // Log warning but don't fail import
        this.logger.warn(
          `Could not import phased targets for objective "${row.title}": ${(error as Error).message}`,
        );
      }
    }

    return objective;
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

    // Resolve parent - can be either an Objective or another Key Result (nested KRs)
    let objectiveId: string | null = null;
    let parentKeyResultId: string | null = null;
    let weight: number = 1.0;

    if (row.parentExternalId) {
      // First, check if parent is a Key Result (nested KR pattern from Viva Goals)
      const parentKeyResult = await this.prisma.keyResult.findFirst({
        where: {
          tenantId,
          source: this.SOURCE,
          externalId: row.parentExternalId,
        },
      });

      if (parentKeyResult) {
        // Parent is a Key Result - this is a nested KR
        parentKeyResultId = parentKeyResult.id;
        this.logger.log(`Key result "${row.title}" is a child of parent KR "${parentKeyResult.title}"`);
      } else if (externalIdToInternalId.has(row.parentExternalId)) {
        // Check mapping - could be either Objective or KR from current batch
        const parentInternalId = externalIdToInternalId.get(row.parentExternalId)!;

        // Check if it's an Objective
        const parentObjective = await this.prisma.objective.findUnique({
          where: { id: parentInternalId },
        });

        if (parentObjective) {
          objectiveId = parentInternalId;
        } else {
          // Must be a Key Result from current batch
          parentKeyResultId = parentInternalId;
        }
      } else {
        // Try to find by externalId in Objectives
        const parentObjective = await this.prisma.objective.findFirst({
          where: {
            tenantId,
            source: this.SOURCE,
            externalId: row.parentExternalId,
          },
        });

        if (parentObjective) {
          objectiveId = parentObjective.id;
        } else {
          // Parent not found - this is an orphan key result
          this.logger.warn(
            `Parent not found for key result ${row.externalId} ("${row.title}") - parentExternalId: ${row.parentExternalId}. Skipping.`,
          );
          return null; // Skip orphan KRs instead of throwing
        }
      }

      // Convert weight percentage to decimal (0-100% -> 0.0-1.0)
      if (row.parentWeight !== null) {
        weight = row.parentWeight / 100.0;
      }
    } else {
      // No parent specified - this is a standalone key result
      // In some cases this might be valid (top-level KRs), but log a warning
      this.logger.warn(
        `Key result "${row.title}" has no parent specified. Creating as standalone.`,
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

    // Infer metric type (use targetType from JSON if available)
    const metricType = this.inferMetricType(
      row.start || 0,
      row.target || 100,
      row.unit,
      (row as any).targetType, // VivaGoals Target Type
    );

    // Calculate current value from actual progress percentage or Progress field
    // For JSON imports, Progress field might be the currentValue when unit is "Number" or "Dollar"
    const currentValue = this.calculateCurrentValue(
      row.start || 0,
      row.target || 100,
      row.actualProgress,
      row.unit,
      row.progress ?? null, // Pass Progress field for JSON imports
    );

    // Parse dates
    const startDate = row.startDate ? new Date(row.startDate) : null;
    const endDate = row.endDate ? new Date(row.endDate) : null;

    // Build metadata object with all Viva Goals data not yet in dedicated fields
    const metadata = this.buildKeyResultMetadata(row);

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
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      // Nested KR support
      parentKeyResultId,
      weight,
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

    // Add additional owners (for both new and updated records)
    // Viva Goals supports multiple owners - add them as additional owners
    if (row.owners.length > 1) {
      for (let i = 1; i < row.owners.length; i++) {
        const additionalOwnerId = await this.resolveUserNameToUserId(
          row.owners[i],
          tenantId,
        );
        if (additionalOwnerId && additionalOwnerId !== ownerId) {
          try {
            // Check if already an owner
            const isOwner = await this.keyResultOwnerService.isOwner(
              keyResult.id,
              additionalOwnerId,
              tenantId,
            );

            if (!isOwner) {
              // Add as additional owner
              await this.keyResultOwnerService.addOwner(
                keyResult.id,
                additionalOwnerId,
                tenantId,
                userId,
              );
            }
          } catch (error) {
            // Log warning but don't fail import if owner can't be added
            this.logger.warn(
              `Could not add additional owner "${row.owners[i]}" to key result "${row.title}": ${(error as Error).message}`,
            );
          }
        }
      }
    }

    // Import phased targets if present
    if (row.phasedTargets && row.phasedTargets.targets && row.phasedTargets.targets.length > 0) {
      try {
        // Map interval from Viva Goals format to Prisma enum
        const intervalMap: Record<string, PhasedTargetInterval> = {
          'monthly': 'MONTHLY',
          'quarterly': 'QUARTERLY',
          'custom': 'CUSTOM',
        };
        const interval = intervalMap[row.phasedTargets.interval?.toLowerCase()] || 'CUSTOM';

        // Create phased targets
        for (let i = 0; i < row.phasedTargets.targets.length; i++) {
          const target = row.phasedTargets.targets[i];
          try {
            await this.phasedTargetService.create(
              {
                keyResultId: keyResult.id,
                interval,
                targetValue: target.targetValue,
                targetDate: target.targetDate,
                order: i + 1,
              },
              tenantId,
            );
          } catch (error) {
            // Log warning but don't fail import if phased target can't be created
            this.logger.warn(
              `Could not create phased target ${i + 1} for key result "${row.title}": ${(error as Error).message}`,
            );
          }
        }
      } catch (error) {
        // Log warning but don't fail import
        this.logger.warn(
          `Could not import phased targets for key result "${row.title}": ${(error as Error).message}`,
        );
      }
    }

    // Import historical check-ins
    if (row.checkins && row.checkins.length > 0) {
      await this.importCheckIns(keyResult.id, row.checkins, tenantId);
    }

    return keyResult;
  }

  /**
   * Check if initiative already exists
   */
  private async isInitiativeExisting(
    externalId: string,
    tenantId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.initiative.findFirst({
      where: {
        tenantId,
        source: this.SOURCE,
        externalId,
      },
    });
    return !!existing;
  }

  /**
   * Import a single Deliverable as an Initiative
   */
  private async importInitiative(
    row: ParsedVivaGoalsRow,
    tenantId: string,
    userId: string,
    externalIdToInternalId: Map<string, string>,
  ): Promise<any> {
    // Check if already imported
    const existing = await this.prisma.initiative.findFirst({
      where: {
        tenantId,
        source: this.SOURCE,
        externalId: row.externalId,
      },
    });

    // Resolve owner
    const ownerId = await this.resolveUserNameToUserId(
      row.owners[0] || row.creator || null,
      tenantId,
    );
    if (!ownerId) {
      throw new BadRequestException(
        `Could not resolve owner for initiative "${row.title}"`,
      );
    }

    // Resolve parent - can be either an Objective or a Key Result
    let objectiveId: string | null = null;
    let keyResultId: string | null = null;

    if (row.parentExternalId) {
      // Check if parent is in the mapping (from current batch)
      if (externalIdToInternalId.has(row.parentExternalId)) {
        const parentInternalId = externalIdToInternalId.get(row.parentExternalId)!;

        // Check if it's an Objective
        const parentObjective = await this.prisma.objective.findUnique({
          where: { id: parentInternalId },
        });

        if (parentObjective) {
          objectiveId = parentInternalId;
        } else {
          // Must be a Key Result
          const parentKeyResult = await this.prisma.keyResult.findUnique({
            where: { id: parentInternalId },
          });
          if (parentKeyResult) {
            keyResultId = parentInternalId;
          }
        }
      } else {
        // Try to find by externalId in existing data
        const parentObjective = await this.prisma.objective.findFirst({
          where: {
            tenantId,
            source: this.SOURCE,
            externalId: row.parentExternalId,
          },
        });

        if (parentObjective) {
          objectiveId = parentObjective.id;
        } else {
          const parentKeyResult = await this.prisma.keyResult.findFirst({
            where: {
              tenantId,
              source: this.SOURCE,
              externalId: row.parentExternalId,
            },
          });
          if (parentKeyResult) {
            keyResultId = parentKeyResult.id;
          }
        }
      }
    }

    // Map status from Viva Goals to InitiativeStatus
    const statusMap: Record<string, InitiativeStatus> = {
      'On Track': 'IN_PROGRESS',
      'At Risk': 'IN_PROGRESS',
      'Off Track': 'BLOCKED',
      'Completed': 'COMPLETED',
      'Not Started': 'NOT_STARTED',
      'IN_PROGRESS': 'IN_PROGRESS',
      'COMPLETED': 'COMPLETED',
      'BLOCKED': 'BLOCKED',
      'NOT_STARTED': 'NOT_STARTED',
    };
    const status = statusMap[row.status || 'Not Started'] || 'NOT_STARTED';

    // Map goal type
    const goalType = row.goalType === 'Committed Goal' ? GoalType.COMMITTED : GoalType.ASPIRATIONAL;

    // Resolve cycle from parent if available
    let cycleId: string | null = null;
    if (objectiveId) {
      const objective = await this.prisma.objective.findUnique({
        where: { id: objectiveId },
        select: { cycleId: true },
      });
      cycleId = objective?.cycleId || null;
    } else if (keyResultId) {
      // Get cycle from key result's objective
      const keyResult = await this.prisma.keyResult.findUnique({
        where: { id: keyResultId },
        include: {
          objectives: {
            take: 1,
            select: { objective: { select: { cycleId: true } } },
          },
        },
      });
      cycleId = keyResult?.objectives[0]?.objective?.cycleId || null;
    }

    // Resolve team
    let teamId: string | null = null;
    if (row.team) {
      teamId = await this.resolveTeamNameToTeamId(row.team, tenantId);
    }

    const initiativeData: any = {
      title: row.title,
      description: row.description || null,
      ownerId,
      tenantId,
      status,
      goalType,
      source: this.SOURCE,
      externalId: row.externalId,
      objectiveId: objectiveId || null,
      keyResultId: keyResultId || null,
      cycleId,
      teamId,
      progress: row.progressPercent !== null && row.progressPercent !== undefined ? row.progressPercent : null,
      startDate: row.startDate ? new Date(row.startDate) : null,
      endDate: row.endDate ? new Date(row.endDate) : null,
      createdBy: userId,
    };

    if (existing) {
      // Update existing initiative
      const updated = await this.prisma.initiative.update({
        where: { id: existing.id },
        data: initiativeData,
      });
      return updated;
    } else {
      // Create new initiative
      const created = await this.initiativeService.create(initiativeData, userId, tenantId);
      return created;
    }
  }

  /**
   * Resolve user name to User ID (exact match)
   */
  /**
   * Resolve user name to User ID (exact match, case-insensitive)
   * Auto-creates user if not found with email firstname.lastname@puzzel.com
   */
  private async resolveUserNameToUserId(
    name: string | null,
    tenantId: string,
  ): Promise<string | null> {
    if (!name || !name.trim()) {
      return null;
    }

    const trimmedName = name.trim();

    // Try exact match first
    const user = await this.prisma.user.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        primaryOrganizationId: tenantId,
      },
    });

    if (user) {
      return user.id;
    }

    // User not found - create one with generated email
    try {
      const email = this.generateEmailFromName(trimmedName);

      // Check if user with this email already exists (might be in different tenant)
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingByEmail) {
        // User exists but not in this tenant - update primaryOrganizationId and create role assignment
        await this.prisma.$transaction(async (tx) => {
          // Update primary organization
          await tx.user.update({
            where: { id: existingByEmail.id },
            data: {
              primaryOrganizationId: tenantId,
            },
          });

          // Check if role assignment already exists
          const existingAssignment = await tx.roleAssignment.findFirst({
            where: {
              userId: existingByEmail.id,
              scopeType: 'TENANT',
              scopeId: tenantId,
            },
          });

          // Create role assignment if it doesn't exist
          if (!existingAssignment) {
            await tx.roleAssignment.create({
              data: {
                userId: existingByEmail.id,
                role: 'TENANT_VIEWER',
                scopeType: 'TENANT',
                scopeId: tenantId,
              },
            });
            this.logger.log(`Created role assignment for user ${email} in tenant ${tenantId}`);
          }
        });
        this.logger.log(`Updated user ${email} to tenant ${tenantId}`);
        return existingByEmail.id;
      }

      // Create new user with role assignment
      // Use environment variable for default password - ensures no hardcoded passwords
      const defaultPassword = process.env.DEFAULT_PASSWORD || process.env.IMPORT_DEFAULT_PASSWORD;
      if (!defaultPassword || defaultPassword.trim() === '') {
        throw new Error(
          'DEFAULT_PASSWORD or IMPORT_DEFAULT_PASSWORD environment variable is not set. ' +
          'Please set one of these in your environment variables or .env file. ' +
          'This is used for creating users during import.',
        );
      }
      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      const newUser = await this.prisma.$transaction(async (tx) => {
        // Create user
        const user = await tx.user.create({
          data: {
            email,
            name: trimmedName,
            passwordHash,
            primaryOrganizationId: tenantId,
          },
        });

        // Create tenant role assignment so user appears in UI
        // Default to TENANT_VIEWER role for imported users (can be upgraded later)
        await tx.roleAssignment.create({
          data: {
            userId: user.id,
            role: 'TENANT_VIEWER', // RBAC role - users can be upgraded to TENANT_ADMIN later
            scopeType: 'TENANT',
            scopeId: tenantId,
          },
        });

        return user;
      });

      this.logger.log(`Auto-created user "${trimmedName}" with email ${email} for tenant ${tenantId} with TENANT_VIEWER role`);
      return newUser.id;
    } catch (error) {
      this.logger.error(`Failed to create user "${trimmedName}": ${error}`);
      return null;
    }
  }

  /**
   * Generate email from name: firstname.lastname@puzzel.com
   * Handles various name formats:
   * - "Matt Hughes" -> "matt.hughes@puzzel.com"
   * - "John Doe" -> "john.doe@puzzel.com"
   * - "Mary Jane Smith" -> "mary.jane@puzzel.com" (uses first two parts)
   */
  private generateEmailFromName(name: string): string {
    // Split name into parts and clean them
    const parts = name
      .split(/\s+/)
      .map(part => part.trim())
      .filter(part => part.length > 0)
      .map(part => part.toLowerCase().replace(/[^a-z0-9]/g, '')); // Remove non-alphanumeric

    if (parts.length === 0) {
      // Fallback if name is empty or invalid
      return `user.${Date.now()}@puzzel.com`;
    }

    if (parts.length === 1) {
      // Single name - use it for both first and last
      return `${parts[0]}.${parts[0]}@puzzel.com`;
    }

    // Multiple parts - use first two parts
    const firstName = parts[0];
    const lastName = parts.slice(1).join(''); // Join remaining parts

    return `${firstName}.${lastName}@puzzel.com`;
  }

  /**
   * Resolve team name to Team ID (exact match, takes first if semicolon-separated)
   * Auto-creates team if not found
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

    // Find team by name within tenant's workspaces
    const workspace = await this.getOrCreateDefaultWorkspace(tenantId);
    if (!workspace) {
      this.logger.warn(`Could not get/create workspace for tenant ${tenantId}`);
      return null;
    }

    const team = await this.prisma.team.findFirst({
      where: {
        name: {
          equals: firstTeam,
          mode: 'insensitive',
        },
        workspaceId: workspace.id,
      },
    });

    if (team) {
      return team.id;
    }

    // Auto-create team if not found
    try {
      const newTeam = await this.prisma.team.create({
        data: {
          name: firstTeam,
          workspaceId: workspace.id,
        },
      });
      this.logger.log(`Auto-created team "${firstTeam}" in workspace ${workspace.id}`);
      return newTeam.id;
    } catch (error) {
      this.logger.error(`Failed to create team "${firstTeam}": ${error}`);
      return null;
    }
  }

  /**
   * Get or create default workspace for tenant
   */
  private async getOrCreateDefaultWorkspace(tenantId: string): Promise<any | null> {
    // Try to find existing workspace
    const existing = await this.prisma.workspace.findFirst({
      where: {
        tenantId,
      },
      orderBy: {
        createdAt: 'asc', // Get oldest workspace (likely default)
      },
    });

    if (existing) {
      return existing;
    }

    // Create default workspace
    try {
      const workspace = await this.prisma.workspace.create({
        data: {
          tenantId,
          name: 'Default Workspace',
        },
      });
      this.logger.log(`Created default workspace for tenant ${tenantId}`);
      return workspace;
    } catch (error) {
      this.logger.error(`Failed to create default workspace: ${error}`);
      return null;
    }
  }

  /**
   * Resolve or create Cycle from period name
   * Priority: 1. Exact name match, 2. Name match with similar dates, 3. Create new
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

    const trimmedName = periodName.trim();

    // First: Try to find existing cycle by exact name match (case-insensitive)
    const existingByName = await this.prisma.cycle.findFirst({
      where: {
        tenantId,
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
      },
    });

    if (existingByName) {
      return existingByName.id;
    }

    // Second: Try normalized name matching (e.g., "Q1 2024" matches "Q1 2024")
    // Handle variations like "Q1 2024", "Q1-2024", "2024 Q1"
    const normalizedName = this.normalizePeriodName(trimmedName);
    if (normalizedName !== trimmedName) {
      const existingByNormalized = await this.prisma.cycle.findFirst({
        where: {
          tenantId,
          name: {
            equals: normalizedName,
            mode: 'insensitive',
          },
        },
      });
      if (existingByNormalized) {
        return existingByNormalized.id;
      }
    }

    // Third: Try to find by date range (within same quarter/year)
    const existingByDates = await this.prisma.cycle.findFirst({
      where: {
        tenantId,
        startDate: {
          gte: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000), // Within 7 days
          lte: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
        endDate: {
          gte: new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000),
          lte: new Date(endDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    if (existingByDates) {
      return existingByDates.id;
    }

    // Create new cycle (directly, bypassing validation for imports)
    try {
      // Determine status based on dates
      const now = new Date();
      let status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' = 'DRAFT';
      if (endDate < now) {
        status = 'ARCHIVED';
      } else if (startDate <= now && endDate >= now) {
        status = 'ACTIVE';
      }

      const cycle = await this.prisma.cycle.create({
        data: {
          tenantId,
          name: trimmedName,
          startDate,
          endDate,
          status,
          isStandard: false,
        },
      });
      this.logger.log(`Created cycle "${trimmedName}" for import`);
      return cycle.id;
    } catch (error) {
      this.logger.warn(
        `Failed to create cycle "${periodName}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Normalize period name to standard format
   * E.g., "Q1-2024" -> "Q1 2024", "2024 Q1" -> "Q1 2024"
   */
  private normalizePeriodName(name: string): string {
    // Match quarter patterns
    const quarterMatch = name.match(/Q([1-4])[\s\-]*(\d{4})|(\d{4})[\s\-]*Q([1-4])/i);
    if (quarterMatch) {
      const quarter = quarterMatch[1] || quarterMatch[4];
      const year = quarterMatch[2] || quarterMatch[3];
      return `Q${quarter} ${year}`;
    }

    // Match annual patterns
    const annualMatch = name.match(/Annual[\s\-]*(\d{4})|(\d{4})[\s\-]*Annual/i);
    if (annualMatch) {
      const year = annualMatch[1] || annualMatch[2];
      return `Annual ${year}`;
    }

    // Match half patterns
    const halfMatch = name.match(/H([1-2])[\s\-]*(\d{4})|(\d{4})[\s\-]*H([1-2])/i);
    if (halfMatch) {
      const half = halfMatch[1] || halfMatch[4];
      const year = halfMatch[2] || halfMatch[3];
      return `H${half} ${year}`;
    }

    return name;
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
  /**
   * Build metadata object for Objective from parsed Viva Goals row
   */
  private buildObjectiveMetadata(row: ParsedVivaGoalsRow): Record<string, any> {
    const metadata: Record<string, any> = {};
    const jsonRow = row as any; // Cast to access additional fields

    // Store phased targets in metadata (until Ticket 1 is implemented)
    if (jsonRow.phasedTargets) {
      metadata.phasedTargets = jsonRow.phasedTargets;
    }

    // Store delegation in metadata (until Ticket 3 is implemented)
    if (jsonRow.delegatedTo) {
      metadata.delegatedTo = jsonRow.delegatedTo;
    }

    // Store check-in owners in metadata (until Ticket 4 is implemented)
    if (jsonRow.checkInOwners && jsonRow.checkInOwners.length > 0) {
      metadata.checkInOwners = jsonRow.checkInOwners;
    }

    // Store permissions in metadata (until Ticket 2 is implemented)
    if (jsonRow.permissions) {
      metadata.permissions = jsonRow.permissions;
    }

    // Store progress config in metadata (until Ticket 5 is implemented)
    if (jsonRow.progressConfig) {
      metadata.progressConfig = jsonRow.progressConfig;
    }

    // Store score in metadata
    if (jsonRow.score !== null && jsonRow.score !== undefined) {
      metadata.score = jsonRow.score;
    }

    // Store last check-in date (will migrate to lastCheckInAt field in Ticket 8)
    if (jsonRow.lastCheckin) {
      metadata.lastCheckIn = jsonRow.lastCheckin;
    }

    return metadata;
  }

  /**
   * Build metadata object for Key Result from parsed Viva Goals row
   */
  private buildKeyResultMetadata(row: ParsedVivaGoalsRow): Record<string, any> {
    const metadata: Record<string, any> = {};
    const jsonRow = row as any; // Cast to access additional fields

    // Store phased targets
    if (jsonRow.phasedTargets) {
      metadata.phasedTargets = jsonRow.phasedTargets;
    }

    // Store delegation
    if (jsonRow.delegatedTo) {
      metadata.delegatedTo = jsonRow.delegatedTo;
    }

    // Store check-in owners
    if (jsonRow.checkInOwners && jsonRow.checkInOwners.length > 0) {
      metadata.checkInOwners = jsonRow.checkInOwners;
    }

    // Store permissions
    if (jsonRow.permissions) {
      metadata.permissions = jsonRow.permissions;
    }

    // Store progress config
    if (jsonRow.progressConfig) {
      metadata.progressConfig = jsonRow.progressConfig;
    }

    // Store outcome details (for Ticket 6 enhancement)
    if (jsonRow.outcome) {
      metadata.outcome = jsonRow.outcome;
    }

    // Store metric name (will migrate to metricName field)
    if (jsonRow.metricName) {
      metadata.metricName = jsonRow.metricName;
    }

    // Store score
    if (jsonRow.score !== null && jsonRow.score !== undefined) {
      metadata.score = jsonRow.score;
    }

    // Store last check-in date
    if (jsonRow.lastCheckin) {
      metadata.lastCheckIn = jsonRow.lastCheckin;
    }

    return metadata;
  }

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
   * Infer metric type from Start/Target relationship or VivaGoals Target Type
   */
  private inferMetricType(
    start: number,
    target: number,
    unit: string | null,
    targetType?: string | null,
  ): MetricType {
    // Use VivaGoals Target Type if available (most accurate)
    if (targetType) {
      switch (targetType) {
        case 'Reach':
        case 'Find a baseline':
          return MetricType.REACH;
        case 'Increase From':
          return MetricType.INCREASE;
        case 'Decrease From':
          return MetricType.DECREASE;
        case 'Stay Above':
        case 'Stay Below':
          return MetricType.MAINTAIN;
        default:
          // Fall through to inference
          break;
      }
    }

    // Fallback: Infer from Start/Target relationship
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
   * Determine progress percentage from JSON row
   * Handles the fact that Progress field can be currentValue (for Number/Dollar units) or percentage
   */
  private determineProgressPercent(jsonRow: ParsedVivaGoalsJSONRow): number | null {
    // If explicit progressPercent exists, use it
    if (jsonRow.progressPercent !== null && jsonRow.progressPercent !== undefined) {
      return jsonRow.progressPercent;
    }

    // If Progress field exists and unit is "Number" or "Dollar", Progress is currentValue
    // Calculate percentage from currentValue/targetValue
    if (jsonRow.progress !== null && jsonRow.progress !== undefined && jsonRow.target !== null && jsonRow.target !== undefined) {
      const unit = jsonRow.unit?.toLowerCase() || '';

      // For Number or Dollar units, Progress is the currentValue
      if (unit === 'number' || unit === 'dollar') {
        if (jsonRow.target > 0) {
          return (jsonRow.progress / jsonRow.target) * 100;
        }
      }

      // For Percentage unit, Progress might be currentValue (0-100) or completion %
      // If it's > 100, it's likely completion %, otherwise it's currentValue
      if (unit === 'percentage') {
        if (jsonRow.progress > 100) {
          // It's completion percentage
          return jsonRow.progress;
        } else {
          // It's currentValue, calculate completion %
          if (jsonRow.target > 0) {
            return (jsonRow.progress / jsonRow.target) * 100;
          }
        }
      }
    }

    return null;
  }

  /**
   * Calculate current value from actual progress percentage or Progress field
   */
  private calculateCurrentValue(
    start: number,
    target: number,
    actualProgress: number | null,
    unit: string | null,
    progressValue?: number | null, // Progress field from JSON (might be currentValue)
  ): number {
    // If Progress field exists and unit is "Number" or "Dollar", use it as currentValue
    if (progressValue !== null && progressValue !== undefined) {
      const unitLower = unit?.toLowerCase() || '';
      if (unitLower === 'number' || unitLower === 'dollar') {
        return progressValue; // Progress IS the currentValue
      }
      // For Percentage unit, if Progress <= 100, it's currentValue
      if (unitLower === 'percentage' && progressValue <= 100) {
        return progressValue;
      }
    }

    // Fallback to actualProgress calculation
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

  /**
   * Import historical check-ins for a Key Result
   */
  private async importCheckIns(
    keyResultId: string,
    checkins: Array<{
      checkinDate: string;
      user: string;
      note: string | null;
      status: string | null;
      currentValue: number | null;
      activityDate: string;
    }>,
    tenantId: string,
  ): Promise<void> {
    for (const checkin of checkins) {
      try {
        // Resolve user
        const userId = await this.resolveUserNameToUserId(checkin.user, tenantId);
        if (!userId) {
          this.logger.warn(
            `Could not resolve user "${checkin.user}" for check-in on ${checkin.checkinDate}`,
          );
          continue;
        }

        // Parse check-in date (prefer activityDate if available, otherwise use checkinDate)
        const dateStr = checkin.activityDate || checkin.checkinDate;
        const checkinDate = new Date(dateStr);
        if (isNaN(checkinDate.getTime())) {
          this.logger.warn(`Invalid check-in date: ${dateStr}`);
          continue;
        }

        // Get key result to calculate value
        const keyResult = await this.prisma.keyResult.findUnique({
          where: { id: keyResultId },
          select: { startValue: true, targetValue: true, unit: true },
        });

        if (!keyResult) {
          continue;
        }

        // Calculate check-in value
        // If currentValue is percentage, convert to absolute
        let value: number;
        if (checkin.currentValue !== null) {
          if (keyResult.unit === '%') {
            // Convert percentage to absolute value
            value =
              keyResult.startValue +
              (checkin.currentValue / 100.0) *
              (keyResult.targetValue - keyResult.startValue);
          } else {
            // Use as absolute value
            value = checkin.currentValue;
          }
        } else {
          // Default to start value if no current value provided
          value = keyResult.startValue;
        }

        // Map confidence (default to 50 if not available)
        // Could be enhanced to infer from status or other factors
        const confidence = 50;

        // Check if check-in already exists (by date and user)
        const existing = await this.prisma.checkIn.findFirst({
          where: {
            keyResultId,
            userId,
            createdAt: {
              gte: new Date(checkinDate.getTime() - 24 * 60 * 60 * 1000), // Within 24 hours
              lte: new Date(checkinDate.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        });

        if (existing) {
          // Update existing check-in
          await this.prisma.checkIn.update({
            where: { id: existing.id },
            data: {
              value,
              confidence,
              note: checkin.note || null,
              blockers: null, // Viva Goals doesn't have blockers field
              createdAt: checkinDate, // Preserve original date
            },
          });
        } else {
          // Create new check-in
          await this.prisma.checkIn.create({
            data: {
              keyResultId,
              userId,
              value,
              confidence,
              note: checkin.note || null,
              blockers: null,
              createdAt: checkinDate, // Use original check-in date
            },
          });
        }
      } catch (error) {
        this.logger.error(
          `Error importing check-in for key result ${keyResultId}: ${error}`,
        );
        // Continue with next check-in
      }
    }
  }
}

