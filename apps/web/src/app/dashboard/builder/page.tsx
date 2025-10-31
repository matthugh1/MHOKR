'use client'

import { useCallback, useState, useEffect } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Connection,
  EdgeChange,
  addEdge,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MiniMap,
  Panel,
  NodeProps,
  Handle,
  Position,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Save, Target, CheckCircle, Lightbulb, X, Trash2, Building2, Users, User, Search, ChevronDown, Briefcase, Calendar } from 'lucide-react'
import api from '@/lib/api'
import { Period } from '@okr-nexus/types'
import { createHierarchicalLayout, getDefaultNodePosition } from '@/lib/auto-layout'
import { EditPanel } from './components/EditPanel'
import { EditFormTabs } from './components/EditFormTabs'
import { ObjectiveNode, KeyResultNode, InitiativeNode } from './components/EnhancedNodes'
import { useAutoSave } from './hooks/useAutoSave'
import { 
  calculateEndDate, 
  formatDateForInput, 
  getPeriodLabel, 
  formatPeriod, 
  getQuarterFromDate, 
  getQuarterDates, 
  getMonthDates, 
  getYearDates,
  getCurrentYear,
  getAvailableYears,
  getMonthName,
  getAvailablePeriodFilters,
  getCurrentPeriodFilter,
  doesOKRMatchPeriod,
  type PeriodFilterOption
} from '@/lib/date-utils'

// Node components are now imported from EnhancedNodes.tsx

const nodeTypes = {
  objective: ObjectiveNode,
  keyResult: KeyResultNode,
  initiative: InitiativeNode,
}

