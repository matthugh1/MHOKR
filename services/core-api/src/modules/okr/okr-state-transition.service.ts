import { Injectable, BadRequestException } from '@nestjs/common';

/**
 * OKR State Transition Service
 * 
 * Validates and enforces state transitions for Objectives, Key Results, and Initiatives.
 * 
 * Objective/KeyResult valid transitions:
 * - DRAFT → PUBLISHED (publish)
 * - PUBLISHED → DRAFT (unpublish, admin only)
 * - DRAFT → COMPLETED (complete draft)
 * - PUBLISHED → COMPLETED (complete published)
 * - DRAFT → CANCELLED (cancel draft)
 * - PUBLISHED → CANCELLED (cancel published)
 * - COMPLETED → ARCHIVED (archive completed)
 * - CANCELLED → ARCHIVED (archive cancelled)
 * - ARCHIVED → (no transitions allowed, read-only)
 * 
 * Initiative valid transitions:
 * - NOT_STARTED → IN_PROGRESS, COMPLETED, BLOCKED
 * - IN_PROGRESS → COMPLETED, BLOCKED
 * - COMPLETED → (terminal, no transitions)
 * - BLOCKED → IN_PROGRESS, COMPLETED (unblock)
 * 
 * Invalid transitions throw BadRequestException.
 */
@Injectable()
export class OkrStateTransitionService {
  /**
   * Valid state transitions for Objectives
   */
  private readonly objectiveTransitions: Map<string, Set<string>> = new Map([
    ['DRAFT', new Set(['PUBLISHED', 'COMPLETED', 'CANCELLED'])],
    ['PUBLISHED', new Set(['DRAFT', 'COMPLETED', 'CANCELLED'])],
    ['COMPLETED', new Set(['ARCHIVED'])],
    ['CANCELLED', new Set(['ARCHIVED'])],
    ['ARCHIVED', new Set([])], // No transitions from ARCHIVED
  ]);

  /**
   * Valid state transitions for Key Results
   */
  private readonly keyResultTransitions: Map<string, Set<string>> = new Map([
    ['DRAFT', new Set(['PUBLISHED', 'COMPLETED', 'CANCELLED'])],
    ['PUBLISHED', new Set(['DRAFT', 'COMPLETED', 'CANCELLED'])],
    ['COMPLETED', new Set(['ARCHIVED'])],
    ['CANCELLED', new Set(['ARCHIVED'])],
    ['ARCHIVED', new Set([])], // No transitions from ARCHIVED
  ]);

  /**
   * Valid state transitions for Initiatives
   */
  private readonly initiativeTransitions: Map<string, Set<string>> = new Map([
    ['NOT_STARTED', new Set(['IN_PROGRESS', 'COMPLETED', 'BLOCKED'])],
    ['IN_PROGRESS', new Set(['COMPLETED', 'BLOCKED'])],
    ['COMPLETED', new Set([])], // Terminal state
    ['BLOCKED', new Set(['IN_PROGRESS', 'COMPLETED'])], // Can unblock
  ]);

  /**
   * Assert that a state transition is valid for an Objective
   * 
   * @param before - Current state
   * @param next - Desired next state
   * @throws BadRequestException if transition is invalid
   */
  assertObjectiveStateTransition(before: string, next: string): void {
    const validNextStates = this.objectiveTransitions.get(before);
    
    if (!validNextStates) {
      throw new BadRequestException(`Invalid current state: ${before}`);
    }

    if (!validNextStates.has(next)) {
      throw new BadRequestException(
        `Invalid state transition: Cannot transition from ${before} to ${next}. ` +
        `Valid transitions from ${before} are: ${Array.from(validNextStates).join(', ')}`
      );
    }
  }

  /**
   * Assert that a state transition is valid for a Key Result
   * 
   * @param before - Current state
   * @param next - Desired next state
   * @throws BadRequestException if transition is invalid
   */
  assertKeyResultStateTransition(before: string, next: string): void {
    const validNextStates = this.keyResultTransitions.get(before);
    
    if (!validNextStates) {
      throw new BadRequestException(`Invalid current state: ${before}`);
    }

    if (!validNextStates.has(next)) {
      throw new BadRequestException(
        `Invalid state transition: Cannot transition from ${before} to ${next}. ` +
        `Valid transitions from ${before} are: ${Array.from(validNextStates).join(', ')}`
      );
    }
  }

  /**
   * Calculate state from status and isPublished (for migration/backfill)
   * 
   * @param status - OKRStatus enum value
   * @param isPublished - Boolean publish state
   * @returns Calculated state
   */
  calculateStateFromLegacy(status: string, isPublished: boolean): 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED' {
    if (status === 'COMPLETED') {
      return 'COMPLETED';
    }
    if (status === 'CANCELLED') {
      return 'CANCELLED';
    }
    if (isPublished) {
      return 'PUBLISHED';
    }
    return 'DRAFT';
  }

  /**
   * Calculate state from status and isPublished for Objective
   * 
   * @param status - OKRStatus enum value
   * @param isPublished - Boolean publish state
   * @returns Calculated ObjectiveState
   */
  calculateObjectiveStateFromLegacy(status: string, isPublished: boolean): 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED' {
    return this.calculateStateFromLegacy(status, isPublished);
  }

  /**
   * Calculate state from status and isPublished for Key Result
   * 
   * @param status - OKRStatus enum value
   * @param isPublished - Boolean publish state
   * @returns Calculated KeyResultState
   */
  calculateKeyResultStateFromLegacy(status: string, isPublished: boolean): 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED' {
    return this.calculateStateFromLegacy(status, isPublished);
  }

  /**
   * Assert that a state transition is valid for an Initiative
   * 
   * @param before - Current InitiativeStatus
   * @param next - Desired next InitiativeStatus
   * @throws BadRequestException if transition is invalid
   */
  assertInitiativeStateTransition(before: string, next: string): void {
    const validNextStates = this.initiativeTransitions.get(before);
    
    if (!validNextStates) {
      throw new BadRequestException(`Invalid current Initiative status: ${before}`);
    }

    if (!validNextStates.has(next)) {
      throw new BadRequestException(
        `Invalid Initiative status transition: Cannot transition from ${before} to ${next}. ` +
        `Valid transitions from ${before} are: ${Array.from(validNextStates).join(', ') || 'none (terminal state)'}`
      );
    }
  }
}

