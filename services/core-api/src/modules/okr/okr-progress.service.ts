import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OKRStatus } from '@prisma/client';

/**
 * OKR Progress Service
 * 
 * Centralized service for calculating and rolling up Objective progress and status from Key Results.
 * This service exists to avoid circular dependencies between ObjectiveService and KeyResultService.
 * 
 * TODO [phase7-performance]: Add performance optimization with batch recalculation
 * TODO [phase7-hardening]: Add transaction support for atomic updates
 */
@Injectable()
export class OkrProgressService {
  constructor(private prisma: PrismaService) {}

  /**
   * Recalculate progress for a specific Objective from its child Key Results or child Objectives.
   * 
 * Calculation logic:
 * 1. If Objective has linked Key Results → weighted average of KR progress values (weight from ObjectiveKeyResult junction)
 * 2. Else if Objective has direct child Objectives → average of child Objective progress values
 * 3. Else → leave as-is (or 0 if brand new)
   * 
   * After updating, recursively cascades to parent Objective if one exists.
   * 
   * @param objectiveId - The Objective ID to recalculate
   */
  async recalculateObjectiveProgress(objectiveId: string): Promise<void> {
    // Load the objective with its relationships
    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      include: {
        keyResults: {
          select: {
            weight: true,
            keyResult: {
              select: {
                progress: true,
              },
            },
          },
        },
        children: {
          select: {
            id: true,
            progress: true,
          },
        },
        parent: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!objective) {
      return; // Objective doesn't exist, skip
    }

    let newProgress = objective.progress; // Default to current value

    // Priority 1: Calculate from linked Key Results (weighted average)
    if (objective.keyResults && objective.keyResults.length > 0) {
      // Filter valid progress values and extract weight
      const weightedKRs = objective.keyResults
        .map(objKr => ({
          progress: objKr.keyResult.progress,
          weight: objKr.weight ?? 1.0, // Default to 1.0 if weight is null/undefined
        }))
        .filter(kr => kr.progress !== null && kr.progress !== undefined && !isNaN(kr.progress));

      if (weightedKRs.length > 0) {
        // Calculate weighted average: sum(weight * progress) / sum(weight)
        const totalWeight = weightedKRs.reduce((acc, kr) => acc + kr.weight, 0);
        
        if (totalWeight > 0) {
          const weightedSum = weightedKRs.reduce((acc, kr) => acc + (kr.weight * kr.progress), 0);
          newProgress = weightedSum / totalWeight;
        } else {
          // Fallback to simple average if all weights are zero or negative
          const sum = weightedKRs.reduce((acc, kr) => acc + kr.progress, 0);
          newProgress = sum / weightedKRs.length;
        }
      }
    }
    // Priority 2: Calculate from child Objectives if no KRs
    else if (objective.children && objective.children.length > 0) {
      const childProgresses = objective.children
        .map(child => child.progress)
        .filter(progress => progress !== null && progress !== undefined && !isNaN(progress));

      if (childProgresses.length > 0) {
        const sum = childProgresses.reduce((acc, p) => acc + p, 0);
        newProgress = sum / childProgresses.length;
      }
    }
    // Priority 3: If no children or KRs, leave as-is (or set to 0 if brand new)
    else {
      newProgress = objective.progress || 0;
    }

    // Clamp progress to 0-100 range
    newProgress = Math.max(0, Math.min(100, newProgress));

    // Only update if progress actually changed (avoid unnecessary DB writes)
    if (Math.abs(newProgress - objective.progress) > 0.01) {
      await this.prisma.objective.update({
        where: { id: objectiveId },
        data: { progress: newProgress },
      });

      // Store progress snapshot for historical tracking
      await this.storeProgressSnapshot(objectiveId, newProgress, objective.status, 'PROGRESS_ROLLUP');
    }

    // Cascade to parent Objective if one exists
    if (objective.parent?.id) {
      await this.recalculateObjectiveProgress(objective.parent.id);
    }
  }

  /**
   * Refresh Objective progress when a Key Result's progress changes.
   * 
   * Finds all Objectives linked to this Key Result and recalculates their progress.
   * 
   * @param keyResultId - The Key Result ID that changed
   */
  async refreshObjectiveProgressForKeyResult(keyResultId: string): Promise<void> {
    // Find all Objectives linked to this Key Result
    const objectiveKeyResults = await this.prisma.objectiveKeyResult.findMany({
      where: { keyResultId },
      select: { objectiveId: true },
    });

    // Recalculate progress for each linked Objective
    for (const objKr of objectiveKeyResults) {
      await this.recalculateObjectiveProgress(objKr.objectiveId);
    }
  }

