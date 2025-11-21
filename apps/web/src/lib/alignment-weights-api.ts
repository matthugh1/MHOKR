/**
 * Alignment Weights API Service
 * 
 * Service functions for managing alignment weights between Objectives and Key Results
 */

import api from './api'

/**
 * Update the weight of a Key Result link to an Objective
 * @param objectiveId - The Objective ID
 * @param keyResultId - The Key Result ID
 * @param weight - The weight value (0.0-3.0, default 1.0)
 * @returns Updated junction record with weight
 */
export async function updateKeyResultWeight(
  objectiveId: string,
  keyResultId: string,
  weight: number
): Promise<{ objectiveId: string; keyResultId: string; weight: number }> {
  const response = await api.patch(`/objectives/${objectiveId}/key-results/${keyResultId}/weight`, {
    weight,
  })
  return response.data
}

