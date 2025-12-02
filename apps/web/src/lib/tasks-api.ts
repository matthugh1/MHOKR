/**
 * Tasks API Service
 * 
 * Service functions for managing tasks linked to Key Results and Initiatives
 */

import api from './api'
import { Task, InitiativeStatus } from '@okr-nexus/types'

/**
 * Get all tasks, optionally filtered by keyResultId or initiativeId
 */
export async function getTasks(keyResultId?: string, initiativeId?: string): Promise<Task[]> {
  const params = new URLSearchParams()
  if (keyResultId) params.append('keyResultId', keyResultId)
  if (initiativeId) params.append('initiativeId', initiativeId)
  
  const queryString = params.toString()
  const response = await api.get(`/tasks${queryString ? `?${queryString}` : ''}`)
  return response.data
}

/**
 * Get a task by ID
 */
export async function getTask(id: string): Promise<Task> {
  const response = await api.get(`/tasks/${id}`)
  return response.data
}

/**
 * Create a new task
 */
export async function createTask(data: {
  title: string
  description?: string
  ownerId: string
  keyResultId?: string
  initiativeId?: string
  status?: InitiativeStatus
  dueDate?: string
}): Promise<Task> {
  const response = await api.post('/tasks', data)
  return response.data
}

/**
 * Update a task
 */
export async function updateTask(
  id: string,
  data: {
    title?: string
    description?: string
    ownerId?: string
    keyResultId?: string
    initiativeId?: string
    status?: InitiativeStatus
    dueDate?: string
  }
): Promise<Task> {
  const response = await api.patch(`/tasks/${id}`, data)
  return response.data
}

/**
 * Delete a task
 */
export async function deleteTask(id: string): Promise<{ success: boolean }> {
  const response = await api.delete(`/tasks/${id}`)
  return response.data
}

