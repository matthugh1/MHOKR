/**
 * OKR Hierarchy View Page
 * Production-ready hierarchical OKR view with two-panel layout
 * Enhanced with test page design and full functionality
 */

'use client'

import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
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
  BarChart3,
  Search,
  X,
  Eye
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn, formatNumber, decodeHtmlEntities, clampProgress } from '@/lib/utils'
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'
import { useToast } from '@/hooks/use-toast'
import { useHierarchyOKRs } from './hooks/useHierarchyOKRs'
import { useOKRDetail } from './hooks/useOKRDetail'
import { HierarchyOKRNode } from './components/types'
import { getNodePath } from './components/utils/transformToHierarchy'
import { NewCheckInModal } from '@/components/okr/NewCheckInModal'
import { EditObjectiveModal } from '@/components/okr/EditObjectiveModal'
import { NewObjectiveModal } from '@/components/okr/NewObjectiveModal'
import { KeyResultTrendChart } from '@/components/okr/KeyResultTrendChart'
import { SidePanelEditForm } from './components/SidePanelEditForm'
import { SidePanelCreateForm } from './components/SidePanelCreateForm'
import { MetadataSection } from './components/MetadataSection'
import { PeopleAndTagsSection } from './components/PeopleAndTagsSection'
import { CheckInHistorySection } from './components/CheckInHistorySection'
import { InitiativesSection } from './components/InitiativesSection'
import { ProgressBreakdownSection } from './components/ProgressBreakdownSection'
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
    <span className={`text-xs px-2.5 py-1 rounded-full border ${styles[status] || styles['on-track']} flex items-center gap-1.5 flex-shrink-0`}>
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
  
  const clampedValue = Math.min(100, Math.max(0, value))
  
  return (
    <div className="h-2.5 w-full bg-slate-700/50 rounded-full overflow-hidden">
      <div 
        className={`h-full ${color} transition-all duration-500 rounded-full`} 
        style={{ width: `${clampedValue}%` }} 
      />
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

// Shared Header Component
function SidePanelHeader({
  selectedItem,
  okrDetail,
  sidePanelTab,
  onTabChange,
}: {
  selectedItem: OKRItem
  okrDetail: any | null
  sidePanelTab: string
  onTabChange: (tab: string) => void
}) {
  if (!selectedItem) return null

  return (
    <div className="px-6 pt-4 pb-4 border-b border-slate-800 bg-slate-900/50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="uppercase tracking-wider font-semibold">
            {selectedItem.type === 'objective' ? 'Objective' : 'Key Result'}
          </span>
          {selectedItem.level && (
            <>
              <ChevronRight size={12} className="text-slate-600" />
              <span className="capitalize text-slate-500">{selectedItem.level}</span>
            </>
          )}
          {okrDetail?.goalType && (
            <>
              <ChevronRight size={12} className="text-slate-600" />
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full border',
                okrDetail.goalType === 'COMMITTED'
                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                  : 'bg-purple-500/10 text-purple-300 border-purple-500/20'
              )}>
                {okrDetail.goalType === 'COMMITTED' ? 'Committed' : 'Aspirational'}
              </span>
            </>
          )}
          {okrDetail && (okrDetail.isPublished || okrDetail.state === 'PUBLISHED') && (
            <>
              <ChevronRight size={12} className="text-slate-600" />
              <span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                Published
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {selectedItem.type === 'kr' && sidePanelTab === 'details' && (
            <button
              onClick={() => {
                // Scroll to check-in form or focus it
                const checkInSection = document.querySelector('[data-check-in-section]')
                if (checkInSection) {
                  checkInSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                  // Focus the input field
                  setTimeout(() => {
                    const input = checkInSection.querySelector('input[type="number"]') as HTMLInputElement
                    input?.focus()
                  }, 300)
                }
              }}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md font-medium transition-colors"
            >
              Check-in
            </button>
          )}
          {sidePanelTab === 'details' && (
            <button
              onClick={() => onTabChange('edit')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Edit
            </button>
          )}
          {sidePanelTab === 'edit' && (
            <button
              onClick={() => onTabChange('details')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              View Details
            </button>
          )}
        </div>
      </div>
      <h3 className="text-xl font-semibold text-white leading-tight mb-2 break-words">
        {decodeHtmlEntities(selectedItem.title)}
      </h3>
      <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-800/50">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Users size={14} className="text-slate-500" />
          <span>{selectedItem.owner}</span>
        </div>
        <StatusBadge status={selectedItem.status} />
        {okrDetail?.updatedAt && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar size={12} />
            <span>
              {new Date(okrDetail.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}
        {okrDetail?.visibilityLevel && (
          <div className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 border border-slate-700">
            <Eye size={12} />
            {okrDetail.visibilityLevel === 'PUBLIC_TENANT' ? 'Public' : 'Private'}
          </div>
        )}
      </div>
    </div>
  )
}

function OKRHierarchyPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentOrganization } = useWorkspace()
  const { user } = useAuth()
  const { toast } = useToast()

  // Filter states from URL
  const selectedCycleIdFromUrl = searchParams.get('cycleId')
  const selectedStatus = searchParams.get('status') as string | null
  const selectedScope = (searchParams.get('scope') as 'my' | 'team-workspace' | 'tenant') || 'tenant'
  const searchQuery = searchParams.get('search') || ''

  // Local state
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(selectedCycleIdFromUrl)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [checkInValue, setCheckInValue] = useState<string>('')
  const [checkInConfidence, setCheckInConfidence] = useState<string>('50')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkInModalOpen, setCheckInModalOpen] = useState(false)
  
  // State for collapsible sections (all collapsed by default except Overview)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']))
  
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }, [])
  const [checkInKrId, setCheckInKrId] = useState<string | null>(null)
  const [editObjectiveModalOpen, setEditObjectiveModalOpen] = useState(false)
  const [editObjectiveId, setEditObjectiveId] = useState<string | null>(null)
  const [newObjectiveModalOpen, setNewObjectiveModalOpen] = useState(false)
  const [sidePanelTab, setSidePanelTab] = useState<'details' | 'edit' | 'create'>('details')
  const [createMode, setCreateMode] = useState<'objective' | 'kr' | null>(null)
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string }>>([])
  const [teams, setTeams] = useState<Array<{ id: string; name: string; workspaceId?: string }>>([])
  const [activeCycles, setActiveCycles] = useState<Array<{
    id: string
    name: string
    status: string
    startDate: string
    endDate: string
    tenantId: string
  }>>([])

  // Track cycle initialization to set default active cycle
  const cycleInitializedRef = useRef(false)
  const lastOrgIdRef = useRef<string | null>(null)

  // Load cycles early (needed for cycle selector and default selection)
  useEffect(() => {
    const loadCycles = async () => {
      try {
        const response = await api.get('/reports/cycles')
        const cycles = response.data || []
        setActiveCycles(cycles)
        
        // Set default active cycle on first load if no cycle is selected
        if (!cycleInitializedRef.current && !selectedCycleIdFromUrl && cycles.length > 0) {
          const activeCycle = cycles.find((c: any) => c.status === 'ACTIVE') || cycles[0]
          if (activeCycle) {
            setSelectedCycleId(activeCycle.id)
            // Update URL to reflect default cycle
            const params = new URLSearchParams(searchParams.toString())
            params.set('cycleId', activeCycle.id)
            router.push(`/dashboard/okrs/hierarchy?${params.toString()}`)
            cycleInitializedRef.current = true
          }
        }
      } catch (error: any) {
        console.error('Failed to load cycles:', error)
        setActiveCycles([])
      }
    }

    // Reset cycle initialization when organization changes
    if (currentOrganization?.id !== lastOrgIdRef.current) {
      cycleInitializedRef.current = false
      lastOrgIdRef.current = currentOrganization?.id || null
    }

    if (currentOrganization?.id) {
      loadCycles()
    }
  }, [currentOrganization?.id, selectedCycleIdFromUrl, searchParams, router])

  // Sync cycleId from URL when it changes externally
  useEffect(() => {
    if (selectedCycleIdFromUrl !== selectedCycleId) {
      setSelectedCycleId(selectedCycleIdFromUrl)
    }
  }, [selectedCycleIdFromUrl])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCycleId, selectedStatus, selectedScope, searchQuery, currentOrganization?.id])

  // Fetch OKR data
  const { treeData, loading, error, refetch, loadChildren, loadingNodeIds, pagination } = useHierarchyOKRs({
    tenantId: currentOrganization?.id || null,
    cycleId: selectedCycleId,
    status: selectedStatus,
    scope: selectedScope,
    searchQuery,
    enabled: !!currentOrganization?.id,
    page: currentPage,
    pageSize,
  })

  // Lazy load users, workspaces, and teams only when needed (for forms)
  const loadUsersLazy = useCallback(async () => {
    if (availableUsers.length > 0) return // Already loaded
    try {
      const response = await api.get('/users')
      setAvailableUsers(response.data || [])
    } catch (error: any) {
      if (error.response?.status !== 403) {
        console.error('Failed to load users:', error)
      }
      setAvailableUsers([])
    }
  }, [availableUsers.length])

  const loadWorkspacesLazy = useCallback(async () => {
    if (workspaces.length > 0 || !currentOrganization?.id) return // Already loaded
    try {
      const response = await api.get(`/workspaces?tenantId=${currentOrganization.id}`)
      setWorkspaces(response.data || [])
    } catch (error: any) {
      console.error('Failed to load workspaces:', error)
      setWorkspaces([])
    }
  }, [workspaces.length, currentOrganization?.id])

  const loadTeamsLazy = useCallback(async () => {
    if (teams.length > 0) return // Already loaded
    try {
      const response = await api.get(`/teams`)
      setTeams(response.data || [])
    } catch (error: any) {
      console.error('Failed to load teams:', error)
      setTeams([])
    }
  }, [teams.length])

  // Load users/workspaces/teams when edit or create tabs are opened
  useEffect(() => {
    if (sidePanelTab === 'edit' || sidePanelTab === 'create') {
      loadUsersLazy()
      loadWorkspacesLazy()
      loadTeamsLazy()
    }
  }, [sidePanelTab, loadUsersLazy, loadWorkspacesLazy, loadTeamsLazy])

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

  // Fetch comprehensive detail for selected item
  const selectedNode = useMemo(() => {
    return selectedItem?._originalNode || null
  }, [selectedItem])

  const { detail: okrDetail, loading: detailLoading, refetch: refetchDetail } = useOKRDetail(
    selectedNode,
    !!selectedNode
  )

  // Update check-in form when selection changes
  useEffect(() => {
    if (selectedItem?.type === 'kr' && selectedItem.current !== undefined) {
      setCheckInValue(selectedItem.current.toString())
    } else {
      setCheckInValue('')
    }
  }, [selectedItem])

  // Toggle expand/collapse with on-demand child loading
  const toggleExpand = useCallback(async (id: string) => {
    const isCurrentlyExpanded = expandedIds.has(id)
    
    if (!isCurrentlyExpanded) {
      // Expanding - check if we need to load children
      const node = treeData?.allNodes.get(id)
      if (node && node.type === 'objective' && node.children.length === 0) {
        // This objective has no children loaded yet, fetch them
        await loadChildren(id)
      }
    }
    
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [expandedIds, treeData, loadChildren])

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
      refetchDetail()
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
  }, [selectedItem, checkInValue, checkInConfidence, refetch, refetchDetail, toast])

  // Handle edit save
  const handleEditSave = useCallback(async (data: any) => {
    if (!selectedItem?._originalNode) return

    try {
      const node = selectedItem._originalNode
      if (node.type === 'objective') {
        await api.patch(`/objectives/${node.id}`, data)
        toast({
          title: 'Objective updated',
          description: `"${data.title}" has been updated.`,
        })
      } else if (node.type === 'keyResult') {
        await api.patch(`/key-results/${node.id}`, data)
        toast({
          title: 'Key Result updated',
          description: `"${data.title}" has been updated.`,
        })
      }
      await refetch()
      refetchDetail()
      setSidePanelTab('details')
    } catch (error: any) {
      console.error('Failed to update:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      throw error
    }
  }, [selectedItem, refetch, refetchDetail, toast])

  // Handle create success
  const handleCreateSuccess = useCallback(async (data: any) => {
    try {
      const node = selectedItem?._originalNode
      if (createMode === 'objective') {
        const response = await api.post('/objectives', data)
        const objectiveId = response.data?.id || response.data?.objectiveId
        
        // Add additional owners if provided
        if (data.additionalOwnerIds && data.additionalOwnerIds.length > 0 && objectiveId) {
          try {
            for (const userId of data.additionalOwnerIds) {
              await api.post(`/objectives/${objectiveId}/owners`, { userId })
            }
          } catch (error) {
            console.error('Failed to add additional owners:', error)
            // Don't fail the whole creation
          }
        }
        
        toast({
          title: 'Objective created',
          description: `"${data.title}" has been created.`,
        })
        
        return { id: objectiveId }
      } else if (createMode === 'kr') {
        const response = await api.post('/key-results', {
          ...data,
          tenantId: currentOrganization?.id,
        })
        toast({
          title: 'Key Result created',
          description: `"${data.title}" has been created.`,
        })
        return { id: response.data?.id }
      }
      await refetch()
      refetchDetail()
      setSidePanelTab('details')
      setCreateMode(null)
      return { id: '' }
    } catch (error: any) {
      console.error('Failed to create:', error)
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      throw error
    }
  }, [createMode, selectedItem, currentOrganization, refetch, refetchDetail, toast])

  // Handle cycle change
  const handleCycleChange = useCallback((opt: { key: string; label: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    if (opt.key && opt.key !== 'all' && opt.key !== 'unassigned') {
      params.set('cycleId', opt.key)
    } else {
      params.delete('cycleId')
    }
    router.push(`/dashboard/okrs/hierarchy?${params.toString()}`)
  }, [searchParams, router])

  // Handle status change
  const handleStatusChange = useCallback((status: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (status) {
      params.set('status', status)
    } else {
      params.delete('status')
    }
    router.push(`/dashboard/okrs/hierarchy?${params.toString()}`)
  }, [searchParams, router])

  // Handle search change
  const handleSearchChange = useCallback((query: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (query) {
      params.set('search', query)
    } else {
      params.delete('search')
    }
    router.push(`/dashboard/okrs/hierarchy?${params.toString()}`)
  }, [searchParams, router])

  // Handle scope change
  const handleScopeChange = useCallback((scope: 'my' | 'team-workspace' | 'tenant') => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('scope', scope)
    router.push(`/dashboard/okrs/hierarchy?${params.toString()}`)
  }, [searchParams, router])

  const availableScopes: Array<'my' | 'team-workspace' | 'tenant'> = ['my', 'team-workspace', 'tenant']

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
  const [cycleSelectorOpen, setCycleSelectorOpen] = useState(false)
  const cycleSelectorRef = useRef<HTMLDivElement>(null)

  // Close cycle selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cycleSelectorRef.current && !cycleSelectorRef.current.contains(event.target as Node)) {
        setCycleSelectorOpen(false)
      }
    }
    if (cycleSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [cycleSelectorOpen])

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
            {item.type === 'objective' ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleExpand(item.id)
                }}
                className="p-1 rounded hover:bg-slate-700 text-slate-400 disabled:opacity-50"
                disabled={loadingNodeIds.has(item.id)}
              >
                {loadingNodeIds.has(item.id) ? (
                  <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                ) : item.expanded ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
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
                {decodeHtmlEntities(item.title)}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>{item.owner}</span>
                {item.level === 'company' && <span className="bg-indigo-500/20 text-indigo-300 px-1.5 rounded text-[10px]">Company</span>}
              </div>
            </div>
            
            {/* Status & Progress */}
            <div className="min-w-[280px] flex items-center gap-3 justify-end flex-shrink-0">
              <StatusBadge status={item.status} />
              <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                <ProgressBar value={item.progress} status={item.status} />
                <div className="flex flex-col items-end min-w-[60px]">
                  <span className="text-sm font-medium text-slate-300">{Math.round(clampProgress(item.progress))}%</span>
                  {item.type === 'kr' && item.current !== undefined && item.target !== undefined && (
                    <span className="text-xs text-slate-500">
                      {formatNumber(item.current)}/{formatNumber(item.target)}
                      {item.unit && item.unit.toLowerCase() !== 'number' && ` ${item.unit}`}
                    </span>
                  )}
                </div>
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
      <DashboardLayout>
        <div className="flex flex-col h-full bg-slate-950 text-slate-200 font-sans overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 w-full">
          {/* Top Header */}
          <header className="border-b border-slate-800 bg-slate-900/50">
            <div className="h-16 flex items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-white">Objectives & Key Results</h2>
                <div className="h-4 w-px bg-slate-700"></div>
                <div className="relative" ref={cycleSelectorRef}>
                  <button
                    onClick={() => setCycleSelectorOpen(!cycleSelectorOpen)}
                    className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800 px-3 py-1.5 rounded-md hover:bg-slate-700 transition"
                  >
                    <span>{selectedTimeframeLabel}</span>
                    <ChevronDown size={14} className={cn("transition-transform", cycleSelectorOpen && "rotate-180")} />
                  </button>
                  {cycleSelectorOpen && (
                    <div className="absolute z-50 mt-2 w-72 rounded-lg border border-slate-700 bg-slate-900 shadow-xl p-3">
                      {/* Current & Upcoming */}
                      {normalizedCycles.filter(c => c.status === 'ACTIVE' || c.status === 'UPCOMING' || c.status === 'DRAFT').length > 0 && (
                        <div className="mb-4">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-2">
                            Current & Upcoming
                          </div>
                          <div className="space-y-1">
                            {normalizedCycles
                              .filter(c => c.status === 'ACTIVE' || c.status === 'UPCOMING' || c.status === 'DRAFT')
                              .map((cycle) => (
                                <div
                                  key={cycle.id}
                                  onClick={() => {
                                    handleCycleChange({ key: cycle.id, label: cycle.name })
                                    setCycleSelectorOpen(false)
                                  }}
                                  className="rounded-md hover:bg-slate-800 cursor-pointer text-sm text-slate-300 flex items-center justify-between w-full px-3 py-2"
                                >
                                  <span className="font-medium text-slate-200">{cycle.name}</span>
                                  <span className="text-xs text-slate-500 capitalize">{cycle.status.toLowerCase()}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      {/* Previous */}
                      {normalizedCycles.filter(c => c.status === 'LOCKED' || c.status === 'ARCHIVED').length > 0 && (
                        <div className="mb-4">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-2">
                            Previous
                          </div>
                          <div className="max-h-[160px] overflow-y-auto space-y-1">
                            {normalizedCycles
                              .filter(c => c.status === 'LOCKED' || c.status === 'ARCHIVED')
                              .map((cycle) => (
                                <div
                                  key={cycle.id}
                                  onClick={() => {
                                    handleCycleChange({ key: cycle.id, label: cycle.name })
                                    setCycleSelectorOpen(false)
                                  }}
                                  className="rounded-md hover:bg-slate-800 cursor-pointer text-sm text-slate-300 flex items-center justify-between w-full px-3 py-2"
                                >
                                  <span className="font-medium text-slate-200">{cycle.name}</span>
                                  <span className="text-xs text-slate-500 capitalize">{cycle.status.toLowerCase()}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      {/* All cycles option */}
                      <div className="pt-2 border-t border-slate-800">
                        <div
                          onClick={() => {
                            handleCycleChange({ key: 'all', label: 'All cycles' })
                            setCycleSelectorOpen(false)
                          }}
                          className="rounded-md hover:bg-slate-800 cursor-pointer text-sm text-slate-300 px-3 py-2"
                        >
                          <span className="font-medium text-slate-200">All cycles</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setCreateMode('objective')
                    setSidePanelTab('create')
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-indigo-900/20 flex items-center gap-2"
                >
                  <Zap size={16} />
                  New Objective
                </button>
              </div>
            </div>
            
            {/* Filter Bar */}
            <div className="px-6 py-3 border-t border-slate-800/50 space-y-3">
              {/* Row 1: Scope Toggle and Search */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Scope Toggle */}
                <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/50 p-1" role="group" aria-label="Scope filter">
                  {availableScopes.includes('my') && (
                    <button
                      className={cn(
                        "px-3 py-1.5 rounded-md text-sm font-semibold transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                        selectedScope === 'my'
                          ? "bg-indigo-600 text-white shadow-md hover:bg-indigo-700"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                      )}
                      onClick={() => handleScopeChange('my')}
                      aria-pressed={selectedScope === 'my'}
                    >
                      My OKRs
                    </button>
                  )}
                  {availableScopes.includes('team-workspace') && (
                    <button
                      className={cn(
                        "px-3 py-1.5 rounded-md text-sm font-semibold transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                        selectedScope === 'team-workspace'
                          ? "bg-indigo-600 text-white shadow-md hover:bg-indigo-700"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                      )}
                      onClick={() => handleScopeChange('team-workspace')}
                      aria-pressed={selectedScope === 'team-workspace'}
                    >
                      Team/Workspace OKRs
                    </button>
                  )}
                  {availableScopes.includes('tenant') && (
                    <button
                      className={cn(
                        "px-3 py-1.5 rounded-md text-sm font-semibold transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                        selectedScope === 'tenant'
                          ? "bg-indigo-600 text-white shadow-md hover:bg-indigo-700"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                      )}
                      onClick={() => handleScopeChange('tenant')}
                      aria-pressed={selectedScope === 'tenant'}
                    >
                      Company OKRs
                    </button>
                  )}
                </div>

                {/* Search Input */}
                <div className="flex-1 relative min-w-[200px] max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search OKRs..." 
                    className="pl-10 h-9 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => handleSearchChange('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: Status Filter Chips */}
              <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Status filters">
                <button
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                    selectedStatus === null
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700/50 hover:text-slate-300"
                  )}
                  onClick={() => handleStatusChange(null)}
                  aria-label="Show all statuses"
                  aria-pressed={selectedStatus === null}
                >
                  All statuses
                </button>
                <button
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                    selectedStatus === 'ON_TRACK'
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700/50 hover:text-slate-300"
                  )}
                  onClick={() => handleStatusChange('ON_TRACK')}
                  aria-label="Filter by status: On track"
                  aria-pressed={selectedStatus === 'ON_TRACK'}
                >
                  On track
                </button>
                <button
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                    selectedStatus === 'AT_RISK'
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700/50 hover:text-slate-300"
                  )}
                  onClick={() => handleStatusChange('AT_RISK')}
                  aria-label="Filter by status: At risk"
                  aria-pressed={selectedStatus === 'AT_RISK'}
                >
                  At risk
                </button>
                <button
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                    selectedStatus === 'OFF_TRACK' || selectedStatus === 'BLOCKED'
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700/50 hover:text-slate-300"
                  )}
                  onClick={() => handleStatusChange(selectedStatus === 'OFF_TRACK' || selectedStatus === 'BLOCKED' ? null : 'OFF_TRACK')}
                  aria-label="Filter by status: Off track"
                  aria-pressed={selectedStatus === 'OFF_TRACK' || selectedStatus === 'BLOCKED'}
                >
                  Off track
                </button>
                <button
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                    selectedStatus === 'BLOCKED'
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700/50 hover:text-slate-300"
                  )}
                  onClick={() => handleStatusChange(selectedStatus === 'BLOCKED' ? null : 'BLOCKED')}
                  aria-label="Filter by status: Blocked"
                  aria-pressed={selectedStatus === 'BLOCKED'}
                >
                  Blocked
                </button>
                <button
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                    selectedStatus === 'COMPLETED'
                      ? "bg-emerald-600/20 text-emerald-300 border border-emerald-600/30"
                      : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700/50 hover:text-slate-300"
                  )}
                  onClick={() => handleStatusChange(selectedStatus === 'COMPLETED' ? null : 'COMPLETED')}
                  aria-label="Filter by status: Completed"
                  aria-pressed={selectedStatus === 'COMPLETED'}
                >
                  Completed
                </button>
              </div>
            </div>
          </header>
          
          {/* Two-Panel Workspace */}
          <div className="flex-1 flex overflow-hidden h-full min-h-0">
            {/* LEFT PANEL: The Cascade Tree */}
            <div className="flex-1 flex flex-col bg-slate-900/30 min-h-0">
              {/* Toolbar */}
              <div className="px-6 py-3 flex items-center justify-between border-b border-slate-800/50 flex-shrink-0">
                <div className="flex gap-2">
                  <button className="px-3 py-1 text-xs font-medium bg-indigo-500/20 text-indigo-300 rounded-full">Hierarchy View</button>
                  <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition">Flat List</button>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Group by:</span>
                  <span className="text-slate-300">Owner</span>
                </div>
              </div>
              
              {/* Scrollable Tree Content */}
              <div className="flex-1 overflow-y-auto min-h-0">
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
              
              {/* Pagination Controls - Always visible at bottom */}
              {!loading && !error && (
                <nav className="flex-shrink-0 border-t border-slate-800 bg-slate-900/50 px-6 py-4 flex items-center justify-between gap-4 text-sm text-slate-400" aria-label="Pagination">
                  <div className="text-slate-500" role="status">
                    {pagination.totalCount > 0 ? (
                      <>
                        Showing {(pagination.currentPage - 1) * pagination.pageSize + 1} - {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount)} of {pagination.totalCount} root objectives
                        {pagination.totalPages > 1 && ` (Page ${pagination.currentPage} of ${pagination.totalPages})`}
                      </>
                    ) : (
                      <>No objectives found</>
                    )}
                  </div>
                  {pagination.totalPages > 1 && (
                    <div className="flex items-center gap-4">
                      <button
                        className={cn(
                          "rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-300",
                          "focus:ring-offset-2 focus:ring-offset-slate-900"
                        )}
                        disabled={pagination.currentPage <= 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        aria-label="Previous page"
                      >
                        ‹ Previous
                      </button>
                      <div className="tabular-nums text-slate-400" aria-current="page">
                        Page {pagination.currentPage} of {pagination.totalPages}
                      </div>
                      <button
                        className={cn(
                          "rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-300",
                          "focus:ring-offset-2 focus:ring-offset-slate-900"
                        )}
                        disabled={pagination.currentPage >= pagination.totalPages}
                        onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                        aria-label="Next page"
                      >
                        Next ›
                      </button>
                    </div>
                  )}
                </nav>
              )}
            </div>

            {/* RIGHT PANEL: The Action & Management Rail (Contextual) */}
            <div className="w-[420px] bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden shadow-xl z-20 transition-all duration-300 h-full min-h-0">
              {/* TOP-LEVEL TABS STRIP */}
              <div className="grid w-full grid-cols-3 flex-shrink-0 bg-slate-900 rounded-none border-b border-slate-800 p-0 h-10">
                <button
                  type="button"
                  onClick={() => {
                    setSidePanelTab('details')
                    setCreateMode(null)
                  }}
                  className={cn(
                    "text-xs font-medium text-slate-400 hover:text-slate-300 rounded-none h-full flex items-center justify-center transition-colors",
                    sidePanelTab === 'details' && "bg-slate-800 text-white border-b-2 border-indigo-500"
                  )}
                >
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedItem) setSidePanelTab('edit')
                  }}
                  disabled={!selectedItem}
                  className={cn(
                    "text-xs font-medium text-slate-400 hover:text-slate-300 rounded-none h-full flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                    sidePanelTab === 'edit' && "bg-slate-800 text-white border-b-2 border-indigo-500"
                  )}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSidePanelTab('create')
                  }}
                  className={cn(
                    "text-xs font-medium text-slate-400 hover:text-slate-300 rounded-none h-full flex items-center justify-center transition-colors",
                    sidePanelTab === 'create' && "bg-slate-800 text-white border-b-2 border-indigo-500"
                  )}
                >
                  Create
                </button>
              </div>
              
              {/* SHARED HEADER UNDER TABS */}
              {selectedItem && (
                <SidePanelHeader 
                  selectedItem={selectedItem} 
                  okrDetail={okrDetail || null}
                  sidePanelTab={sidePanelTab}
                  onTabChange={(tab: string) => setSidePanelTab(tab as 'details' | 'create' | 'edit')}
                />
              )}
              
              {/* BODY AREA – ONE ACTIVE VIEW AT A TIME */}
              <div className="flex-1 min-h-0 flex flex-col">
                {sidePanelTab === 'details' && (
                  <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-4 pb-8 space-y-6">
                    {selectedItem ? (
                      <>
                        {/* Loading state for detail */}
                        {detailLoading && (
                          <div className="flex items-center justify-center py-8">
                            <div className="text-slate-500 text-sm">Loading details...</div>
                          </div>
                        )}

                        {/* Collapsible Section Helper Component */}
                        {(() => {
                          const CollapsibleSection = ({ 
                            sectionId, 
                            title, 
                            icon: Icon, 
                            children 
                          }: { 
                            sectionId: string
                            title: string
                            icon?: React.ComponentType<{ size?: number; className?: string }>
                            children: React.ReactNode
                          }) => {
                            const isExpanded = expandedSections.has(sectionId)
                            return (
                              <div className="space-y-3">
                                <button
                                  onClick={() => toggleSection(sectionId)}
                                  className="flex items-center gap-2 w-full text-left hover:text-indigo-300 transition-colors group"
                                >
                                  {Icon && <Icon size={16} className="text-slate-500" />}
                                  <h4 className="text-sm font-semibold text-white">{title}</h4>
                                </button>
                                {isExpanded && (
                                  <div className="pl-6">
                                    {children}
                                  </div>
                                )}
                              </div>
                            )
                          }

                          return (
                            <>
                              {/* SECTION 1: CHECK-IN FORM - Always visible for Key Results */}
                              {selectedItem.type === 'kr' && (
                                <div className="space-y-4" data-check-in-section>
                                  <div className="flex items-center gap-2">
                                    <BarChart3 size={18} className="text-indigo-400" />
                                    <h4 className="text-base font-semibold text-white">Check-in</h4>
                                  </div>
                                  
                                  <div className="bg-gradient-to-br from-indigo-950/30 to-purple-950/30 p-5 rounded-xl border-2 border-indigo-500/30 shadow-lg shadow-indigo-900/10 space-y-5">
                                    {/* Progress Display */}
                                    <div className="space-y-3">
                                      {selectedItem.current !== undefined ? (
                                        <div className="flex items-end justify-between gap-4">
                                          <div className="flex-1 min-w-0">
                                            <div className="text-4xl font-light text-white leading-none tracking-tight">
                                              {formatNumber(selectedItem.current)}
                                              {selectedItem.unit && selectedItem.unit.toLowerCase() !== 'number' && (
                                                <span className="text-2xl text-slate-400 ml-2 font-normal">{selectedItem.unit}</span>
                                              )}
                                            </div>
                                            {selectedItem.target && (
                                              <div className="text-sm text-slate-400 mt-2">
                                                Target: <span className="font-medium text-slate-300">{formatNumber(selectedItem.target)}</span>
                                                {selectedItem.unit && selectedItem.unit.toLowerCase() !== 'number' && (
                                                  <span> {selectedItem.unit}</span>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                          <div className="text-right flex-shrink-0">
                                            <div className="text-3xl font-semibold text-slate-200">{Math.round(clampProgress(selectedItem.progress))}%</div>
                                            <div className="text-xs text-slate-500 mt-0.5">complete</div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-center py-4">
                                          <div className="text-sm text-slate-400 mb-2">No check-ins yet</div>
                                          {selectedItem.target && (
                                            <div className="text-xs text-slate-500">
                                              Target: <span className="font-medium text-slate-300">{formatNumber(selectedItem.target)}</span>
                                              {selectedItem.unit && selectedItem.unit.toLowerCase() !== 'number' && (
                                                <span> {selectedItem.unit}</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      {selectedItem.current !== undefined && (
                                        <ProgressBar value={clampProgress(selectedItem.progress)} status={selectedItem.status} />
                                      )}
                                    </div>
                                    
                                    {/* Check-in Form */}
                                    <div className="pt-4 border-t border-slate-700/50 space-y-4">
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <label className="text-xs font-semibold text-slate-400 mb-2 block uppercase tracking-wide">New Value</label>
                                          <input 
                                            type="number" 
                                            step="any"
                                            value={checkInValue}
                                            onChange={(e) => setCheckInValue(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors" 
                                            placeholder={selectedItem.current ? formatNumber(selectedItem.current) : '0'} 
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs font-semibold text-slate-400 mb-2 block uppercase tracking-wide">Confidence</label>
                                          <select 
                                            value={checkInConfidence}
                                            onChange={(e) => setCheckInConfidence(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
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
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm shadow-indigo-900/20"
                                      >
                                        {isSubmitting ? (
                                          <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Submitting...
                                          </>
                                        ) : (
                                          <>
                                            <CheckCircle2 size={16} />
                                            Check-in
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* SECTION 2: Description (if available) */}
                              {!detailLoading && (okrDetail?.description || selectedItem?.description) && (
                                <CollapsibleSection sectionId="description" title="Description">
                                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                    {decodeHtmlEntities(okrDetail?.description || selectedItem?.description || '')}
                                  </p>
                                </CollapsibleSection>
                              )}

                              {/* SECTION 3: Overview (formerly Metadata) */}
                              {!detailLoading && okrDetail && (
                                <CollapsibleSection sectionId="overview" title="Overview" icon={Calendar}>
                                  <MetadataSection detail={okrDetail} type={selectedItem.type === 'kr' ? 'keyResult' : selectedItem.type} hideTitle />
                                </CollapsibleSection>
                              )}

                              {/* SECTION 4: Progress Breakdown */}
                              {!detailLoading && okrDetail && (
                                <CollapsibleSection sectionId="progress" title="Progress Breakdown" icon={BarChart3}>
                                  <ProgressBreakdownSection
                                    detail={{
                                      type: selectedItem.type === 'kr' ? 'keyResult' : selectedItem.type,
                                      progress: okrDetail.progress,
                                      keyResults: selectedItem.type === 'objective' && selectedItem.children
                                        ? selectedItem.children
                                            .filter((child) => child.type === 'kr')
                                            .map((child) => ({
                                              id: child.id,
                                              title: child.title,
                                              progress: child.progress,
                                            }))
                                        : undefined,
                                      startValue: okrDetail.startValue,
                                      currentValue: okrDetail.currentValue,
                                      targetValue: okrDetail.targetValue,
                                      unit: okrDetail.unit,
                                    }}
                                    hideTitle
                                  />
                                </CollapsibleSection>
                              )}

                              {/* SECTION 5: People & Tags */}
                              {!detailLoading && okrDetail && (
                                <CollapsibleSection sectionId="people" title="People & Tags" icon={Users}>
                                  <PeopleAndTagsSection detail={okrDetail} hideTitle />
                                </CollapsibleSection>
                              )}

                              {/* SECTION 6: AI ACTIONABLE INSIGHTS */}
                              {selectedItem.aiInsight && (
                                <CollapsibleSection sectionId="ai-insight" title="AI Insights" icon={Zap}>
                                  <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-xl p-5 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5" />
                                    <div className="relative space-y-3">
                                      <div className="flex items-center gap-2 text-indigo-300 text-sm font-semibold">
                                        <Zap size={16} className="fill-indigo-500 text-indigo-500" />
                                        Nexus AI Insight
                                      </div>
                                      <p className="text-sm text-slate-300 leading-relaxed">
                                        {selectedItem.aiInsight}
                                      </p>
                                      <div className="flex gap-2 pt-1">
                                        <button className="text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg shadow-sm transition-colors">
                                          View Pipeline Gaps
                                        </button>
                                        <button className="text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg border border-slate-700 transition-colors">
                                          Ask Owner
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </CollapsibleSection>
                              )}

                              {/* SECTION 6: CHECK-IN HISTORY (Key Results) */}
                              {!detailLoading && selectedItem && selectedItem.type === 'kr' && okrDetail && (
                                <CollapsibleSection sectionId="checkin-history" title="Check-in History" icon={MessageSquare}>
                                  <CheckInHistorySection detail={okrDetail} hideTitle />
                                </CollapsibleSection>
                              )}

                              {/* SECTION 7: TREND CHARTS (Key Results) */}
                              {!detailLoading && selectedItem && selectedItem.type === 'kr' && selectedNode?.keyResultId && (
                                <CollapsibleSection sectionId="trend-charts" title="Progress Trend" icon={BarChart3}>
                                  <div className="bg-slate-800/50 rounded-lg border border-slate-800 p-4">
                                    <KeyResultTrendChart keyResultId={selectedNode.keyResultId} />
                                  </div>
                                </CollapsibleSection>
                              )}


                              {/* SECTION 9: INITIATIVES (Objectives) */}
                              {!detailLoading && selectedItem && selectedItem.type === 'objective' && okrDetail && (
                                <CollapsibleSection sectionId="initiatives" title="Initiatives" icon={Target}>
                                  <InitiativesSection detail={okrDetail} hideTitle />
                                </CollapsibleSection>
                              )}

                              {/* SECTION 10: KEY RESULTS LIST (Objectives) */}
                              {selectedItem.type === 'objective' && selectedItem.children && selectedItem.children.length > 0 && (() => {
                                // Filter to only Key Results (exclude sub-objectives)
                                // Note: convertNodeToItem converts type to 'kr' not 'keyResult'
                                const keyResults = selectedItem.children.filter(child => child.type === 'kr')
                                return keyResults.length > 0 ? (
                                  <CollapsibleSection sectionId="key-results" title={`Key Results (${keyResults.length})`} icon={Layers}>
                                    <div className="space-y-2">
                                      {keyResults.map((child, index) => (
                                        <div
                                          key={`${selectedItem.id}-kr-${child.id || index}`}
                                          onClick={() => setSelectedId(child.id)}
                                          className="p-4 rounded-lg border border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 hover:border-slate-700 cursor-pointer transition-all group"
                                        >
                                          <div className="text-sm text-slate-200 font-medium mb-3 group-hover:text-indigo-300 transition-colors break-words">{decodeHtmlEntities(child.title)}</div>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <StatusBadge status={child.status} />
                                            <span className="text-xs text-slate-500 font-medium">{Math.round(clampProgress(child.progress))}%</span>
                                            {child.current !== undefined && child.target !== undefined && (
                                              <span className="text-xs text-slate-500 ml-auto">
                                                {formatNumber(child.current)}
                                                {child.unit && child.unit.toLowerCase() !== 'number' && ` ${child.unit}`} / {formatNumber(child.target)}
                                                {child.unit && child.unit.toLowerCase() !== 'number' && ` ${child.unit}`}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </CollapsibleSection>
                                ) : null
                              })()}

                        {/* SECTION 11: ALIGNMENT CONTEXT */}
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
                                  <CollapsibleSection sectionId="alignment" title="Alignment Context" icon={ArrowUpRight}>
                                    <div 
                                      className="p-4 rounded-lg border border-slate-800 bg-slate-800/30 hover:bg-slate-800/50 hover:border-slate-700 cursor-pointer transition-all group"
                                      onClick={() => setSelectedId(parentObjective.id)}
                                    >
                                      <div className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">Contributes to Objective</div>
                                      <div className="text-sm text-slate-200 font-medium mb-3 group-hover:text-indigo-300 transition-colors break-words">{decodeHtmlEntities(parentObjective.title)}</div>
                                      <StatusBadge status={parentObjective.status} />
                                    </div>
                                  </CollapsibleSection>
                                ) : null
                              })()}
                            </>
                          )
                        })()}
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-start justify-start p-6">
                        <Target size={48} className="text-slate-700 mb-4" />
                        <p className="text-slate-500 text-sm">Select an OKR to view details</p>
                      </div>
                    )}
                  </div>
                )}
                
                {sidePanelTab === 'edit' && (
                  <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-4 pb-8">
                    {selectedItem ? (
                      <SidePanelEditForm
                        selectedNode={selectedItem._originalNode || null}
                        onSave={handleEditSave}
                        onCancel={() => setSidePanelTab('details')}
                        availableUsers={availableUsers}
                        availableWorkspaces={workspaces}
                        availableCycles={normalizedCycles}
                        availableTeams={teams}
                        currentOrganization={currentOrganization}
                      />
                    ) : (
                      <div className="flex-1 flex flex-col items-start justify-start p-6">
                        <p className="text-slate-500 text-sm">Select an item to edit</p>
                      </div>
                    )}
                  </div>
                )}
                
                {sidePanelTab === 'create' && (
                  <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-4 pb-8">
                    <SidePanelCreateForm
                      mode={createMode}
                      onModeChange={setCreateMode}
                      onSuccess={handleCreateSuccess}
                      onCancel={() => {
                        setSidePanelTab('details')
                        setCreateMode(null)
                      }}
                      availableUsers={availableUsers}
                      availableWorkspaces={workspaces}
                      availableCycles={normalizedCycles.map(c => ({
                        id: c.id,
                        name: c.name,
                        startDate: c.startsAt,
                        endDate: c.endsAt,
                      }))}
                      availableTeams={teams}
                      parentObjectiveId={selectedItem?.type === 'objective' ? selectedItem.id : undefined}
                      parentObjectiveTitle={selectedItem?.type === 'objective' ? selectedItem.title : undefined}
                      defaultCycleId={selectedItem?.type === 'objective' && selectedItem._originalNode?.cycleId ? selectedItem._originalNode.cycleId : undefined}
                      defaultWorkspaceId={selectedItem?.type === 'objective' && selectedItem._originalNode?.workspaceId ? selectedItem._originalNode.workspaceId : undefined}
                      defaultTeamId={selectedItem?.type === 'objective' && selectedItem._originalNode?.teamId ? selectedItem._originalNode.teamId : undefined}
                      currentOrganization={currentOrganization}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      </DashboardLayout>

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
          visibilityLevel: (selectedItem._originalNode.visibilityLevel || 'PUBLIC_TENANT') as 'PUBLIC_TENANT' | 'PRIVATE',
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

export default function OKRHierarchyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OKRHierarchyPageContent />
    </Suspense>
  )
}