export default function BuilderPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState([])
  // TODO [phase7-hardening]: tighten typing - replace Record<string, unknown> with proper node types
  const [editingNode, setEditingNode] = useState<{ id: string; data: Record<string, unknown> } | null>(null)
  const [editingFormData, setEditingFormData] = useState<Record<string, unknown> | null>(null)
  const [showNodeCreator, setShowNodeCreator] = useState(false)
  const [loading, setLoading] = useState(false)
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [periodFilter, setPeriodFilter] = useState<string>(getCurrentPeriodFilter())
  const availablePeriods = getAvailablePeriodFilters()

  // Auto-save positions - Temporarily disabled until endpoint is verified
  useAutoSave(nodes, {
    enabled: false, // Disabled to prevent 404 spam - will re-enable after fixing endpoint
    debounceMs: 500,
    onSaveStart: () => setSavingState('saving'),
    onSaveComplete: () => {
      setSavingState('saved')
      setTimeout(() => setSavingState('idle'), 2000)
    },
    onSaveError: () => setSavingState('idle'),
  })
  const { 
    defaultOKRContext, 
    currentOrganization,
    currentWorkspace, 
    currentTeam, 
    currentOKRLevel,
    loading: workspaceLoading 
  } = useWorkspace()
  const { user } = useAuth()

  const getOKRLevelDisplay = () => {
    switch (currentOKRLevel) {
      case 'organization':
        return {
          icon: Building2,
          label: 'Organization',
          name: currentOrganization?.name || 'Unknown',
          color: 'text-blue-600'
        }
      case 'workspace':
        return {
          icon: Building2,
          label: 'Workspace',
          name: currentWorkspace?.name || 'Unknown',
          color: 'text-green-600'
        }
      case 'team':
        return {
          icon: Users,
          label: 'Team',
          name: currentTeam?.name || 'Unknown',
          color: 'text-purple-600'
        }
      case 'personal':
        return {
          icon: Users,
          label: 'Personal',
          name: user ? `${user.firstName} ${user.lastName}` : 'You',
          color: 'text-orange-600'
        }
    }
  }

  const levelDisplay = getOKRLevelDisplay()

  // Filter nodes based on period
  const selectedPeriodOption = availablePeriods.find(p => p.value === periodFilter)
  const filteredNodes = periodFilter === 'all' 
    ? nodes 
    : nodes.filter(node => {
        if (node.type === 'objective' && node.data.startDate && node.data.endDate && selectedPeriodOption) {
          return doesOKRMatchPeriod(node.data.startDate, node.data.endDate, selectedPeriodOption)
        }
        return true // Show key results and initiatives
      })

  // Load existing OKRs from backend
  useEffect(() => {
    // Only load if we have an organization context
    if (currentOrganization?.id) {
      loadOKRs()
    }
  }, [currentOrganization?.id])

  const loadOKRs = async () => {
    try {
      // Build query params with organizationId if available
      const queryParams = currentOrganization?.id ? `?organizationId=${currentOrganization.id}` : ''
      
      // Load objectives, key results, initiatives, and user layout
      const [objectivesRes, , initiativesRes, userLayoutRes] = await Promise.all([
        api.get(`/objectives${queryParams}`),
        api.get(`/key-results${queryParams}`),
        api.get(`/initiatives${queryParams}`),
        api.get(`/layout${queryParams}`).catch(() => ({ data: {} })), // Gracefully handle if no layout exists
      ])

      const userLayoutMap = userLayoutRes.data || {}
      const loadedNodes: Node[] = []
      const loadedEdges: Edge[] = []

      // Helper function to get position with fallback priority
      const getNodePosition = (entityType: string, entityId: string, defaultPosition: { x: number; y: number }) => {
        // 1. Check user's custom layout first
        const userLayoutKey = `${entityType.toUpperCase()}:${entityId}`
        if (userLayoutMap[userLayoutKey]) {
          return userLayoutMap[userLayoutKey]
        }
        
        // 2. Fall back to default position
        return defaultPosition
      }

      // Add objectives as nodes
      objectivesRes.data.forEach((obj: any, index: number) => {
        const defaultPosition = obj.positionX !== null && obj.positionY !== null 
          ? { x: obj.positionX, y: obj.positionY }
          : getDefaultNodePosition('objective', index)
        
        const position = getNodePosition('OBJECTIVE', obj.id, defaultPosition)
        
        loadedNodes.push({
          id: `obj-${obj.id}`,
          type: 'objective',
          position,
            data: {
              label: obj.title,
              description: obj.description,
              progress: obj.progress || 0,
              owner: obj.ownerId,
              ownerId: obj.ownerId,
              ownerName: obj.owner?.name,
              parentId: obj.parentId,
              organizationId: obj.organizationId,
              workspaceId: obj.workspaceId,
              teamId: obj.teamId,
              period: obj.period,
              startDate: obj.startDate ? formatDateForInput(obj.startDate) : undefined,
              endDate: obj.endDate ? formatDateForInput(obj.endDate) : undefined,
              onEdit: handleEditNode,
              onQuickSave: handleQuickSave,
              okrId: obj.id,
            },
        })

        // Add key results as nodes and connect to objectives
        if (obj.keyResults) {
          obj.keyResults.forEach((krJunction: any, krIndex: number) => {
            // krJunction is the ObjectiveKeyResult junction table record
            // The actual KeyResult is nested in krJunction.keyResult
            const kr = krJunction.keyResult
            if (!kr) return // Skip if keyResult is missing
            
            const krNodeId = `kr-${kr.id}`
            const defaultPosition = kr.positionX !== null && kr.positionY !== null
              ? { x: kr.positionX, y: kr.positionY }
              : getDefaultNodePosition('keyResult', krIndex, index)
            
            const position = getNodePosition('KEY_RESULT', kr.id, defaultPosition)
            
            loadedNodes.push({
              id: krNodeId,
              type: 'keyResult',
              position,
              data: {
                label: kr.title || kr.description,
                description: kr.description,
                current: kr.currentValue,
                target: kr.targetValue,
                unit: kr.unit,
                progress: kr.progress || 0,
                period: kr.period,
                startDate: kr.startDate ? formatDateForInput(kr.startDate) : undefined,
                endDate: kr.endDate ? formatDateForInput(kr.endDate) : undefined,
                onEdit: handleEditNode,
                onQuickSave: handleQuickSave,
                okrId: kr.id, // Use the actual KeyResult ID, not the junction table ID
              },
            })
            
            // Connect KR to Objective
            loadedEdges.push({
              id: `e-${obj.id}-${kr.id}`,
              source: `obj-${obj.id}`,
              target: krNodeId,
              animated: true,
            })
          })
        }
      })

      // Create parent-child edges between objectives
      objectivesRes.data.forEach((obj: any) => {
        if (obj.parentId) {
          loadedEdges.push({
            id: `edge-obj-${obj.parentId}-obj-${obj.id}`,
            source: `obj-${obj.parentId}`,
            target: `obj-${obj.id}`,
            type: 'smoothstep',
            animated: false,
            style: { stroke: '#3b82f6', strokeWidth: 2 },
            data: { type: 'parent-child' }
          })
        }
      })

      // Add initiatives
      initiativesRes.data.forEach((init: any, index: number) => {
        const initNodeId = `init-${init.id}`
        const defaultPosition = init.positionX !== null && init.positionY !== null
          ? { x: init.positionX, y: init.positionY }
          : getDefaultNodePosition('initiative', index)
        
        const position = getNodePosition('INITIATIVE', init.id, defaultPosition)
        
        loadedNodes.push({
          id: initNodeId,
          type: 'initiative',
          position,
          data: {
            label: init.title,
            status: init.status,
            period: init.period,
            startDate: init.startDate ? formatDateForInput(init.startDate) : undefined,
            endDate: init.endDate ? formatDateForInput(init.endDate) : undefined,
            onEdit: handleEditNode,
            onQuickSave: handleQuickSave,
            okrId: init.id,
          },
        })

        // Connect initiative to key result if linked
        if (init.keyResultId) {
          loadedEdges.push({
            id: `e-${init.keyResultId}-${init.id}`,
            source: `kr-${init.keyResultId}`,
            target: initNodeId,
          })
        }
      })

      // If no user layout exists and we have nodes, apply auto-layout
      const hasUserLayout = Object.keys(userLayoutMap).length > 0
      if (!hasUserLayout && loadedNodes.length > 0) {
        const { nodes: layoutedNodes } = createHierarchicalLayout(loadedNodes, loadedEdges)
        setNodes(layoutedNodes)
      } else {
        setNodes(loadedNodes)
      }
      
      setEdges(loadedEdges)
    } catch (error) {
      console.error('Failed to load OKRs:', error)
    }
  }

  const handleEditNode = (nodeId: string, data: any) => {
    console.log('Opening edit panel for node:', nodeId, data)
    setEditingNode({ id: nodeId, data })
    
    // Initialize form data
    const initStartDate = data.startDate ? new Date(data.startDate) : new Date()
    const initPeriod = data.period || Period.QUARTERLY
    
    setEditingFormData({
      label: data.label || '',
      description: data.description || '',
      okrId: data.okrId || '',
      ownerId: data.ownerId || user?.id || '',
      ownerName: data.ownerName || user?.name || '',
      organizationId: data.organizationId || defaultOKRContext.organizationId || '',
      workspaceId: data.workspaceId || defaultOKRContext.workspaceId || '',
      teamId: data.teamId || defaultOKRContext.teamId || '',
      parentId: data.parentId || '',
      progress: data.progress || 0,
      current: data.current || 0,
      target: data.target || 100,
      unit: data.unit || 'units',
      status: data.status || 'NOT_STARTED',
      metricType: data.metricType || 'INCREASE',
      period: initPeriod,
      startDate: data.startDate || formatDateForInput(new Date()),
      endDate: data.endDate || formatDateForInput(calculateEndDate(new Date(), initPeriod)),
      quarter: getQuarterFromDate(initStartDate),
      month: initStartDate.getMonth(),
      year: initStartDate.getFullYear(),
      visibilityLevel: data.visibilityLevel || 'PUBLIC_TENANT',
    })
  }

  const handleQuickSave = async (nodeId: string, quickData: any) => {
    try {
      const nodeTypePrefix = nodeId.split('-')[0]
      const node = nodes.find(n => n.id === nodeId)
      const okrId = node?.data.okrId

      if (!okrId) return

      if (nodeTypePrefix === 'obj') {
        await api.patch(`/objectives/${okrId}`, {
          title: quickData.label,
        })
      } else if (nodeTypePrefix === 'kr') {
        await api.patch(`/key-results/${okrId}`, {
          title: quickData.label,
        })
      } else if (nodeTypePrefix === 'init') {
        await api.patch(`/initiatives/${okrId}`, {
          title: quickData.label,
        })
      }

      // Update node in canvas
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...quickData } } : n
        )
      )
    } catch (error) {
      console.error('Failed to quick save:', error)
    }
  }

  const handleSaveNode = async (nodeId: string, updatedData: any) => {
    try {
      console.log('Saving node:', nodeId, updatedData)
      const nodeTypePrefix = nodeId.split('-')[0]
      const okrId = updatedData.okrId

      if (nodeTypePrefix === 'obj') {
        // Update objective
        if (okrId) {
          await api.patch(`/objectives/${okrId}`, {
            title: updatedData.label,
            description: updatedData.description,
            ownerId: updatedData.ownerId,
            organizationId: updatedData.organizationId && updatedData.organizationId !== '' ? updatedData.organizationId : null,
            workspaceId: updatedData.workspaceId && updatedData.workspaceId !== '' ? updatedData.workspaceId : null,
            teamId: updatedData.teamId && updatedData.teamId !== '' ? updatedData.teamId : null,
            parentId: updatedData.parentId && updatedData.parentId !== '' ? updatedData.parentId : null,
            progress: updatedData.progress,
            period: updatedData.period,
            startDate: updatedData.startDate ? new Date(updatedData.startDate).toISOString() : undefined,
            endDate: updatedData.endDate ? new Date(updatedData.endDate).toISOString() : undefined,
            visibilityLevel: updatedData.visibilityLevel || 'PUBLIC_TENANT',
          })
          
          // Update parent-child edge if parent changed
          const currentNode = nodes.find(n => n.id === nodeId)
          const oldParentId = currentNode?.data.parentId
          const newParentId = updatedData.parentId
          
          // If parent changed, update edges
          if (oldParentId !== newParentId) {
            // Remove old parent edge if it exists
            if (oldParentId) {
              setEdges(prev => prev.filter(e => 
                !(e.source.endsWith(oldParentId) && e.target === nodeId && e.data?.type === 'parent-child')
              ))
            }
            
            // Add new parent edge if parent is set
            if (newParentId) {
              const parentNode = nodes.find(n => n.data.okrId === newParentId)
              if (parentNode) {
                const newEdge = {
                  id: `edge-${parentNode.id}-${nodeId}`,
                  source: parentNode.id,
                  target: nodeId,
                  type: 'smoothstep',
                  animated: false,
                  style: { stroke: '#3b82f6', strokeWidth: 2 },
                  data: { type: 'parent-child' }
                }
                setEdges(prev => [...prev, newEdge])
              }
            }
          }
        } else {
          // Create new objective
          const res = await api.post('/objectives', {
            title: updatedData.label,
            description: updatedData.description,
            organizationId: (updatedData.organizationId && updatedData.organizationId !== '') ? updatedData.organizationId : (defaultOKRContext.organizationId || null),
            workspaceId: (updatedData.workspaceId && updatedData.workspaceId !== '') ? updatedData.workspaceId : (defaultOKRContext.workspaceId || null),
            teamId: (updatedData.teamId && updatedData.teamId !== '') ? updatedData.teamId : (defaultOKRContext.teamId || null),
            ownerId: updatedData.ownerId || defaultOKRContext.ownerId,
            parentId: (updatedData.parentId && updatedData.parentId !== '') ? updatedData.parentId : null,
            period: updatedData.period || Period.QUARTERLY,
            startDate: updatedData.startDate ? new Date(updatedData.startDate).toISOString() : new Date().toISOString(),
            endDate: updatedData.endDate ? new Date(updatedData.endDate).toISOString() : calculateEndDate(new Date(), updatedData.period || Period.QUARTERLY).toISOString(),
            visibilityLevel: updatedData.visibilityLevel || 'PUBLIC_TENANT',
          })
          updatedData.okrId = res.data.id
          
          // Auto-create visual edge if parent objective is selected
          if (updatedData.parentId) {
            const parentNode = nodes.find(n => n.data.okrId === updatedData.parentId)
            if (parentNode) {
              const newEdge = {
                id: `edge-${parentNode.id}-${nodeId}`,
                source: parentNode.id,
                target: nodeId,
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#3b82f6', strokeWidth: 2 },
                data: { type: 'parent-child' }
              }
              setEdges(prev => [...prev, newEdge])
            }
          }
        }
      } else if (nodeTypePrefix === 'kr') {
        // Update or create key result
        if (okrId) {
          await api.patch(`/key-results/${okrId}`, {
            title: updatedData.label,
            currentValue: updatedData.current,
            targetValue: updatedData.target,
            unit: updatedData.unit,
            period: updatedData.period || null,
            startDate: updatedData.startDate ? new Date(updatedData.startDate).toISOString() : null,
            endDate: updatedData.endDate ? new Date(updatedData.endDate).toISOString() : null,
          })
        } else {
          // Create new key result - can be standalone or linked to objective
          const linkedObjectiveEdge = edges.find(e => e.target === nodeId && e.source?.startsWith('obj-'))
          let objectiveId = null
          
          if (linkedObjectiveEdge) {
            const linkedObjective = nodes.find(n => n.id === linkedObjectiveEdge.source)
            if (linkedObjective?.data.okrId) {
              objectiveId = linkedObjective.data.okrId
            }
          }

          const res = await api.post('/key-results', {
            title: updatedData.label,
            objectiveId: objectiveId, // Can be null for standalone key results
            ownerId: updatedData.ownerId || defaultOKRContext.ownerId,
            metricType: updatedData.metricType || 'INCREASE', // Use selected metric type
            startValue: updatedData.current || 0,
            targetValue: updatedData.target || 100,
            currentValue: updatedData.current || 0,
            unit: updatedData.unit || 'units',
            period: updatedData.period || null,
            startDate: updatedData.startDate ? new Date(updatedData.startDate).toISOString() : null,
            endDate: updatedData.endDate ? new Date(updatedData.endDate).toISOString() : null,
          })
          updatedData.okrId = res.data.id
        }
      } else if (nodeTypePrefix === 'init') {
        // Update or create initiative
        if (okrId) {
          await api.patch(`/initiatives/${okrId}`, {
            title: updatedData.label,
            status: updatedData.status,
            period: updatedData.period || null,
            startDate: updatedData.startDate ? new Date(updatedData.startDate).toISOString() : null,
            endDate: updatedData.endDate ? new Date(updatedData.endDate).toISOString() : null,
          })
        } else {
          // Create new initiative
          const linkedKREdge = edges.find(e => e.target === nodeId && e.source?.startsWith('kr-'))
          const linkedObjEdge = edges.find(e => e.target === nodeId && e.source?.startsWith('obj-'))
          
          let keyResultId = null
          let objectiveId = null

          if (linkedKREdge) {
            const linkedKR = nodes.find(n => n.id === linkedKREdge.source)
            if (linkedKR?.data.okrId) {
              keyResultId = linkedKR.data.okrId
            }
          }

          if (linkedObjEdge) {
            const linkedObj = nodes.find(n => n.id === linkedObjEdge.source)
            if (linkedObj?.data.okrId) {
              objectiveId = linkedObj.data.okrId
            }
          }

              const res = await api.post('/initiatives', {
                title: updatedData.label,
                ownerId: updatedData.ownerId || defaultOKRContext.ownerId,
                status: updatedData.status || 'NOT_STARTED',
                keyResultId,
                objectiveId,
                period: updatedData.period || null,
                startDate: updatedData.startDate ? new Date(updatedData.startDate).toISOString() : null,
                endDate: updatedData.endDate ? new Date(updatedData.endDate).toISOString() : null,
              })
          updatedData.okrId = res.data.id
        }
      }

      // Update node in canvas
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...updatedData } } : node
        )
      )
      setEditingNode(null)
      console.log('Node saved successfully!')
    } catch (error: any) {
      console.error('Failed to save node:', error)
      alert(`Failed to save: ${error.response?.data?.message || error.message || 'Unknown error'}`)
    }
  }

  const handleDeleteNode = async (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) {
      console.error('Node not found:', nodeId)
      return
    }

    // If node hasn't been saved yet, just remove from canvas
    if (!node.data.okrId) {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
      setEditingNode(null)
      return
    }

    if (!confirm('Delete this item? This cannot be undone.')) return

    try {
      const nodeTypePrefix = nodeId.split('-')[0]
      const okrId = node.data.okrId

      if (!okrId) {
        // Just remove from canvas if no ID
        setNodes((nds) => nds.filter((n) => n.id !== nodeId))
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
        setEditingNode(null)
        return
      }

      // Delete from backend
      if (nodeTypePrefix === 'obj') {
        await api.delete(`/objectives/${okrId}`)
      } else if (nodeTypePrefix === 'kr') {
        await api.delete(`/key-results/${okrId}`)
      } else if (nodeTypePrefix === 'init') {
        await api.delete(`/initiatives/${okrId}`)
      } else {
        throw new Error(`Unknown node type: ${nodeTypePrefix}`)
      }

      // Remove from canvas on success
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
      setEditingNode(null)
    } catch (error: any) {
      console.error('Failed to delete node:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error'
      alert(`Failed to delete: ${errorMessage}`)
    }
  }

  const handleAddNode = (type: 'objective' | 'keyResult' | 'initiative') => {
    // Map type to short prefix for ID
    const typePrefix = type === 'objective' ? 'obj' : type === 'keyResult' ? 'kr' : 'init'
    
    const newNode: Node = {
      id: `${typePrefix}-${Date.now()}`,
      type,
      position: { x: 250, y: 100 },
      data: {
        label: `New ${type === 'objective' ? 'Objective' : type === 'keyResult' ? 'Key Result' : 'Initiative'}`,
        onEdit: handleEditNode,
        onQuickSave: handleQuickSave,
      },
    }

    if (type === 'objective') {
      newNode.data.progress = 0
      newNode.data.description = ''
      newNode.data.owner = ''
    } else if (type === 'keyResult') {
      newNode.data.current = 0
      newNode.data.target = 100
      newNode.data.unit = 'units'
      newNode.data.progress = 0
    } else if (type === 'initiative') {
      newNode.data.status = 'Not Started'
    }

    setNodes((nds) => [...nds, newNode])
    setShowNodeCreator(false)
    // Auto-open edit dialog
    setTimeout(() => handleEditNode(newNode.id, newNode.data), 100)
  }

  const onConnect = useCallback(
    async (params: Connection) => {
      // Determine edge type and styling based on connection
      const sourceType = params.source?.split('-')[0]
      const targetType = params.target?.split('-')[0]
      
      let edgeData = { type: 'default' }
      let edgeStyle = { stroke: '#94a3b8', strokeWidth: 2 }
      
      if (sourceType === 'obj' && targetType === 'obj') {
        edgeData = { type: 'parent-child' }
        edgeStyle = { stroke: '#3b82f6', strokeWidth: 2 }
      }
      
      setEdges((eds) => addEdge({ 
        ...params, 
        animated: true, 
        style: edgeStyle,
        data: edgeData
      }, eds))
      
      // Save connection to backend
      try {
        const sourceNode = nodes.find((n) => n.id === params.source)
        const targetNode = nodes.find((n) => n.id === params.target)
        
        if (sourceNode?.data.okrId && targetNode?.data.okrId) {
          // Link objective to key result
          if (sourceType === 'obj' && targetType === 'kr') {
            await api.patch(`/key-results/${targetNode.data.okrId}`, {
              objectiveId: sourceNode.data.okrId,
            })
          }
          // Link key result to initiative
          else if (sourceType === 'kr' && targetType === 'init') {
            await api.patch(`/initiatives/${targetNode.data.okrId}`, {
              keyResultId: sourceNode.data.okrId,
            })
          }
          // Link objective to objective (parent-child relationship)
          else if (sourceType === 'obj' && targetType === 'obj') {
            await api.patch(`/objectives/${targetNode.data.okrId}`, {
              parentId: sourceNode.data.okrId,
            })
            console.log(`Updated objective ${targetNode.data.label} to have parent ${sourceNode.data.label}`)
          }
        }
      } catch (error) {
        console.error('Failed to save connection:', error)
      }
    },
    [nodes, setEdges]
  )

  const onEdgesChange = useCallback(
    async (changes: EdgeChange[]) => {
      // Handle edge deletions
      for (const change of changes) {
        if (change.type === 'remove') {
          const edgeToRemove = edges.find(edge => edge.id === change.id)
          if (edgeToRemove?.data?.type === 'parent-child') {
            // Find the target node and remove its parent relationship
            const targetNode = nodes.find(n => n.id === edgeToRemove.target)
            if (targetNode?.data?.okrId) {
              try {
                await api.patch(`/objectives/${targetNode.data.okrId}`, {
                  parentId: null,
                })
                console.log(`Removed parent relationship from objective ${targetNode.data.label}`)
              } catch (error) {
                console.error('Failed to remove parent relationship:', error)
              }
            }
          }
        }
      }
      
      // Apply the changes to the edges
      onEdgesChangeBase(changes)
    },
    [edges, nodes, onEdgesChangeBase]
  )

  const handleSaveLayout = async () => {
    setLoading(true)
    try {
      // Collect all node positions for batch save
      const layouts = nodes
        .filter(node => node.data.okrId)
        .map(node => {
          const nodeTypePrefix = node.id.split('-')[0]
          const entityType = 
            nodeTypePrefix === 'obj' ? 'OBJECTIVE' :
            nodeTypePrefix === 'kr' ? 'KEY_RESULT' :
            'INITIATIVE'
          
          return {
            entityType,
            entityId: node.data.okrId,
            positionX: node.position.x,
            positionY: node.position.y,
          }
        })

      // Save all positions in a single batch request
      await api.post('/layout/save', { layouts })
      
      alert('Layout saved successfully!')
    } catch (error) {
      console.error('Failed to save layout:', error)
      alert('Failed to save layout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b bg-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Visual OKR Builder</h1>
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-slate-600 text-sm">
                    Drag from the circles on nodes to connect them
                  </p>
                  {!workspaceLoading && currentWorkspace && currentOrganization && 
                   currentWorkspace.organizationId === currentOrganization.id && (
                    <div className="flex items-center gap-2 text-xs bg-slate-100 px-3 py-1 rounded-full">
                      <Building2 className="h-3 w-3 text-slate-600" />
                      <span className="text-slate-700">{currentWorkspace.name}</span>
                      {currentTeam && currentTeam.workspaceId === currentWorkspace.id && (
                        <>
                          <span className="text-slate-400">•</span>
                          <Users className="h-3 w-3 text-slate-600" />
                          <span className="text-slate-700">{currentTeam.name}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <select
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm min-w-[160px]"
                >
                  <option value="all">All Time Periods</option>
                  <optgroup label="Years">
                    {availablePeriods.filter(p => p.period === Period.ANNUAL).map(period => (
                      <option key={period.value} value={period.value}>{period.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Quarters">
                    {availablePeriods.filter(p => p.period === Period.QUARTERLY).map(period => (
                      <option key={period.value} value={period.value}>{period.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Months">
                    {availablePeriods.filter(p => p.period === Period.MONTHLY).map(period => (
                      <option key={period.value} value={period.value}>{period.label}</option>
                    ))}
                  </optgroup>
                </select>
                <Button variant="outline" onClick={() => setShowNodeCreator(!showNodeCreator)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Node
                </Button>
                {savingState === 'saving' && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <div className="animate-spin h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full"></div>
                    Saving...
                  </div>
                )}
                {savingState === 'saved' && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Saved
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 relative">
            <ReactFlow
              nodes={filteredNodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              defaultEdgeOptions={{
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#94a3b8', strokeWidth: 2 },
              }}
            >
              <Background />
              <Controls />
              <MiniMap />
              
              {/* Legend */}
              <Panel position="top-left" className="space-y-3">
                {/* OKR Level Context */}
                <div className="bg-white p-4 rounded-lg shadow-lg">
                  <div className="text-xs font-semibold text-slate-500 mb-2">CREATING OKRS FOR</div>
                  <div className="flex items-center gap-2">
                    {levelDisplay && (
                      <>
                        <levelDisplay.icon className={`h-5 w-5 ${levelDisplay.color}`} />
                        <div>
                          <div className="text-sm font-semibold">{levelDisplay.name}</div>
                          <div className="text-xs text-slate-500">{levelDisplay.label} Level</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Legend */}
                <div className="bg-white p-4 rounded-lg shadow-lg">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold mb-3">Node Types</div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-xs">Objective</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-xs">Key Result</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      <span className="text-xs">Initiative</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-3 pt-3 border-t">
                      💡 Drag from circles to connect
                    </div>
                    <div className="text-xs text-slate-500">
                      ✏️ Hover and click to edit
                    </div>
                  </div>
                </div>
              </Panel>

              {/* Node Creator */}
              {showNodeCreator && (
                <Panel position="top-right" className="bg-white p-4 rounded-lg shadow-lg min-w-[200px]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Add Node</h3>
                    <button onClick={() => setShowNodeCreator(false)}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => handleAddNode('objective')}
                    >
                      <Target className="h-4 w-4 mr-2 text-blue-500" />
                      Objective
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => handleAddNode('keyResult')}
                    >
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                      Key Result
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => handleAddNode('initiative')}
                    >
                      <Lightbulb className="h-4 w-4 mr-2 text-purple-500" />
                      Initiative
                    </Button>
                  </div>
                </Panel>
              )}
            </ReactFlow>
          </div>
        </div>

        {/* Backdrop */}
        {editingNode && (
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => {
              setEditingNode(null)
              setEditingFormData(null)
            }}
          />
        )}

        {/* Edit Panel - Slide-out from right */}
        <EditPanel
          isOpen={!!editingNode}
          onClose={() => {
            setEditingNode(null)
            setEditingFormData(null)
          }}
          nodeId={editingNode?.id || null}
          nodeData={editingNode?.data || null}
          onSave={async (nodeId, updatedData) => {
            await handleSaveNode(nodeId, updatedData)
            setEditingNode(null)
            setEditingFormData(null)
          }}
          onDelete={handleDeleteNode}
          formData={editingFormData}
          setFormData={setEditingFormData}
          canEdit={editingNode && editingFormData ? (() => {
            const nodeType = editingNode.id.startsWith('obj') ? 'obj' : editingNode.id.startsWith('kr') ? 'kr' : 'init'
            if (nodeType === 'obj') {
              return tenantPermissions.canEditObjective({
                id: editingFormData.okrId as string || '',
                ownerId: editingFormData.ownerId as string || '',
                organizationId: editingFormData.organizationId as string | null || null,
                workspaceId: editingFormData.workspaceId as string | null || null,
                teamId: editingFormData.teamId as string | null || null,
                isPublished: editingFormData.isPublished as boolean || false,
                cycle: editingFormData.cycle as { id: string; status: string } | null || null,
                cycleStatus: editingFormData.cycleStatus as string | null || null,
              })
            } else if (nodeType === 'kr') {
              return tenantPermissions.canEditKeyResult({
                id: editingFormData.okrId as string || '',
                ownerId: editingFormData.ownerId as string || '',
                organizationId: editingFormData.organizationId as string | null || null,
                workspaceId: editingFormData.workspaceId as string | null || null,
                teamId: editingFormData.teamId as string | null || null,
                parentObjective: editingFormData.parentObjective as Record<string, unknown> || null,
              })
            }
            return true // Initiatives don't have lock logic yet
          })() : true}
          canDelete={editingNode && editingFormData ? (() => {
            const nodeType = editingNode.id.startsWith('obj') ? 'obj' : editingNode.id.startsWith('kr') ? 'kr' : 'init'
            if (nodeType === 'obj') {
              return tenantPermissions.canDeleteObjective({
                id: editingFormData.okrId as string || '',
                ownerId: editingFormData.ownerId as string || '',
                organizationId: editingFormData.organizationId as string | null || null,
                workspaceId: editingFormData.workspaceId as string | null || null,
                teamId: editingFormData.teamId as string | null || null,
                isPublished: editingFormData.isPublished as boolean || false,
                cycle: editingFormData.cycle as { id: string; status: string } | null || null,
                cycleStatus: editingFormData.cycleStatus as string | null || null,
              })
            } else if (nodeType === 'kr') {
              // Key results inherit delete permission from parent objective
              return tenantPermissions.canDeleteObjective({
                id: (editingFormData.parentObjective as Record<string, unknown>)?.id as string || '',
                ownerId: editingFormData.ownerId as string || '',
                organizationId: editingFormData.organizationId as string | null || null,
                workspaceId: editingFormData.workspaceId as string | null || null,
                teamId: editingFormData.teamId as string | null || null,
                isPublished: (editingFormData.parentObjective as Record<string, unknown>)?.isPublished as boolean || false,
                cycle: (editingFormData.parentObjective as Record<string, unknown>)?.cycle as { id: string; status: string } | null || null,
                cycleStatus: (editingFormData.parentObjective as Record<string, unknown>)?.cycleStatus as string | null || null,
              })
            }
            return true // Initiatives don't have lock logic yet
          })() : true}
          lockMessage={editingNode && editingFormData ? (() => {
            const nodeType = editingNode.id.startsWith('obj') ? 'obj' : editingNode.id.startsWith('kr') ? 'kr' : 'init'
            if (nodeType === 'obj') {
              const lockInfo = tenantPermissions.getLockInfoForObjective({
                id: editingFormData.okrId as string || '',
                ownerId: editingFormData.ownerId as string || '',
                organizationId: editingFormData.organizationId as string | null || null,
                workspaceId: editingFormData.workspaceId as string | null || null,
                teamId: editingFormData.teamId as string | null || null,
                isPublished: editingFormData.isPublished as boolean || false,
                cycle: editingFormData.cycle as { id: string; status: string } | null || null,
                cycleStatus: editingFormData.cycleStatus as string | null || null,
              })
              return lockInfo.isLocked ? lockInfo.message : undefined
            } else if (nodeType === 'kr') {
              const lockInfo = tenantPermissions.getLockInfoForKeyResult({
                id: editingFormData.okrId as string || '',
                ownerId: editingFormData.ownerId as string || '',
                organizationId: editingFormData.organizationId as string | null || null,
                workspaceId: editingFormData.workspaceId as string | null || null,
                teamId: editingFormData.teamId as string | null || null,
                parentObjective: editingFormData.parentObjective as Record<string, unknown> || null,
              })
              return lockInfo.isLocked ? lockInfo.message : undefined
            }
            return undefined
          })() : undefined}
        >
          {editingFormData && editingNode && (
            <EditFormTabs
              nodeId={editingNode.id}
              nodeType={editingNode.id.startsWith('obj') ? 'obj' : editingNode.id.startsWith('kr') ? 'kr' : 'init'}
              data={editingNode.data}
              formData={editingFormData}
              setFormData={setEditingFormData}
              onSave={() => handleSaveNode(editingNode.id, editingFormData)}
            />
          )}
        </EditPanel>
      </DashboardLayout>
    </ProtectedRoute>
  )
}

function EditNodeForm({
  nodeId,
  data,
  onSave,
  onCancel,
  onDelete,
}: {
  nodeId: string
  data: any
  onSave: (id: string, data: any) => void
  onCancel: () => void
  onDelete: (id: string) => void
}) {
  const { 
    organizations,
    workspaces, 
    teams,
    defaultOKRContext 
  } = useWorkspace()
  const { user } = useAuth()
  
  // Initialize smart selectors based on existing date or defaults
  const initStartDate = data.startDate ? new Date(data.startDate) : new Date()
  const initPeriod = data.period || Period.QUARTERLY
  
  const [formData, setFormData] = useState({
    label: data.label || '',
    description: data.description || '',
    okrId: data.okrId || '', // CRITICAL: Must preserve okrId to distinguish update vs create
    ownerId: data.ownerId || user?.id || '',
    ownerName: data.ownerName || user?.name || '',
    organizationId: data.organizationId || defaultOKRContext.organizationId || '',
    workspaceId: data.workspaceId || defaultOKRContext.workspaceId || '',
    teamId: data.teamId || defaultOKRContext.teamId || '',
    parentId: data.parentId || '',
    progress: data.progress || 0,
    current: data.current || 0,
    target: data.target || 100,
    unit: data.unit || 'units',
    status: data.status || 'NOT_STARTED',
    metricType: data.metricType || 'INCREASE',
    period: initPeriod,
    startDate: data.startDate || formatDateForInput(new Date()),
    endDate: data.endDate || formatDateForInput(calculateEndDate(new Date(), initPeriod)),
    // Smart selectors
    quarter: getQuarterFromDate(initStartDate),
    month: initStartDate.getMonth(),
    year: initStartDate.getFullYear(),
  })
  
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)
  const [showContextDropdown, setShowContextDropdown] = useState(false)
  const [showParentDropdown, setShowParentDropdown] = useState(false)
  const [ownerSearch, setOwnerSearch] = useState('')
  const [contextSearch, setContextSearch] = useState('')
  const [parentSearch, setParentSearch] = useState('')
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [availableObjectives, setAvailableObjectives] = useState<any[]>([])
  
  const nodeType = nodeId.split('-')[0]
  console.log('EditNodeForm - nodeId:', nodeId, 'nodeType:', nodeType)

  // Load available users for owner selection
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await api.get('/users')
        setAvailableUsers(response.data)
      } catch (error) {
        console.error('Failed to load users:', error)
      }
    }
    loadUsers()
  }, [])

  // Load available objectives for parent selection
  useEffect(() => {
    const loadObjectives = async () => {
      try {
        const queryParams = currentOrganization?.id ? `?organizationId=${currentOrganization.id}` : ''
        const response = await api.get(`/objectives${queryParams}`)
        setAvailableObjectives(response.data)
      } catch (error) {
        console.error('Failed to load objectives:', error)
      }
    }
    loadObjectives()
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.dropdown-container')) {
        setShowOwnerDropdown(false)
        setShowContextDropdown(false)
        setShowParentDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getContextDisplay = () => {
    if (formData.organizationId && !formData.workspaceId && !formData.teamId) {
      const org = organizations.find(o => o.id === formData.organizationId)
      return `🏢 ${org?.name || 'Organization'}`
    }
    if (formData.workspaceId && !formData.teamId) {
      const ws = workspaces.find(w => w.id === formData.workspaceId)
      return `💼 ${ws?.name || 'Workspace'}`
    }
    if (formData.teamId) {
      const team = teams.find(t => t.id === formData.teamId)
      return `👥 ${team?.name || 'Team'}`
    }
    return '👤 Personal'
  }

  const getOwnerDisplay = () => {
    if (formData.ownerId === user?.id) {
      return `👤 ${user?.name || 'You'}`
    }
    const selectedUser = availableUsers.find(u => u.id === formData.ownerId)
    return selectedUser ? `👤 ${selectedUser.name}` : 'Select owner...'
  }

  const getParentDisplay = () => {
    if (!formData.parentId) {
      return 'No parent (top-level objective)'
    }
    const parentObjective = availableObjectives.find(obj => obj.id === formData.parentId)
    return parentObjective ? `🎯 ${parentObjective.title}` : 'Select parent objective...'
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="label">
          {nodeType === 'obj' ? 'Objective' : nodeType === 'kr' ? 'Key Result' : 'Initiative'} Title *
        </Label>
        <Input
          id="label"
          value={formData.label || ''}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          placeholder="Enter title..."
        />
      </div>

      {nodeType === 'obj' && (
        <>
          <div>
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What do you want to achieve?"
            />
          </div>

          {/* Owner Selection */}
          <div>
            <Label>Owner</Label>
            <div className="relative dropdown-container">
              <button
                type="button"
                onClick={() => setShowOwnerDropdown(!showOwnerDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-transparent hover:bg-slate-50"
              >
                <span>{getOwnerDisplay()}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </button>
              {showOwnerDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-input rounded-md shadow-lg">
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search users..."
                        value={ownerSearch}
                        onChange={(e) => setOwnerSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {/* Current user option */}
                    <button
                      onClick={() => {
                        setFormData({ ...formData, ownerId: user?.id || '', ownerName: user?.name || '' })
                        setShowOwnerDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                    >
                      <User className="h-4 w-4" />
                      {user?.name || 'You'} (You)
                    </button>
                    {/* Other users */}
                    {availableUsers
                      .filter(u => u.id !== user?.id && u.name.toLowerCase().includes(ownerSearch.toLowerCase()))
                      .map((user) => (
                        <button
                          key={user.id}
                          onClick={() => {
                            setFormData({ ...formData, ownerId: user.id, ownerName: user.name })
                            setShowOwnerDropdown(false)
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        >
                          <User className="h-4 w-4" />
                          {user.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Context Selection */}
          <div>
            <Label>Assign To</Label>
            <div className="relative dropdown-container">
              <button
                type="button"
                onClick={() => setShowContextDropdown(!showContextDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-transparent hover:bg-slate-50"
              >
                <span>{getContextDisplay()}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </button>
              {showContextDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-input rounded-md shadow-lg">
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search context..."
                        value={contextSearch}
                        onChange={(e) => setContextSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {/* Personal */}
                    <button
                      onClick={() => {
                        setFormData({ ...formData, organizationId: '', workspaceId: '', teamId: '' })
                        setShowContextDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                    >
                      <User className="h-4 w-4" />
                      Personal
                    </button>
                    
                    {/* Organization */}
                    {organizations
                      .filter(org => org.name.toLowerCase().includes(contextSearch.toLowerCase()))
                      .map((org) => (
                        <button
                          key={org.id}
                          onClick={() => {
                            setFormData({ ...formData, organizationId: org.id, workspaceId: '', teamId: '' })
                            setShowContextDropdown(false)
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Building2 className="h-4 w-4" />
                          {org.name} (Organization)
                        </button>
                      ))}
                    
                    {/* Workspaces */}
                    {workspaces
                      .filter(ws => ws.name.toLowerCase().includes(contextSearch.toLowerCase()))
                      .map((ws) => (
                        <button
                          key={ws.id}
                          onClick={() => {
                            setFormData({ ...formData, organizationId: '', workspaceId: ws.id, teamId: '' })
                            setShowContextDropdown(false)
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Building2 className="h-4 w-4" />
                          {ws.name} (Workspace)
                        </button>
                      ))}
                    
                    {/* Teams */}
                    {teams
                      .filter(team => team.name.toLowerCase().includes(contextSearch.toLowerCase()))
                      .map((team) => (
                        <button
                          key={team.id}
                          onClick={() => {
                            setFormData({ ...formData, organizationId: '', workspaceId: '', teamId: team.id })
                            setShowContextDropdown(false)
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Users className="h-4 w-4" />
                          {team.name} (Team)
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Parent Objective Selection */}
          <div>
            <Label>Parent Objective (Optional)</Label>
            <div className="relative dropdown-container">
              <button
                type="button"
                onClick={() => setShowParentDropdown(!showParentDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-transparent hover:bg-slate-50"
              >
                <span>{getParentDisplay()}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </button>
              {showParentDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-input rounded-md shadow-lg">
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search objectives..."
                        value={parentSearch}
                        onChange={(e) => setParentSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {/* No parent option */}
                    <button
                      onClick={() => {
                        setFormData({ ...formData, parentId: '' })
                        setShowParentDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Target className="h-4 w-4" />
                      No parent (top-level objective)
                    </button>
                    
                    {/* Available objectives */}
                    {availableObjectives
                      .filter(obj => 
                        obj.id !== data.id && // Don't allow self as parent
                        obj.title.toLowerCase().includes(parentSearch.toLowerCase())
                      )
                      .map((objective) => (
                        <button
                          key={objective.id}
                          onClick={() => {
                            setFormData({ ...formData, parentId: objective.id })
                            setShowParentDropdown(false)
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Target className="h-4 w-4" />
                          <div className="flex flex-col">
                            <span className="font-medium">{objective.title}</span>
                            <span className="text-xs text-slate-500">
                              {objective.organization?.name || objective.workspace?.name || objective.team?.name || 'Personal'}
                            </span>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="progress">Progress (%)</Label>
            <Input
              id="progress"
              type="number"
              min="0"
              max="100"
              value={formData.progress || 0}
              onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>

          {/* Time Frame Section */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-slate-600" />
              <Label className="text-sm font-semibold">Time Frame</Label>
            </div>

            <div>
              <Label htmlFor="period">Period Type</Label>
              <select
                id="period"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.period || Period.QUARTERLY}
                onChange={(e) => {
                  const newPeriod = e.target.value as Period
                  let dates = { startDate: formData.startDate, endDate: formData.endDate }
                  
                  // Auto-calculate dates based on new period
                  if (newPeriod === Period.QUARTERLY) {
                    const quarterDates = getQuarterDates(formData.quarter, formData.year)
                    dates = {
                      startDate: formatDateForInput(quarterDates.startDate),
                      endDate: formatDateForInput(quarterDates.endDate)
                    }
                  } else if (newPeriod === Period.MONTHLY) {
                    const monthDates = getMonthDates(formData.month, formData.year)
                    dates = {
                      startDate: formatDateForInput(monthDates.startDate),
                      endDate: formatDateForInput(monthDates.endDate)
                    }
                  } else if (newPeriod === Period.ANNUAL) {
                    const yearDates = getYearDates(formData.year)
                    dates = {
                      startDate: formatDateForInput(yearDates.startDate),
                      endDate: formatDateForInput(yearDates.endDate)
                    }
                  }
                  
                  setFormData({ 
                    ...formData, 
                    period: newPeriod,
                    ...dates
                  })
                }}
              >
                <option value={Period.MONTHLY}>Monthly</option>
                <option value={Period.QUARTERLY}>Quarterly</option>
                <option value={Period.ANNUAL}>Annual</option>
                <option value={Period.CUSTOM}>Custom Date Range</option>
              </select>
            </div>

            {/* Smart Selectors for Quarterly */}
            {formData.period === Period.QUARTERLY && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <Label htmlFor="quarter">Quarter</Label>
                  <select
                    id="quarter"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={formData.quarter}
                    onChange={(e) => {
                      const newQuarter = parseInt(e.target.value)
                      const dates = getQuarterDates(newQuarter, formData.year)
                      setFormData({
                        ...formData,
                        quarter: newQuarter,
                        startDate: formatDateForInput(dates.startDate),
                        endDate: formatDateForInput(dates.endDate)
                      })
                    }}
                  >
                    <option value={1}>Q1 (Jan - Mar)</option>
                    <option value={2}>Q2 (Apr - Jun)</option>
                    <option value={3}>Q3 (Jul - Sep)</option>
                    <option value={4}>Q4 (Oct - Dec)</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="year">Year</Label>
                  <select
                    id="year"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={formData.year}
                    onChange={(e) => {
                      const newYear = parseInt(e.target.value)
                      const dates = getQuarterDates(formData.quarter, newYear)
                      setFormData({
                        ...formData,
                        year: newYear,
                        startDate: formatDateForInput(dates.startDate),
                        endDate: formatDateForInput(dates.endDate)
                      })
                    }}
                  >
                    {getAvailableYears().map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Smart Selectors for Monthly */}
            {formData.period === Period.MONTHLY && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <Label htmlFor="month">Month</Label>
                  <select
                    id="month"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={formData.month}
                    onChange={(e) => {
                      const newMonth = parseInt(e.target.value)
                      const dates = getMonthDates(newMonth, formData.year)
                      setFormData({
                        ...formData,
                        month: newMonth,
                        startDate: formatDateForInput(dates.startDate),
                        endDate: formatDateForInput(dates.endDate)
                      })
                    }}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i}>{getMonthName(i)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="year">Year</Label>
                  <select
                    id="year"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={formData.year}
                    onChange={(e) => {
                      const newYear = parseInt(e.target.value)
                      const dates = getMonthDates(formData.month, newYear)
                      setFormData({
                        ...formData,
                        year: newYear,
                        startDate: formatDateForInput(dates.startDate),
                        endDate: formatDateForInput(dates.endDate)
                      })
                    }}
                  >
                    {getAvailableYears().map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Smart Selector for Annual */}
            {formData.period === Period.ANNUAL && (
              <div className="mt-3">
                <Label htmlFor="year">Year</Label>
                <select
                  id="year"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.year}
                  onChange={(e) => {
                    const newYear = parseInt(e.target.value)
                    const dates = getYearDates(newYear)
                    setFormData({
                      ...formData,
                      year: newYear,
                      startDate: formatDateForInput(dates.startDate),
                      endDate: formatDateForInput(dates.endDate)
                    })
                  }}
                >
                  {getAvailableYears().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Manual Date Pickers for Custom */}
            {formData.period === Period.CUSTOM && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Duration Display */}
            {formData.startDate && formData.endDate && (
              <div className="bg-slate-50 p-3 rounded-md mt-3">
                <div className="text-xs text-slate-600">
                  <strong>Duration:</strong> {formatPeriod(formData.period as Period, formData.startDate)}
                  {' • '}
                  {Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                  {' • '}
                  {new Date(formData.startDate).toLocaleDateString()} - {new Date(formData.endDate).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {nodeType === 'kr' && (
        <>
          {/* Title */}
          <div>
            <Label htmlFor="label">Key Result Title *</Label>
            <Input
              id="label"
              value={formData.label || ''}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Enter key result..."
            />
          </div>

          {/* Owner Selection */}
          <div>
            <Label>Owner</Label>
            <div className="relative dropdown-container">
              <button
                type="button"
                onClick={() => setShowOwnerDropdown(!showOwnerDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-transparent hover:bg-slate-50"
              >
                <span>{getOwnerDisplay()}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </button>
              {showOwnerDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-input rounded-md shadow-lg">
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search users..."
                        value={ownerSearch}
                        onChange={(e) => setOwnerSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {/* Current user option */}
                    <button
                      onClick={() => {
                        setFormData({ ...formData, ownerId: user?.id || '', ownerName: user?.name || '' })
                        setShowOwnerDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                    >
                      <User className="h-4 w-4" />
                      {user?.name || 'You'} (You)
                    </button>
                    {/* Other users */}
                    {availableUsers
                      .filter(u => u.id !== user?.id && u.name.toLowerCase().includes(ownerSearch.toLowerCase()))
                      .map((user) => (
                        <button
                          key={user.id}
                          onClick={() => {
                            setFormData({ ...formData, ownerId: user.id, ownerName: user.name })
                            setShowOwnerDropdown(false)
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        >
                          <User className="h-4 w-4" />
                          {user.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="metricType">Metric Type</Label>
            <select
              id="metricType"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={formData.metricType || 'INCREASE'}
              onChange={(e) => setFormData({ ...formData, metricType: e.target.value })}
            >
              <option value="INCREASE">Increase</option>
              <option value="DECREASE">Decrease</option>
              <option value="REACH">Reach</option>
              <option value="MAINTAIN">Maintain</option>
            </select>
          </div>

          <div>
            <Label htmlFor="unit">Unit</Label>
            <Input
              id="unit"
              value={formData.unit || ''}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              placeholder="e.g., users, %, items, $"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="current">Current Value</Label>
              <Input
                id="current"
                type="number"
                value={formData.current || 0}
                onChange={(e) => setFormData({ ...formData, current: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label htmlFor="target">Target Value *</Label>
              <Input
                id="target"
                type="number"
                value={formData.target || 100}
                onChange={(e) => setFormData({ ...formData, target: parseFloat(e.target.value) || 100 })}
              />
            </div>
          </div>
          <div className="bg-slate-50 p-3 rounded-md">
            <div className="text-sm font-medium mb-1">Progress</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ 
                    width: `${Math.min(100, ((formData.current || 0) / (formData.target || 1)) * 100)}%` 
                  }}
                />
              </div>
              <span className="text-sm font-medium">
                {Math.round(((formData.current || 0) / (formData.target || 1)) * 100)}%
              </span>
            </div>
          </div>

          {/* Time Frame Section for Key Results */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-slate-600" />
              <Label className="text-sm font-semibold">Time Frame (Optional)</Label>
            </div>

            <div>
              <Label htmlFor="period">Period Type</Label>
              <select
                id="period"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.period || ''}
                onChange={(e) => {
                  const newPeriod = e.target.value as Period
                  if (!newPeriod) {
                    setFormData({ ...formData, period: undefined, startDate: undefined, endDate: undefined })
                  } else {
                    let dates = { startDate: formData.startDate, endDate: formData.endDate }
                    if (newPeriod === Period.QUARTERLY) {
                      const quarterDates = getQuarterDates(formData.quarter, formData.year)
                      dates = {
                        startDate: formatDateForInput(quarterDates.startDate),
                        endDate: formatDateForInput(quarterDates.endDate)
                      }
                    } else if (newPeriod === Period.MONTHLY) {
                      const monthDates = getMonthDates(formData.month, formData.year)
                      dates = {
                        startDate: formatDateForInput(monthDates.startDate),
                        endDate: formatDateForInput(monthDates.endDate)
                      }
                    } else if (newPeriod === Period.ANNUAL) {
                      const yearDates = getYearDates(formData.year)
                      dates = {
                        startDate: formatDateForInput(yearDates.startDate),
                        endDate: formatDateForInput(yearDates.endDate)
                      }
                    }
                    setFormData({ ...formData, period: newPeriod, ...dates })
                  }
                }}
              >
                <option value="">No specific period</option>
                <option value={Period.MONTHLY}>Monthly</option>
                <option value={Period.QUARTERLY}>Quarterly</option>
                <option value={Period.ANNUAL}>Annual</option>
                <option value={Period.CUSTOM}>Custom Date Range</option>
              </select>
            </div>

            {formData.period && formData.period === Period.QUARTERLY && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <Label htmlFor="quarter">Quarter</Label>
                  <select id="quarter" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formData.quarter} onChange={(e) => {
                    const newQuarter = parseInt(e.target.value); const dates = getQuarterDates(newQuarter, formData.year); setFormData({...formData, quarter: newQuarter, startDate: formatDateForInput(dates.startDate), endDate: formatDateForInput(dates.endDate)})
                  }}>
                    <option value={1}>Q1 (Jan - Mar)</option><option value={2}>Q2 (Apr - Jun)</option><option value={3}>Q3 (Jul - Sep)</option><option value={4}>Q4 (Oct - Dec)</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="year">Year</Label>
                  <select id="year" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formData.year} onChange={(e) => {
                    const newYear = parseInt(e.target.value); const dates = getQuarterDates(formData.quarter, newYear); setFormData({...formData, year: newYear, startDate: formatDateForInput(dates.startDate), endDate: formatDateForInput(dates.endDate)})
                  }}>
                    {getAvailableYears().map(year => (<option key={year} value={year}>{year}</option>))}
                  </select>
                </div>
              </div>
            )}

            {formData.period && formData.period === Period.MONTHLY && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <Label htmlFor="month">Month</Label>
                  <select id="month" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formData.month} onChange={(e) => {
                    const newMonth = parseInt(e.target.value); const dates = getMonthDates(newMonth, formData.year); setFormData({...formData, month: newMonth, startDate: formatDateForInput(dates.startDate), endDate: formatDateForInput(dates.endDate)})
                  }}>
                    {Array.from({ length: 12 }, (_, i) => (<option key={i} value={i}>{getMonthName(i)}</option>))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="year">Year</Label>
                  <select id="year" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formData.year} onChange={(e) => {
                    const newYear = parseInt(e.target.value); const dates = getMonthDates(formData.month, newYear); setFormData({...formData, year: newYear, startDate: formatDateForInput(dates.startDate), endDate: formatDateForInput(dates.endDate)})
                  }}>
                    {getAvailableYears().map(year => (<option key={year} value={year}>{year}</option>))}
                  </select>
                </div>
              </div>
            )}

            {formData.period && formData.period === Period.ANNUAL && (
              <div className="mt-3">
                <Label htmlFor="year">Year</Label>
                <select id="year" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formData.year} onChange={(e) => {
                  const newYear = parseInt(e.target.value); const dates = getYearDates(newYear); setFormData({...formData, year: newYear, startDate: formatDateForInput(dates.startDate), endDate: formatDateForInput(dates.endDate)})
                }}>
                  {getAvailableYears().map(year => (<option key={year} value={year}>{year}</option>))}
                </select>
              </div>
            )}

            {formData.period && formData.period === Period.CUSTOM && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} />
                </div>
              </div>
            )}

            {formData.period && formData.startDate && formData.endDate && (
              <div className="bg-slate-50 p-3 rounded-md mt-3">
                <div className="text-xs text-slate-600">
                  <strong>Duration:</strong> {formatPeriod(formData.period as Period, formData.startDate)} • {Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24))} days • {new Date(formData.startDate).toLocaleDateString()} - {new Date(formData.endDate).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {nodeType === 'init' && (
        <>
          {/* Owner Selection */}
          <div>
            <Label>Owner</Label>
            <div className="relative dropdown-container">
              <button
                type="button"
                onClick={() => setShowOwnerDropdown(!showOwnerDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-transparent hover:bg-slate-50"
              >
                <span>{getOwnerDisplay()}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </button>
              {showOwnerDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-input rounded-md shadow-lg">
                  <div className="p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search users..."
                        value={ownerSearch}
                        onChange={(e) => setOwnerSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {/* Current user option */}
                    <button
                      onClick={() => {
                        setFormData({ ...formData, ownerId: user?.id || '', ownerName: user?.name || '' })
                        setShowOwnerDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                    >
                      <User className="h-4 w-4" />
                      {user?.name || 'You'} (You)
                    </button>
                    {/* Other users */}
                    {availableUsers
                      .filter(u => u.id !== user?.id && u.name.toLowerCase().includes(ownerSearch.toLowerCase()))
                      .map((user) => (
                        <button
                          key={user.id}
                          onClick={() => {
                            setFormData({ ...formData, ownerId: user.id, ownerName: user.name })
                            setShowOwnerDropdown(false)
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        >
                          <User className="h-4 w-4" />
                          {user.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={formData.status || 'NOT_STARTED'}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>

          {/* Time Frame Section for Initiatives */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-slate-600" />
              <Label className="text-sm font-semibold">Time Frame (Optional)</Label>
            </div>

            <div>
              <Label htmlFor="period">Period Type</Label>
              <select
                id="period"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.period || ''}
                onChange={(e) => {
                  const newPeriod = e.target.value as Period
                  if (!newPeriod) {
                    setFormData({ ...formData, period: undefined, startDate: undefined, endDate: undefined })
                  } else {
                    let dates = { startDate: formData.startDate, endDate: formData.endDate }
                    if (newPeriod === Period.QUARTERLY) {
                      const quarterDates = getQuarterDates(formData.quarter, formData.year)
                      dates = { startDate: formatDateForInput(quarterDates.startDate), endDate: formatDateForInput(quarterDates.endDate) }
                    } else if (newPeriod === Period.MONTHLY) {
                      const monthDates = getMonthDates(formData.month, formData.year)
                      dates = { startDate: formatDateForInput(monthDates.startDate), endDate: formatDateForInput(monthDates.endDate) }
                    } else if (newPeriod === Period.ANNUAL) {
                      const yearDates = getYearDates(formData.year)
                      dates = { startDate: formatDateForInput(yearDates.startDate), endDate: formatDateForInput(yearDates.endDate) }
                    }
                    setFormData({ ...formData, period: newPeriod, ...dates })
                  }
                }}
              >
                <option value="">No specific period</option>
                <option value={Period.MONTHLY}>Monthly</option>
                <option value={Period.QUARTERLY}>Quarterly</option>
                <option value={Period.ANNUAL}>Annual</option>
                <option value={Period.CUSTOM}>Custom Date Range</option>
              </select>
            </div>

            {formData.period && formData.period === Period.QUARTERLY && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div><Label htmlFor="quarter">Quarter</Label><select id="quarter" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formData.quarter} onChange={(e) => { const newQuarter = parseInt(e.target.value); const dates = getQuarterDates(newQuarter, formData.year); setFormData({...formData, quarter: newQuarter, startDate: formatDateForInput(dates.startDate), endDate: formatDateForInput(dates.endDate)}) }}><option value={1}>Q1 (Jan - Mar)</option><option value={2}>Q2 (Apr - Jun)</option><option value={3}>Q3 (Jul - Sep)</option><option value={4}>Q4 (Oct - Dec)</option></select></div>
                <div><Label htmlFor="year">Year</Label><select id="year" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formData.year} onChange={(e) => { const newYear = parseInt(e.target.value); const dates = getQuarterDates(formData.quarter, newYear); setFormData({...formData, year: newYear, startDate: formatDateForInput(dates.startDate), endDate: formatDateForInput(dates.endDate)}) }}>{getAvailableYears().map(year => (<option key={year} value={year}>{year}</option>))}</select></div>
              </div>
            )}

            {formData.period && formData.period === Period.MONTHLY && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div><Label htmlFor="month">Month</Label><select id="month" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formData.month} onChange={(e) => { const newMonth = parseInt(e.target.value); const dates = getMonthDates(newMonth, formData.year); setFormData({...formData, month: newMonth, startDate: formatDateForInput(dates.startDate), endDate: formatDateForInput(dates.endDate)}) }}>{Array.from({ length: 12 }, (_, i) => (<option key={i} value={i}>{getMonthName(i)}</option>))}</select></div>
                <div><Label htmlFor="year">Year</Label><select id="year" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formData.year} onChange={(e) => { const newYear = parseInt(e.target.value); const dates = getMonthDates(formData.month, newYear); setFormData({...formData, year: newYear, startDate: formatDateForInput(dates.startDate), endDate: formatDateForInput(dates.endDate)}) }}>{getAvailableYears().map(year => (<option key={year} value={year}>{year}</option>))}</select></div>
              </div>
            )}

            {formData.period && formData.period === Period.ANNUAL && (
              <div className="mt-3"><Label htmlFor="year">Year</Label><select id="year" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formData.year} onChange={(e) => { const newYear = parseInt(e.target.value); const dates = getYearDates(newYear); setFormData({...formData, year: newYear, startDate: formatDateForInput(dates.startDate), endDate: formatDateForInput(dates.endDate)}) }}>{getAvailableYears().map(year => (<option key={year} value={year}>{year}</option>))}</select></div>
            )}

            {formData.period && formData.period === Period.CUSTOM && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div><Label htmlFor="startDate">Start Date</Label><Input id="startDate" type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} /></div>
                <div><Label htmlFor="endDate">End Date</Label><Input id="endDate" type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} /></div>
              </div>
            )}

            {formData.period && formData.startDate && formData.endDate && (
              <div className="bg-slate-50 p-3 rounded-md mt-3">
                <div className="text-xs text-slate-600">
                  <strong>Duration:</strong> {formatPeriod(formData.period as Period, formData.startDate)} • {Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24))} days • {new Date(formData.startDate).toLocaleDateString()} - {new Date(formData.endDate).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex gap-2 justify-between pt-4 border-t">
        <Button variant="destructive" size="sm" onClick={() => onDelete(nodeId)}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onSave(nodeId, formData)}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
