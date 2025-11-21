/**
 * OKR Owners API Service
 * 
 * Service functions for managing multiple owners of Objectives and Key Results
 */

import api from './api'

export interface Owner {
  id: string
  userId: string
  userName: string
  userEmail: string
  isPrimary: boolean
  createdAt: string
}

/**
 * Get all owners for an Objective
 */
export async function getObjectiveOwners(objectiveId: string): Promise<Owner[]> {
  const response = await api.get(`/objectives/${objectiveId}/owners`)
  return response.data
}

/**
 * Add an owner to an Objective
 */
export async function addObjectiveOwner(
  objectiveId: string,
  userId: string
): Promise<Owner> {
  const response = await api.post(`/objectives/${objectiveId}/owners`, {
    userId,
  })
  return response.data
}

/**
 * Remove an owner from an Objective
 */
export async function removeObjectiveOwner(
  objectiveId: string,
  userId: string
): Promise<void> {
  await api.delete(`/objectives/${objectiveId}/owners/${userId}`)
}

/**
 * Get all owners for a Key Result
 */
export async function getKeyResultOwners(keyResultId: string): Promise<Owner[]> {
  const response = await api.get(`/key-results/${keyResultId}/owners`)
  return response.data
}

/**
 * Add an owner to a Key Result
 */
export async function addKeyResultOwner(
  keyResultId: string,
  userId: string
): Promise<Owner> {
  const response = await api.post(`/key-results/${keyResultId}/owners`, {
    userId,
  })
  return response.data
}

/**
 * Remove an owner from a Key Result
 */
export async function removeKeyResultOwner(
  keyResultId: string,
  userId: string
): Promise<void> {
  await api.delete(`/key-results/${keyResultId}/owners/${userId}`)
}