  /**
   * Refresh Objective progress and cascade upwards.
   * 
   * Convenience method that recalculates an Objective and cascades to parents.
   * 
   * @param objectiveId - The Objective ID to refresh
   */
  async refreshObjectiveProgressCascade(objectiveId: string): Promise<void> {
    await this.recalculateObjectiveProgress(objectiveId);
  }

  /**
   * Recalculate status for a specific Objective from its child Key Results or child Objectives.
   * 
   * Calculation logic:
   * 1. If Objective has linked Key Results → calculate status from KR statuses
   * 2. Else if Objective has direct child Objectives → calculate status from child Objective statuses
   * 3. Else → leave as-is
   * 
   * Status rules (in priority order):
   * - If any KR is OFF_TRACK → Objective should be AT_RISK (or OFF_TRACK if ≥50% are OFF_TRACK)
   * - If all KRs are COMPLETED → Objective should be COMPLETED
   * - If majority (≥50%) of KRs are AT_RISK → Objective should be AT_RISK
   * - If all KRs are ON_TRACK → Objective should be ON_TRACK
   * - If all KRs are CANCELLED → Objective should be CANCELLED
   * 
   * After updating, recursively cascades to parent Objective if one exists.
   * 
   * Note: This is an internal service method. Tenant security is enforced by the calling services.
   * 
   * @param objectiveId - The Objective ID to recalculate
   */
  async recalculateObjectiveStatus(objectiveId: string): Promise<void> {
    // Load the objective with its relationships
    const objective = await this.prisma.objective.findUnique({
      where: { id: objectiveId },
      include: {
        keyResults: {
          select: {
            keyResult: {
              select: {
                status: true,
              },
            },
          },
        },
        children: {
          select: {
            id: true,
            status: true,
          },
        },
        parent: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!objective) {
      return; // Objective doesn't exist, skip
    }

    let newStatus: OKRStatus = objective.status; // Default to current value

    // Priority 1: Calculate from linked Key Results
    if (objective.keyResults && objective.keyResults.length > 0) {
      const krStatuses = objective.keyResults
        .map(objKr => objKr.keyResult.status)
        .filter((status): status is OKRStatus => status !== null && status !== undefined);

      if (krStatuses.length > 0) {
        // Count statuses
        const statusCounts = {
          ON_TRACK: krStatuses.filter(s => s === 'ON_TRACK').length,
          AT_RISK: krStatuses.filter(s => s === 'AT_RISK').length,
          OFF_TRACK: krStatuses.filter(s => s === 'OFF_TRACK').length,
          COMPLETED: krStatuses.filter(s => s === 'COMPLETED').length,
          CANCELLED: krStatuses.filter(s => s === 'CANCELLED').length,
        };

        const totalKRs = krStatuses.length;

        // Rules (in priority order)
        if (statusCounts.OFF_TRACK > 0) {
          // If any KR is OFF_TRACK, Objective should be AT_RISK or OFF_TRACK
          // If ≥50% are OFF_TRACK, set to OFF_TRACK, otherwise AT_RISK
          newStatus = statusCounts.OFF_TRACK >= totalKRs / 2 ? 'OFF_TRACK' : 'AT_RISK';
        } else if (statusCounts.COMPLETED === totalKRs) {
          // If all KRs are COMPLETED, Objective should be COMPLETED
          newStatus = 'COMPLETED';
        } else if (statusCounts.CANCELLED === totalKRs) {
          // If all KRs are CANCELLED, Objective should be CANCELLED
          newStatus = 'CANCELLED';
        } else if (statusCounts.AT_RISK >= totalKRs / 2) {
          // If majority (≥50%) are AT_RISK, Objective should be AT_RISK
          newStatus = 'AT_RISK';
        } else if (statusCounts.ON_TRACK === totalKRs) {
          // If all KRs are ON_TRACK, Objective should be ON_TRACK
          newStatus = 'ON_TRACK';
        } else {
          // Mixed statuses: prioritize worst status
          // Priority: OFF_TRACK > AT_RISK > others
          if (statusCounts.AT_RISK > 0) {
            newStatus = 'AT_RISK';
          } else {
            // Default to current status if unclear
            newStatus = objective.status;
          }
        }
      }
    }
    // Priority 2: Calculate from child Objectives if no KRs
    else if (objective.children && objective.children.length > 0) {
      const childStatuses = objective.children
        .map(child => child.status)
        .filter((status): status is OKRStatus => status !== null && status !== undefined);

      if (childStatuses.length > 0) {
        // Apply same logic as for KRs
        const statusCounts = {
          ON_TRACK: childStatuses.filter(s => s === 'ON_TRACK').length,
          AT_RISK: childStatuses.filter(s => s === 'AT_RISK').length,
          OFF_TRACK: childStatuses.filter(s => s === 'OFF_TRACK').length,
          COMPLETED: childStatuses.filter(s => s === 'COMPLETED').length,
          CANCELLED: childStatuses.filter(s => s === 'CANCELLED').length,
        };

        const totalChildren = childStatuses.length;

        if (statusCounts.OFF_TRACK > 0) {
          newStatus = statusCounts.OFF_TRACK >= totalChildren / 2 ? 'OFF_TRACK' : 'AT_RISK';
        } else if (statusCounts.COMPLETED === totalChildren) {
          newStatus = 'COMPLETED';
        } else if (statusCounts.CANCELLED === totalChildren) {
          newStatus = 'CANCELLED';
        } else if (statusCounts.AT_RISK >= totalChildren / 2) {
          newStatus = 'AT_RISK';
        } else if (statusCounts.ON_TRACK === totalChildren) {
          newStatus = 'ON_TRACK';
        } else if (statusCounts.AT_RISK > 0) {
          newStatus = 'AT_RISK';
        }
      }
    }
    // Priority 3: If no children or KRs, leave as-is

    // Only update if status actually changed
    if (newStatus !== objective.status) {
      await this.prisma.objective.update({
        where: { id: objectiveId },
        data: { status: newStatus },
      });

      // Store progress snapshot when status changes (includes current progress)
      await this.storeProgressSnapshot(objectiveId, objective.progress, newStatus, 'STATUS_ROLLUP');
    }

    // Cascade to parent Objective if one exists
    if (objective.parent?.id) {
      await this.recalculateObjectiveStatus(objective.parent.id);
    }
  }

  /**
   * Refresh Objective status when a Key Result's status changes.
   * 
   * Finds all Objectives linked to this Key Result and recalculates their status.
   * 
   * Note: This is an internal service method. Tenant security is enforced by the calling services.
   * 
   * @param keyResultId - The Key Result ID that changed
   */
  async refreshObjectiveStatusForKeyResult(keyResultId: string): Promise<void> {
    // Find all Objectives linked to this Key Result
    const objectiveKeyResults = await this.prisma.objectiveKeyResult.findMany({
      where: { keyResultId },
      select: { objectiveId: true },
    });

    // Recalculate status for each linked Objective
    for (const objKr of objectiveKeyResults) {
      await this.recalculateObjectiveStatus(objKr.objectiveId);
    }
  }

  /**
   * Refresh both progress and status for an Objective and cascade upwards.
   * 
   * Convenience method that recalculates both progress and status, then cascades to parents.
   * 
   * @param objectiveId - The Objective ID to refresh
   */
  async refreshObjectiveProgressAndStatusCascade(objectiveId: string): Promise<void> {
    await this.recalculateObjectiveProgress(objectiveId);
    await this.recalculateObjectiveStatus(objectiveId);
  }

  /**
   * Store a progress snapshot for historical tracking.
   * 
   * Creates a snapshot record of Objective progress and status at a specific point in time.
   * Used for trend analysis and historical progress visualization.
   * 
   * @param objectiveId - The Objective ID
   * @param progress - Progress value (0-100)
   * @param status - Status at snapshot time
   * @param triggeredBy - What triggered this snapshot (e.g., "KR_CHECKIN", "PROGRESS_ROLLUP", "STATUS_ROLLUP")
   */
  private async storeProgressSnapshot(
    objectiveId: string,
    progress: number,
    status: OKRStatus,
    triggeredBy: string,
  ): Promise<void> {
    try {
      await this.prisma.objectiveProgressSnapshot.create({
        data: {
          objectiveId,
          progress,
          status,
          triggeredBy,
        },
      });
    } catch (error) {
      // Log error but don't fail the operation if snapshot storage fails
      console.error(`Failed to store progress snapshot for objective ${objectiveId}:`, error);
    }
  }
}


