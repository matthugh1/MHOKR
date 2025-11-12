/**
 * Risk Calculator Utility
 * 
 * Pure function to determine if an Objective or Key Result is at-risk.
 * Can be used by API endpoints, UI components, and schedulers.
 * 
 * Criteria:
 * - Status in {AT_RISK, OFF_TRACK, BLOCKED}
 * - OR latest check-in confidence below threshold (default 50)
 */

export interface RiskCheckInput {
  status: string;
  latestConfidence: number | null | undefined;
  confidenceThreshold?: number;
}

export interface RiskCheckResult {
  isAtRisk: boolean;
  reason: 'status' | 'confidence' | null;
}

/**
 * Check if an entity is at-risk based on status and confidence.
 * 
 * @param input - Status, latest confidence, and optional threshold
 * @returns Risk check result with flag and reason
 */
export function isAtRisk(input: RiskCheckInput): RiskCheckResult {
  const threshold = input.confidenceThreshold ?? 50;
  const atRiskStatuses = ['AT_RISK', 'OFF_TRACK', 'BLOCKED'];

  // Check status first
  if (atRiskStatuses.includes(input.status)) {
    return {
      isAtRisk: true,
      reason: 'status',
    };
  }

  // Check confidence if available
  if (input.latestConfidence !== null && input.latestConfidence !== undefined) {
    if (input.latestConfidence < threshold) {
      return {
        isAtRisk: true,
        reason: 'confidence',
      };
    }
  }

  return {
    isAtRisk: false,
    reason: null,
  };
}


