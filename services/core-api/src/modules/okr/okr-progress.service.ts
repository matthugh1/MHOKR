import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * OKR Progress Service
 * 
 * Centralized service for calculating and rolling up Objective progress from Key Results.
 * This service exists to avoid circular dependencies between ObjectiveService and KeyResultService.
 * 
 * TODO [phase7-hardening]: Add weighting support on ObjectiveKeyResult junction table (e.g., KR1 = 40%, KR2 = 60%)
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
   * 1. If Objective has linked Key Results → average of KR progress values
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
          include: {
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

    // Priority 1: Calculate from linked Key Results
    if (objective.keyResults && objective.keyResults.length > 0) {
      const krProgresses = objective.keyResults
        .map(objKr => objKr.keyResult.progress)
        .filter(progress => progress !== null && progress !== undefined && !isNaN(progress));

      if (krProgresses.length > 0) {
        const sum = krProgresses.reduce((acc, p) => acc + p, 0);
        newProgress = sum / krProgresses.length;
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
}


