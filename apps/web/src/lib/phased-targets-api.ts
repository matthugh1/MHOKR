/**
 * Phased Targets API Service
 * 
 * Service functions for managing phased targets (milestones) for Objectives and Key Results
 */

import api from './api'

export type PhasedTargetInterval = 'MONTHLY' | 'QUARTERLY' | 'CUSTOM'

export interface PhasedTarget {
  id: string
  objectiveId?: string | null
  keyResultId?: string | null
  interval: PhasedTargetInterval
  targetValue: number
  targetDate: string
  order: number
  createdAt: string
  updatedAt: string
}

export interface CreatePhasedTargetDto {
  objectiveId?: string
  keyResultId?: string
  interval: PhasedTargetInterval
  targetValue: number
  targetDate: string
  order: number
}

export interface UpdatePhasedTargetDto {
  interval?: PhasedTargetInterval
  targetValue?: number
  targetDate?: string
  order?: number
}

/**
 * Get all phased targets for an Objective
 */
export async function getObjectivePhasedTargets(objectiveId: string): Promise<PhasedTarget[]> {
  const response = await api.get(`/phased-targets/objective/${objectiveId}`)
  return response.data
}

/**
 * Get all phased targets for a Key Result
 */
export async function getKeyResultPhasedTargets(keyResultId: string): Promise<PhasedTarget[]> {
  const response = await api.get(`/phased-targets/key-result/${keyResultId}`)
  return response.data
}

/**
 * Get a phased target by ID
 */
export async function getPhasedTarget(id: string): Promise<PhasedTarget> {
  const response = await api.get(`/phased-targets/${id}`)
  return response.data
}

/**
 * Create a phased target
 */
export async function createPhasedTarget(dto: CreatePhasedTargetDto): Promise<PhasedTarget> {
  const response = await api.post('/phased-targets', dto)
  return response.data
}

/**
 * Update a phased target
 */
export async function updatePhasedTarget(
  id: string,
  dto: UpdatePhasedTargetDto
): Promise<PhasedTarget> {
  const response = await api.put(`/phased-targets/${id}`, dto)
  return response.data
}

/**
 * Delete a phased target
 */
export async function deletePhasedTarget(id: string): Promise<void> {
  await api.delete(`/phased-targets/${id}`)
}

