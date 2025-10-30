import { useEffect, useRef } from 'react'
import { Node } from 'reactflow'
import api from '@/lib/api'

interface UseAutoSaveOptions {
  enabled?: boolean
  debounceMs?: number
  onSaveStart?: () => void
  onSaveComplete?: () => void
  onSaveError?: (error: Error) => void
}

export function useAutoSave(
  nodes: Node[],
  options: UseAutoSaveOptions = {}
) {
  const {
    enabled = true,
    debounceMs = 500,
    onSaveStart,
    onSaveComplete,
    onSaveError,
  } = options

  const timeoutRef = useRef<NodeJS.Timeout>()
  const lastSavedPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const isSavingRef = useRef(false)

  useEffect(() => {
    if (!enabled || isSavingRef.current) return

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Create a stable reference to node positions to avoid infinite loops
    const nodePositions = nodes.map(node => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      okrId: node.data?.okrId,
    }))

    // Check if any node positions have changed
    const hasChanges = nodePositions.some(nodePos => {
      if (!nodePos.okrId) return false // Only track saved nodes
      const lastSaved = lastSavedPositionsRef.current.get(nodePos.id)
      if (!lastSaved) return true
      return (
        Math.abs(lastSaved.x - nodePos.x) > 1 ||
        Math.abs(lastSaved.y - nodePos.y) > 1
      )
    })

    if (!hasChanges) return

    // Debounce the save
    timeoutRef.current = setTimeout(async () => {
      try {
        isSavingRef.current = true
        onSaveStart?.()

        // Collect all node positions for batch save
        const layouts = nodePositions
          .filter(nodePos => nodePos.okrId)
          .map(nodePos => {
            const nodeTypePrefix = nodePos.id.split('-')[0]
            const entityType = 
              nodeTypePrefix === 'obj' ? 'OBJECTIVE' :
              nodeTypePrefix === 'kr' ? 'KEY_RESULT' :
              'INITIATIVE'
            
            return {
              entityType,
              entityId: nodePos.okrId,
              positionX: nodePos.x,
              positionY: nodePos.y,
            }
          })

        if (layouts.length > 0) {
          await api.post('/layout/save', { layouts })
          
          // Update last saved positions
          nodePositions.forEach(nodePos => {
            if (nodePos.okrId) {
              lastSavedPositionsRef.current.set(nodePos.id, {
                x: nodePos.x,
                y: nodePos.y,
              })
            }
          })
        }

        onSaveComplete?.()
      } catch (error: any) {
        // Only log if it's not a 404 (endpoint might not exist yet)
        if (error.response?.status !== 404) {
          console.error('Auto-save failed:', error)
        }
        onSaveError?.(error as Error)
      } finally {
        isSavingRef.current = false
      }
    }, debounceMs)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [nodes, enabled, debounceMs, onSaveStart, onSaveComplete, onSaveError])

  return {
    isSaving: isSavingRef.current,
  }
}

