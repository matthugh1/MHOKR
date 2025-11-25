'use client'

import React, { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'
import { 
  ChevronRight, 
  ChevronDown, 
  Target, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  MoreHorizontal, 
  Activity,
  Zap,
  Users,
  Layers,
  ArrowUpRight,
  Calendar,
  MessageSquare,
  BarChart3
} from 'lucide-react'
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'
import { useToast } from '@/hooks/use-toast'
import { useHierarchyOKRs } from '../hierarchy/hooks/useHierarchyOKRs'
import { HierarchyOKRNode } from '../hierarchy/components/types'
import { getNodePath } from '../hierarchy/components/utils/transformToHierarchy'
import { NewCheckInModal } from '@/components/okr/NewCheckInModal'
import { EditObjectiveModal } from '@/components/okr/EditObjectiveModal'
import { NewObjectiveModal } from '@/components/okr/NewObjectiveModal'
import api from '@/lib/api'

// Map backend status to UI status
const mapStatus = (status: string): 'on-track' | 'at-risk' | 'off-track' => {
  switch (status) {
    case 'ON_TRACK':
      return 'on-track'
    case 'AT_RISK':
      return 'at-risk'
    case 'OFF_TRACK':
      return 'off-track'
    case 'COMPLETED':
      return 'on-track'
    case 'CANCELLED':
      return 'off-track'
    default:
      return 'on-track'
  }
}

// Convert HierarchyOKRNode to test page's OKRItem format
const convertNodeToItem = (node: HierarchyOKRNode, expandedIds: Set<string>): any => {
  return {
    id: node.id,
    type: node.type === 'objective' ? 'objective' : 'kr',
    level: node.parentId ? 'team' : 'company', // Simplified level detection
    title: node.title,
    owner: node.owner?.name || 'Unassigned',
    status: mapStatus(node.status),
    progress: node.progress,
    expanded: expandedIds.has(node.id),
    description: undefined, // Can be added if available in API
    lastUpdated: undefined, // Can be added if available in API
    current: node.currentValue ?? undefined,
    target: node.targetValue ?? undefined,
    unit: node.unit ?? undefined,
    aiInsight: undefined, // Can be added if available
    children: node.children.map(child => convertNodeToItem(child, expandedIds)),
    // Store original node for API calls
    _originalNode: node,
  }
}

interface StatusBadgeProps {
  status: 'on-track' | 'at-risk' | 'off-track'
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const styles = {
    'on-track': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'at-risk': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'off-track': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  }
  
  const labels = {
    'on-track': 'On Track',
    'at-risk': 'At Risk',
    'off-track': 'Off Track',
  }
  
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[status] || styles['on-track']} flex items-center gap-1`}>
      <div className={`w-1.5 h-1.5 rounded-full ${status === 'on-track' ? 'bg-emerald-400' : status === 'at-risk' ? 'bg-amber-400' : 'bg-rose-400'}`} />
      {labels[status]}
    </span>
  )
}

interface ProgressBarProps {
  value: number
  status: 'on-track' | 'at-risk' | 'off-track'
}

const ProgressBar = ({ value, status }: ProgressBarProps) => {
  let color = 'bg-emerald-500'
  if (status === 'at-risk') color = 'bg-amber-500'
  if (status === 'off-track') color = 'bg-rose-500'
  
  return (
    <div className="h-2 w-full bg-slate-700/50 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

interface OKRItem {
  id: string
  type: 'objective' | 'kr'
  level?: 'company' | 'team'
  title: string
  owner: string
  status: 'on-track' | 'at-risk' | 'off-track'
  progress: number
  expanded?: boolean
  children?: OKRItem[]
  current?: number
  target?: number
  unit?: string
  description?: string
  lastUpdated?: string
  aiInsight?: string
  _originalNode?: HierarchyOKRNode
}

function OKRTestPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentOrganization } = useWorkspace()
  const { user } = useAuth()
  const { toast } = useToast()

  // Filter states from URL
  const selectedCycleId = searchParams.get('cycleId')
  const selectedStatus = searchParams.get('status') as string | null
  const selectedScope = (searchParams.get('scope') as 'my' | 'team-workspace' | 'tenant') || 'tenant'
  const searchQuery = searchParams.get('search') || ''

  // Local state
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [checkInValue, setCheckInValue] = useState<string>('')
  const [checkInConfidence, setCheckInConfidence] = useState<string>('50')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkInModalOpen, setCheckInModalOpen] = useState(false)
  const [checkInKrId, setCheckInKrId] = useState<string | null>(null)
  const [editObjectiveModalOpen, setEditObjectiveModalOpen] = useState(false)
  const [editObjectiveId, setEditObjectiveId] = useState<string | null>(null)
  const [newObjectiveModalOpen, setNewObjectiveModalOpen] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [activeCycles, setActiveCycles] = useState<Array<{
    id: string
    name: string
    status: string
    startDate: string
    endDate: string
    tenantId: string
  }>>([])

  // Fetch OKR data
  const { treeData, loading, error, refetch } = useHierarchyOKRs({
    tenantId: currentOrganization?.id || null,
    cycleId: selectedCycleId,
    status: selectedStatus,
    scope: selectedScope,
    searchQuery,
    enabled: !!currentOrganization?.id,
  })

  // Load users and cycles
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await api.get('/users')
        setAvailableUsers(response.data || [])
      } catch (error: any) {
        if (error.response?.status !== 403) {
          console.error('Failed to load users:', error)
        }
        setAvailableUsers([])
      }
    }

    const loadCycles = async () => {
      try {
        const response = await api.get('/reports/cycles')
        const cycles = response.data || []
        setActiveCycles(cycles)
      } catch (error: any) {
        console.error('Failed to load cycles:', error)
        setActiveCycles([])
      }
    }

    if (currentOrganization?.id) {
      loadUsers()
      loadCycles()
    }
  }, [currentOrganization?.id])

  // Convert tree data to test page format
  const data = useMemo(() => {
    if (!treeData) return []
    return treeData.roots.map(root => convertNodeToItem(root, expandedIds))
  }, [treeData, expandedIds])

  // Find selected item in tree
  const selectedItem = useMemo(() => {
    if (!selectedId || !data.length) return null
    const findItem = (items: OKRItem[]): OKRItem | null => {
      for (const item of items) {
        if (item.id === selectedId) return item
        if (item.children) {
          const found = findItem(item.children)
          if (found) return found
        }
      }
      return null
    }
    return findItem(data)
  }, [data, selectedId])

  // Update check-in form when selection changes
  useEffect(() => {
    if (selectedItem?.type === 'kr' && selectedItem.current !== undefined) {
      setCheckInValue(selectedItem.current.toString())
    } else {
      setCheckInValue('')
    }
  }, [selectedItem])

  // Toggle expand/collapse
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Handle check-in submission
  const handleCheckIn = useCallback(async () => {
    if (!selectedItem || selectedItem.type !== 'kr' || !checkInValue || !selectedItem._originalNode) return
    
    setIsSubmitting(true)
    try {
      const numValue = parseFloat(checkInValue)
      const numConfidence = parseInt(checkInConfidence, 10)
      
      if (isNaN(numValue) || isNaN(numConfidence)) {
        toast({
          title: 'Invalid input',
          description: 'Please enter valid numbers for value and confidence.',
          variant: 'destructive',
        })
        return
      }

      await api.post(`/key-results/${selectedItem._originalNode.keyResultId || selectedItem.id}/check-in`, {
        value: numValue,
        confidence: numConfidence,
      })
      
      toast({
        title: 'Check-in recorded',
        description: 'Check-in has been recorded successfully.',
      })
      
      await refetch()
      setCheckInValue('')
    } catch (error: any) {
      console.error('Failed to create check-in:', error)
      toast({
        title: 'Could not save',
        description: error.response?.data?.message || 'Failed to create check-in',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedItem, checkInValue, checkInConfidence, refetch, toast])

  // Expand all ancestors of selected item
  useEffect(() => {
    if (!selectedId || !treeData) return
    
    const path = getNodePath(treeData.roots, selectedId)
    if (path && path.length > 1) {
      // Expand all items in path except the last one (selected item)
      setExpandedIds(prev => {
        const next = new Set(prev)
        path.slice(0, -1).forEach(node => next.add(node.id))
        return next
      })
    }
  }, [selectedId, treeData])

  // Normalize cycles for modals
  const normalizedCycles = useMemo(() => {
    return activeCycles.map((cycle) => ({
      id: cycle.id,
      name: cycle.name,
      status: cycle.status,
      startsAt: cycle.startDate,
      endsAt: cycle.endDate,
    }))
  }, [activeCycles])

  const selectedCycle = normalizedCycles.find((c) => c.id === selectedCycleId)
  const selectedTimeframeLabel = selectedCycle?.name || 'All cycles'

  // Render a single row in the cascade
  const renderRow = (item: OKRItem, depth = 0) => {
    const isSelected = selectedId === item.id
    const paddingLeft = `${depth * 24 + 16}px`
    
    return (
      <div key={item.id}>
        <div 
          onClick={() => setSelectedId(item.id)}
          className={`
            group flex items-center py-3 pr-4 border-b border-slate-800/50 cursor-pointer transition-all duration-200 relative
            ${isSelected ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500 shadow-sm' : 'hover:bg-slate-800/30 border-l-2 border-l-transparent'}
          `}
          style={{ paddingLeft }}
        >
          {/* Connectors for hierarchy visualization */}
          {depth > 0 && (
            <div 
              className="absolute border-l border-b border-slate-700 rounded-bl-lg w-4 h-full"
              style={{ left: `${(depth * 24) - 8}px`, top: '-50%', height: '200%' }}
            />
          )}
          
          <div className="flex items-center gap-3 flex-1 min-w-0 z-10">
            {/* Expand/Collapse Icon */}
            {item.children && item.children.length > 0 ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleExpand(item.id)
                }}
                className="p-1 rounded hover:bg-slate-700 text-slate-400"
              >
                {item.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <div className="w-6" />
            )}
            
            {/* Type Icon */}
            <div className={`p-1.5 rounded-md ${item.type === 'objective' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700/50 text-slate-400'}`}>
              {item.type === 'objective' ? <Target size={16} /> : <TrendingUp size={16} />}
            </div>
            
            {/* Title & Owner */}
            <div className="flex-1 min-w-0">
              <div className={`truncate text-sm font-medium ${isSelected ? 'text-indigo-100' : 'text-slate-200'}`}>
                {item.title}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>{item.owner}</span>
                {item.level === 'company' && <span className="bg-indigo-500/20 text-indigo-300 px-1.5 rounded text-[10px]">Company</span>}
              </div>
            </div>
            
            {/* Status & Progress */}
            <div className="w-48 flex flex-col gap-1 items-end">
              <StatusBadge status={item.status} />
              <div className="w-24 flex items-center gap-2">
                <ProgressBar value={item.progress} status={item.status} />
                <span className="text-xs text-slate-400 w-6 text-right">{item.progress}%</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Recursively render children */}
        {item.children && item.expanded && (
          <div className="relative animate-in slide-in-from-top-2 duration-200">
            {/* Vertical guide line */}
            <div 
              className="absolute w-px bg-slate-800 h-full transition-opacity duration-200" 
              style={{ left: `${depth * 24 + 27}px` }} 
            />
            {item.children.map(child => renderRow(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
        {/* Navigation Sidebar */}
        <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
          <div className="p-6">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Layers size={18} className="text-white" />
              </div>
              OKR Nexus
            </h1>
          </div>
          <nav className="flex-1 px-3 space-y-1">
            {['Dashboard', 'OKRs', 'Visual Builder', 'Analytics'].map((item) => (
              <a
                key={item}
                href={item === 'Dashboard' ? '/dashboard' : item === 'OKRs' ? '/dashboard/okrs' : item === 'Visual Builder' ? '/dashboard/builder' : '/dashboard/analytics'}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${item === 'OKRs' ? 'bg-indigo-600/10 text-indigo-400' : 'text-slate-400 hover:bg-slate-800/50'}`}
              >
                {item === 'Dashboard' && <Layers size={18} />}
                {item === 'OKRs' && <Target size={18} />}
                {item === 'Visual Builder' && <Activity size={18} />}
                {item === 'Analytics' && <TrendingUp size={18} />}
                {item}
              </a>
            ))}
          </nav>
          <div className="p-4 border-t border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold">
                  {user?.firstName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="text-sm">
                  <div className="text-white">{user?.firstName || 'User'}</div>
                <div className="text-slate-500 text-xs">{user?.email || ''}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header */}
          <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-white">Objectives & Key Results</h2>
              <div className="h-4 w-px bg-slate-700"></div>
              <button className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800 px-3 py-1.5 rounded-md hover:bg-slate-700 transition">
                <span>{selectedTimeframeLabel}</span>
                <ChevronDown size={14} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setNewObjectiveModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-indigo-900/20 flex items-center gap-2"
              >
                <Zap size={16} />
                New Objective
              </button>
            </div>
          </header>
          
          {/* Two-Panel Workspace */}
          <div className="flex-1 flex overflow-hidden">
            {/* LEFT PANEL: The Cascade Tree */}
            <div className="flex-1 overflow-y-auto bg-slate-900/30">
              {/* Toolbar */}
              <div className="px-6 py-3 flex items-center justify-between border-b border-slate-800/50">
                <div className="flex gap-2">
                  <button className="px-3 py-1 text-xs font-medium bg-indigo-500/20 text-indigo-300 rounded-full">Hierarchy View</button>
                  <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition">Flat List</button>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Group by:</span>
                  <span className="text-slate-300">Owner</span>
                </div>
              </div>
              
              {/* Tree Content */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-slate-500">Loading OKRs...</div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-rose-500">{error}</div>
                </div>
              ) : (
                <div className="py-2">
                  {data.length > 0 ? (
                    data.map(item => renderRow(item))
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-slate-500">No OKRs found</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT PANEL: The Action & Management Rail (Contextual) */}
            <div className="w-[420px] bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden shadow-xl z-20 transition-all duration-300">
              {selectedItem ? (
                <>
                  {/* Action Panel Header */}
                  <div className="p-6 border-b border-slate-800">
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                      <span className="uppercase tracking-wider font-semibold">
                        {selectedItem.type === 'objective' ? 'Objective' : 'Key Result'}
                      </span>
                      {selectedItem.level && (
                        <>
                          <ChevronRight size={12} />
                          <span className="capitalize">{selectedItem.level}</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-xl font-semibold text-white leading-tight mb-2">
                      {selectedItem.title}
                    </h3>
                    {selectedItem.description && (
                      <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                        {selectedItem.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-4">
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Users size={14} />
                        {selectedItem.owner}
                      </div>
                      <StatusBadge status={selectedItem.status} />
                      {selectedItem.lastUpdated && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Calendar size={12} />
                          {selectedItem.lastUpdated}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* SECTION 1: AI ACTIONABLE INSIGHTS */}
                    {selectedItem.aiInsight && (
                      <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-xl p-4 relative overflow-hidden animate-in fade-in duration-300">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5" />
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-2 text-indigo-300 text-sm font-semibold">
                            <Zap size={16} className="fill-indigo-500 text-indigo-500" />
                            Nexus AI Insight
                          </div>
                          <p className="text-sm text-slate-300 mb-3">
                            {selectedItem.aiInsight}
                          </p>
                          <div className="flex gap-2">
                            <button className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded shadow-sm transition-colors">
                              View Pipeline Gaps
                            </button>
                            <button className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded border border-slate-700 transition-colors">
                              Ask Owner
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SECTION 2: MANAGEMENT (CHECK-IN) - Only for Key Results */}
                    {selectedItem.type === 'kr' && selectedItem.current !== undefined && (
                      <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-white flex items-center gap-2">
                            <BarChart3 size={16} />
                            Current Progress
                          </h4>
                          {selectedItem.lastUpdated && (
                            <span className="text-xs text-slate-500">
                              Updated {selectedItem.lastUpdated}
                            </span>
                          )}
                        </div>
                        
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                          <div className="flex items-end justify-between mb-2">
                            <div className="text-3xl font-light text-white">
                              {selectedItem.current}{selectedItem.unit}
                            </div>
                            {selectedItem.target && (
                              <div className="text-sm text-slate-500 mb-1">
                                Target: {selectedItem.target}{selectedItem.unit}
                              </div>
                            )}
                          </div>
                          <ProgressBar value={selectedItem.progress} status={selectedItem.status} />
                          
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-slate-500 mb-1 block">New Value</label>
                              <input 
                                type="number" 
                                value={checkInValue}
                                onChange={(e) => setCheckInValue(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none transition-colors" 
                                placeholder={selectedItem.current?.toString() || '0'} 
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 mb-1 block">Confidence</label>
                              <select 
                                value={checkInConfidence}
                                onChange={(e) => setCheckInConfidence(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none transition-colors"
                              >
                                <option value="0">Low (0%)</option>
                                <option value="25">Low-Medium (25%)</option>
                                <option value="50">Medium (50%)</option>
                                <option value="75">Medium-High (75%)</option>
                                <option value="100">High (100%)</option>
                              </select>
                            </div>
                          </div>
                          <button 
                            onClick={handleCheckIn}
                            disabled={isSubmitting || !checkInValue}
                            className="w-full mt-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded transition-colors flex items-center justify-center gap-2"
                          >
                            {isSubmitting ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={14} />
                                Check-in
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* SECTION 3: CASCADING ALIGNMENT */}
                    {selectedItem.type === 'kr' && (() => {
                      const findParent = (items: OKRItem[], targetId: string, parent: OKRItem | null = null): OKRItem | null => {
                        for (const item of items) {
                          if (item.id === targetId) return parent
                          if (item.children) {
                            const found = findParent(item.children, targetId, item)
                            if (found) return found
                          }
                        }
                        return null
                      }
                      const parentObjective = findParent(data, selectedItem.id)
                      
                      return parentObjective ? (
                        <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-300 delay-100">
                          <h4 className="text-sm font-medium text-white flex items-center gap-2">
                            <ArrowUpRight size={16} className="text-slate-500" />
                            Alignment Context
                          </h4>
                          <div 
                            className="p-3 rounded-lg border border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 cursor-pointer transition-colors"
                            onClick={() => setSelectedId(parentObjective.id)}
                          >
                            <div className="text-xs text-slate-500 mb-1">Contributes to Objective</div>
                            <div className="text-sm text-slate-200 font-medium mb-2">{parentObjective.title}</div>
                            <StatusBadge status={parentObjective.status} />
                          </div>
                        </div>
                      ) : null
                    })()}

                    {/* Show children if this is an objective */}
                    {selectedItem.type === 'objective' && selectedItem.children && selectedItem.children.length > 0 && (
                      <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-300 delay-150">
                        <h4 className="text-sm font-medium text-white flex items-center gap-2">
                          <Layers size={16} className="text-slate-500" />
                          Key Results ({selectedItem.children.length})
                        </h4>
                        <div className="space-y-2">
                          {selectedItem.children.map((child) => (
                            <div
                              key={child.id}
                              onClick={() => setSelectedId(child.id)}
                              className="p-3 rounded-lg border border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 cursor-pointer transition-colors"
                            >
                              <div className="text-sm text-slate-200 font-medium mb-1">{child.title}</div>
                              <div className="flex items-center gap-2">
                                <StatusBadge status={child.status} />
                                <span className="text-xs text-slate-500">{child.progress}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-6">
                  <div className="text-center">
                    <Target size={48} className="text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-500 text-sm">Select an OKR to view details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <NewCheckInModal
        isOpen={checkInModalOpen}
        keyResultId={checkInKrId || ''}
        onClose={() => {
          setCheckInModalOpen(false)
          setCheckInKrId(null)
        }}
        onSubmit={async (data) => {
          if (checkInKrId && selectedItem?._originalNode) {
            try {
              await api.post(`/key-results/${checkInKrId}/check-in`, data)
              toast({
                title: 'Check-in recorded',
                description: 'Check-in has been recorded successfully.',
              })
              await refetch()
              setCheckInModalOpen(false)
              setCheckInKrId(null)
            } catch (error: any) {
              toast({
                title: 'Could not save',
                description: error.response?.data?.message || 'Failed to create check-in',
                variant: 'destructive',
              })
            }
          }
        }}
      />

      <EditObjectiveModal
        isOpen={editObjectiveModalOpen}
        objectiveId={editObjectiveId}
                  objectiveData={selectedItem?.type === 'objective' && selectedItem._originalNode ? {
                    title: selectedItem.title,
                    ownerId: selectedItem._originalNode.ownerId,
                    cycleId: selectedItem._originalNode.cycleId || undefined,
                    status: selectedItem._originalNode.status,
                    visibilityLevel: (selectedItem._originalNode.visibilityLevel as any) || 'PUBLIC_TENANT',
                    tenantId: (selectedItem._originalNode as any).tenantId,
                  } : undefined}
        onClose={() => {
          setEditObjectiveModalOpen(false)
          setEditObjectiveId(null)
        }}
        onSubmit={async () => {
          await refetch()
          setEditObjectiveModalOpen(false)
          setEditObjectiveId(null)
        }}
        availableUsers={availableUsers}
        availableWorkspaces={[]}
        availableCycles={normalizedCycles}
        availablePillars={[]}
      />

      <NewObjectiveModal
        isOpen={newObjectiveModalOpen}
        onClose={() => setNewObjectiveModalOpen(false)}
        onSubmit={async () => {
          await refetch()
          setNewObjectiveModalOpen(false)
        }}
        availableUsers={availableUsers}
        availableWorkspaces={[]}
        availableCycles={normalizedCycles}
        availablePillars={[]}
      />
    </ProtectedRoute>
  )
}

export default function OKRTestPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OKRTestPageContent />
    </Suspense>
  )
}
