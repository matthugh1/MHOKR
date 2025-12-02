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
  Eye,
  Rocket
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
const mapStatus = (status: string): 'on-track' | 'at-risk' | 'off-track' | 'not-started' | 'in-progress' | 'blocked' | 'completed' => {
  switch (status) {
    case 'ON_TRACK':
      return 'on-track'
    case 'AT_RISK':
      return 'at-risk'
    case 'OFF_TRACK':
      return 'off-track'
    case 'COMPLETED':
      return 'completed'
    case 'CANCELLED':
      return 'off-track'
    // Initiative statuses
    case 'NOT_STARTED':
      return 'not-started'
    case 'IN_PROGRESS':
      return 'in-progress'
    case 'BLOCKED':
      return 'blocked'
    default:
      return 'on-track'
  }
}

// Convert HierarchyOKRNode to test page's OKRItem format
const convertNodeToItem = (node: HierarchyOKRNode, expandedIds: Set<string>): any => {
  return {
    id: node.id,
    type: node.type, // Keep original type: 'objective' | 'keyResult' | 'initiative'
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
  type: 'objective' | 'kr' | 'initiative'
  level?: 'company' | 'team'
  title: string
  owner: string
  status: 'on-track' | 'at-risk' | 'off-track' | 'not-started' | 'in-progress' | 'blocked' | 'completed'
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
  
  // Sort state
  const [sortBy, setSortBy] = useState<'title-asc' | 'title-desc' | 'none'>('none')
  const allCyclesFromUrl = searchParams.get('allCycles') === 'true' // Track explicit "All cycles" selection
  const selectedStatus = searchParams.get('status') as string | null
  const selectedScope = (searchParams.get('scope') as 'my' | 'team-workspace' | 'tenant') || 'tenant'
  const searchQueryFromUrl = searchParams.get('search') || ''
  
  // Local search input state (for debouncing)
  const [searchInput, setSearchInput] = useState(searchQueryFromUrl)
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQueryFromUrl)

  // Local state - initialize from URL, or null if not in URL
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(selectedCycleIdFromUrl || null)
  
  // Debug: Log when selectedCycleId changes
  useEffect(() => {
    console.log('[HierarchyPage] selectedCycleId changed:', {
      selectedCycleId,
      selectedCycleIdFromUrl,
      match: selectedCycleId === selectedCycleIdFromUrl,
    })
  }, [selectedCycleId, selectedCycleIdFromUrl])
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
  const [cyclesLoaded, setCyclesLoaded] = useState(false)
  // Track if user explicitly selected "All cycles" to prevent auto-default
  const allCyclesSelectedRef = useRef(false)

  // Load cycles early (needed for cycle selector and default selection)
  useEffect(() => {
    const loadCycles = async () => {
      try {
        const response = await api.get('/reports/cycles')
        const cycles = response.data || []
        setActiveCycles(cycles)

        console.log('[HierarchyPage] Cycles loaded:', {
          cyclesCount: cycles.length,
          selectedCycleIdFromUrl,
          selectedCycleId,
          cycleInitialized: cycleInitializedRef.current,
          allCyclesSelected: allCyclesSelectedRef.current,
          cycles: cycles.map((c: any) => ({ id: c.id, name: c.name, status: c.status })),
        })

        // On initial page load only: set default cycle in dropdown if none is selected
        // This sets both the state (for dropdown display) and URL (for persistence)
        // BUT: Don't set default if user explicitly selected "All cycles" (check URL param or ref)
        const shouldSetDefault = !cycleInitializedRef.current && !selectedCycleIdFromUrl && cycles.length > 0 && !allCyclesSelectedRef.current && !allCyclesFromUrl
        
        if (shouldSetDefault) {
          const activeCycle = cycles.find((c: any) => c.status === 'ACTIVE') || cycles[0]
          if (activeCycle) {
            console.log('[HierarchyPage] Setting default cycle on initial load:', {
              cycleId: activeCycle.id,
              cycleName: activeCycle.name,
              wasNull: !selectedCycleId,
            })
            // Update state immediately (dropdown will show this)
            setSelectedCycleId(activeCycle.id)
            // Update URL to persist selection
            const params = new URLSearchParams(searchParams.toString())
            params.set('cycleId', activeCycle.id)
            router.replace(`/dashboard/okrs/hierarchy?${params.toString()}`, { scroll: false })
            cycleInitializedRef.current = true
          }
        } else if (selectedCycleIdFromUrl && selectedCycleIdFromUrl !== selectedCycleId) {
          // Sync state from URL if URL changed externally (e.g., browser back/forward)
          console.log('[HierarchyPage] Syncing cycleId from URL:', selectedCycleIdFromUrl)
          setSelectedCycleId(selectedCycleIdFromUrl)
          // If a cycleId is in URL, user didn't select "All cycles"
          allCyclesSelectedRef.current = false
        } else if (!selectedCycleIdFromUrl && !selectedCycleId && cycles.length > 0 && cycleInitializedRef.current && !allCyclesSelectedRef.current && !allCyclesFromUrl) {
          // Fallback: if somehow we have cycles but no cycleId set, set it now
          // BUT: Don't do this if user explicitly selected "All cycles" (check URL param or ref)
          const activeCycle = cycles.find((c: any) => c.status === 'ACTIVE') || cycles[0]
          if (activeCycle) {
            console.log('[HierarchyPage] Setting default cycle (fallback):', activeCycle.id, activeCycle.name)
            setSelectedCycleId(activeCycle.id)
            const params = new URLSearchParams(searchParams.toString())
            params.set('cycleId', activeCycle.id)
            router.replace(`/dashboard/okrs/hierarchy?${params.toString()}`, { scroll: false })
          }
        } else if (!selectedCycleIdFromUrl && (allCyclesSelectedRef.current || allCyclesFromUrl)) {
          // User explicitly selected "All cycles" - ensure state reflects this
          console.log('[HierarchyPage] Maintaining "All cycles" selection', { allCyclesSelectedRef: allCyclesSelectedRef.current, allCyclesFromUrl })
          setSelectedCycleId(null)
          // Ensure ref is set
          allCyclesSelectedRef.current = true
        }
        
        // Mark cycles as loaded (even if empty, we've checked)
        setCyclesLoaded(true)
      } catch (error: any) {
        console.error('Failed to load cycles:', error)
        setActiveCycles([])
        // Still mark as loaded so we don't block forever
        setCyclesLoaded(true)
      }
    }

    // Reset cycle initialization when organization changes
    if (currentOrganization?.id !== lastOrgIdRef.current) {
      cycleInitializedRef.current = false
      // Only reset allCyclesSelectedRef if URL doesn't have allCycles=true
      if (!allCyclesFromUrl) {
        allCyclesSelectedRef.current = false
      }
      lastOrgIdRef.current = currentOrganization?.id || null
      setCyclesLoaded(false)
    }

    if (currentOrganization?.id) {
      loadCycles()
    } else {
      setCyclesLoaded(false)
    }
  }, [currentOrganization?.id, selectedCycleIdFromUrl, searchParams, router, selectedCycleId, allCyclesFromUrl])

  // Sync cycleId from URL when it changes externally (e.g., from dropdown selection)
  // BUT: Don't sync if user explicitly selected "All cycles"
  useEffect(() => {
    if (selectedCycleIdFromUrl !== selectedCycleId) {
      // If user explicitly selected "All cycles" (check URL param or ref), don't override it
      if (!selectedCycleIdFromUrl && (allCyclesSelectedRef.current || allCyclesFromUrl)) {
        // User selected "All cycles" - keep it null
        console.log('[HierarchyPage] Sync effect: Preserving "All cycles" selection')
        return
      }
      // If URL has a cycleId, clear the "all cycles" flag
      if (selectedCycleIdFromUrl) {
        allCyclesSelectedRef.current = false
      }
      setSelectedCycleId(selectedCycleIdFromUrl)
    }
  }, [selectedCycleIdFromUrl, selectedCycleId, allCyclesFromUrl])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20
  const scrollableContainerRef = useRef<HTMLDivElement>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchInput)
    }, 500) // 500ms debounce delay

    return () => clearTimeout(timer)
  }, [searchInput])

  // Sync debounced search to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (debouncedSearchQuery) {
      params.set('search', debouncedSearchQuery)
    } else {
      params.delete('search')
    }
    router.replace(`/dashboard/okrs/hierarchy?${params.toString()}`, { scroll: false })
  }, [debouncedSearchQuery, searchParams, router])

  // Sync URL search to local input when URL changes externally
  useEffect(() => {
    if (searchQueryFromUrl !== searchInput) {
      setSearchInput(searchQueryFromUrl)
      setDebouncedSearchQuery(searchQueryFromUrl)
    }
  }, [searchQueryFromUrl])

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCycleId, selectedStatus, selectedScope, debouncedSearchQuery, currentOrganization?.id])

  // Scroll to top when page changes
  useEffect(() => {
    if (scrollableContainerRef.current) {
      scrollableContainerRef.current.scrollTop = 0
    }
  }, [currentPage])

  // Fetch OKR data
  // Disable API calls when creation modal is open to prevent Network Errors
  const isCreationModeActive = newObjectiveModalOpen || sidePanelTab === 'create'
  
  // Wait for cycles to load AND ensure we have a cycleId (either from URL or default)
  // OR if user explicitly selected "All Cycles", allow fetching without cycleId
  const hasCycleId = !!selectedCycleId || !!selectedCycleIdFromUrl
  const allCyclesSelected = allCyclesFromUrl || allCyclesSelectedRef.current
  const canFetchOKRs = !!currentOrganization?.id && cyclesLoaded && (hasCycleId || allCyclesSelected || activeCycles.length === 0) && !isCreationModeActive
  
  console.log('[HierarchyPage] Calling useHierarchyOKRs with:', {
    tenantId: currentOrganization?.id,
    cycleId: selectedCycleId,
    selectedCycleIdFromUrl,
    allCyclesSelected,
    scope: selectedScope,
    searchQuery: debouncedSearchQuery,
    cyclesLoaded,
    hasCycleId,
    activeCyclesCount: activeCycles.length,
    canFetchOKRs,
    enabled: canFetchOKRs
  })

  const { treeData, loading, error, refetch, loadChildren, clearLoadedNode, loadingNodeIds, pagination } = useHierarchyOKRs({
    tenantId: currentOrganization?.id || null,
    cycleId: selectedCycleId, // Use selectedCycleId from dropdown/state
    status: selectedStatus,
    scope: selectedScope,
    searchQuery: debouncedSearchQuery || undefined, // Send search to backend to search all OKRs
    sortBy: sortBy !== 'none' ? sortBy : undefined, // Send sortBy to backend
    enabled: canFetchOKRs,
    page: currentPage,
    pageSize,
  })
  console.log('[HierarchyPage] useHierarchyOKRs returned:', {
    hasTreeData: !!treeData,
    rootsCount: treeData?.roots?.length || 0,
    loading,
    error,
    pagination
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

  // Search is now handled by the backend API - it searches across all OKRs, not just the current page
  // The backend returns only matching OKRs, so we use treeData directly
  const filterTree = treeData

  // Convert tree data to test page format
  // Sorting is now handled by the backend, so we just convert the data
  const data = useMemo(() => {
    console.log('[HierarchyPage] Computing data from treeData', {
      hasTrreeData: !!filterTree,
      rootsCount: filterTree?.roots?.length || 0,
      loading,
      error,
      tenantId: currentOrganization?.id,
      cycleId: selectedCycleId,
      searchQuery: debouncedSearchQuery,
      sortBy
    })
    if (!filterTree) return []
    
    // Backend handles sorting, so we just convert the data
    return filterTree.roots.map(root => convertNodeToItem(root, expandedIds))
  }, [filterTree, expandedIds, loading, error, currentOrganization?.id, selectedCycleId, debouncedSearchQuery, sortBy])

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
      if (node && node.type === 'objective') {
        // Check if we've already loaded sub-objectives (children of type 'objective')
        const hasSubObjectives = node.children.some(child => child.type === 'objective')
        // If no sub-objectives loaded yet, fetch them (Key Results might already be there)
        if (!hasSubObjectives) {
          console.log('[HierarchyPage] Loading children for objective:', id, 'Current children:', node.children.length)
          await loadChildren(id)
        } else {
          console.log('[HierarchyPage] Sub-objectives already loaded for:', id, 'Sub-objectives count:', node.children.filter(c => c.type === 'objective').length)
        }
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
      } else if (node.type === 'initiative') {
        await api.patch(`/initiatives/${node.id}`, data)
        toast({
          title: 'Initiative updated',
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

  // Handle cycle change - dropdown is the source of truth
  const handleCycleChange = useCallback((opt: { key: string; label: string }) => {
    // Prevent filter changes during OKR creation to avoid Network Errors
    if (isCreationModeActive) {
      return
    }
    // Update state immediately (dropdown is source of truth)
    const newCycleId = opt.key && opt.key !== 'all' && opt.key !== 'unassigned' ? opt.key : null
    
    // Track if user explicitly selected "All cycles" BEFORE updating state/URL
    if (opt.key === 'all' || opt.key === 'unassigned') {
      allCyclesSelectedRef.current = true
      cycleInitializedRef.current = true // Mark as initialized to prevent default cycle logic
    } else {
      allCyclesSelectedRef.current = false
    }
    
    setSelectedCycleId(newCycleId)
    
    // Update URL to reflect selection - use replace to avoid adding to history
    const params = new URLSearchParams(searchParams.toString())
    if (newCycleId) {
      params.set('cycleId', newCycleId)
      params.delete('allCycles') // Remove allCycles param when a specific cycle is selected
    } else {
      params.delete('cycleId')
      params.set('allCycles', 'true') // Set flag to track "All cycles" selection
    }
    router.replace(`/dashboard/okrs/hierarchy?${params.toString()}`, { scroll: false })
  }, [searchParams, router, isCreationModeActive])

  // Handle status change
  const handleStatusChange = useCallback((status: string | null) => {
    // Prevent filter changes during OKR creation to avoid Network Errors
    if (isCreationModeActive) {
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    if (status) {
      params.set('status', status)
    } else {
      params.delete('status')
    }
    router.push(`/dashboard/okrs/hierarchy?${params.toString()}`)
  }, [searchParams, router, isCreationModeActive])

  // Handle search change
  const handleSearchChange = useCallback((query: string) => {
    // Prevent filter changes during OKR creation to avoid Network Errors
    if (isCreationModeActive) {
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    if (query) {
      params.set('search', query)
    } else {
      params.delete('search')
    }
    router.push(`/dashboard/okrs/hierarchy?${params.toString()}`)
  }, [searchParams, router, isCreationModeActive])

  // Handle scope change
  const handleScopeChange = useCallback((scope: 'my' | 'team-workspace' | 'tenant') => {
    // Prevent filter changes during OKR creation to avoid Network Errors
    if (isCreationModeActive) {
      return
    }
    // Note: We keep expandedIds - will reload children for expanded nodes after tree data updates
    const params = new URLSearchParams(searchParams.toString())
    params.set('scope', scope)
    router.push(`/dashboard/okrs/hierarchy?${params.toString()}`)
  }, [searchParams, router, isCreationModeActive])

  // Track previous filter values to detect changes
  const prevFiltersRef = useRef({ scope: selectedScope, cycleId: selectedCycleId, status: selectedStatus })
  
  // Reload children for expanded nodes when scope/cycle/status changes and tree data updates
  useEffect(() => {
    // Wait for loading to complete and tree data to be available
    if (!treeData || expandedIds.size === 0 || loading) {
      return
    }

    // Check if filters actually changed
    const filtersChanged = 
      prevFiltersRef.current.scope !== selectedScope ||
      prevFiltersRef.current.cycleId !== selectedCycleId ||
      prevFiltersRef.current.status !== selectedStatus

    if (!filtersChanged) {
      return
    }

    console.log('[HierarchyPage] Filters changed, reloading children for expanded nodes', {
      prevScope: prevFiltersRef.current.scope,
      newScope: selectedScope,
      prevCycleId: prevFiltersRef.current.cycleId,
      newCycleId: selectedCycleId,
      expandedIds: Array.from(expandedIds)
    })

    // Update previous filters
    prevFiltersRef.current = { scope: selectedScope, cycleId: selectedCycleId, status: selectedStatus }

    // Small delay to ensure tree data is fully updated
    const timeoutId = setTimeout(() => {
      // For each expanded node, clear it from cache and reload children
      const reloadPromises: Promise<void>[] = []
      expandedIds.forEach((nodeId) => {
        const node = treeData.allNodes.get(nodeId)
        if (node && node.type === 'objective') {
          console.log('[HierarchyPage] Reloading children for expanded node after filter change:', {
            nodeId,
            nodeTitle: node.title,
            currentChildrenCount: node.children.length,
            hasSubObjectives: node.children.some(child => child.type === 'objective')
          })
          // Clear from cache first, then force reload
          clearLoadedNode(nodeId)
          reloadPromises.push(loadChildren(nodeId, true))
        } else if (!node) {
          console.warn('[HierarchyPage] Expanded node not found in tree:', nodeId)
        }
      })
      
      // Execute all reloads in parallel
      if (reloadPromises.length > 0) {
        Promise.all(reloadPromises).catch(err => {
          console.error('[HierarchyPage] Error reloading children after filter change:', err)
        })
      }
    }, 100) // Small delay to ensure tree data is fully updated

    return () => clearTimeout(timeoutId)
  }, [treeData, selectedScope, selectedCycleId, selectedStatus, expandedIds, loadChildren, loading])

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
  const renderRow = (item: OKRItem, depth = 0, parentPath: string = '') => {
    const isSelected = selectedId === item.id
    const paddingLeft = `${depth * 24 + 16}px`
    // Create unique key by combining item ID with parent path to avoid duplicates
    const uniqueKey = `${parentPath}-${item.id}`

    return (
      <div key={uniqueKey}>
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
            <div className={`p-1.5 rounded-md ${
              item.type === 'objective' 
                ? 'bg-indigo-500/20 text-indigo-400' 
                : item.type === 'initiative'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-slate-700/50 text-slate-400'
            }`}>
              {item.type === 'objective' ? (
                <Target size={16} />
              ) : item.type === 'initiative' ? (
                <Rocket size={16} />
              ) : (
                <TrendingUp size={16} />
              )}
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
            {item.children.map((child, index) => renderRow(child, depth + 1, `${uniqueKey}-${index}`))}
          </div>
        )}
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="flex flex-col flex-1 bg-slate-950 text-slate-200 font-sans overflow-hidden min-h-0 h-full max-h-full">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 w-full min-h-0 overflow-hidden">
            {/* Top Header */}
            <header className="flex-shrink-0 border-b border-slate-800 bg-slate-900/50">
              <div className="px-6 py-3 space-y-3">
                {/* Top Row: Title, Cycle, Scope Filters, New Objective */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-white whitespace-nowrap">Objectives & Key Results</h2>
                    <div className="h-4 w-px bg-slate-700"></div>
                    <div className="relative" ref={cycleSelectorRef}>
                      <button
                        onClick={() => !isCreationModeActive && setCycleSelectorOpen(!cycleSelectorOpen)}
                        disabled={isCreationModeActive}
                        className={cn(
                          "flex items-center gap-2 text-sm px-3 py-1.5 rounded-md transition",
                          isCreationModeActive
                            ? "text-slate-500 bg-slate-800/50 cursor-not-allowed"
                            : "text-slate-300 bg-slate-800 hover:bg-slate-700"
                        )}
                        title={isCreationModeActive ? "Filters disabled while creating OKR" : undefined}
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
                                      if (!isCreationModeActive) {
                                        handleCycleChange({ key: cycle.id, label: cycle.name })
                                        setCycleSelectorOpen(false)
                                      }
                                    }}
                                    className={cn(
                                      "rounded-md text-sm text-slate-300 flex items-center justify-between w-full px-3 py-2",
                                      isCreationModeActive
                                        ? "cursor-not-allowed opacity-50"
                                        : "hover:bg-slate-800 cursor-pointer"
                                    )}
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
                                      if (!isCreationModeActive) {
                                        handleCycleChange({ key: cycle.id, label: cycle.name })
                                        setCycleSelectorOpen(false)
                                      }
                                    }}
                                    className={cn(
                                      "rounded-md text-sm text-slate-300 flex items-center justify-between w-full px-3 py-2",
                                      isCreationModeActive
                                        ? "cursor-not-allowed opacity-50"
                                        : "hover:bg-slate-800 cursor-pointer"
                                    )}
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
                              if (!isCreationModeActive) {
                                handleCycleChange({ key: 'all', label: 'All cycles' })
                                setCycleSelectorOpen(false)
                              }
                            }}
                            className={cn(
                              "rounded-md text-sm text-slate-300 px-3 py-2",
                              isCreationModeActive
                                ? "cursor-not-allowed opacity-50"
                                : "hover:bg-slate-800 cursor-pointer"
                            )}
                          >
                            <span className="font-medium text-slate-200">All cycles</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Scope Toggle - Now next to cycle dropdown */}
                  <div className={cn(
                    "flex items-center gap-1 rounded-lg border p-1",
                    isCreationModeActive
                      ? "border-slate-800 bg-slate-800/30 opacity-50"
                      : "border-slate-700 bg-slate-800/50"
                  )} role="group" aria-label="Scope filter">
                    {availableScopes.includes('my') && (
                      <button
                        disabled={isCreationModeActive}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-sm font-semibold transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                          isCreationModeActive
                            ? "cursor-not-allowed opacity-50"
                            : selectedScope === 'my'
                              ? "bg-indigo-600 text-white shadow-md hover:bg-indigo-700"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                        )}
                        onClick={() => handleScopeChange('my')}
                        aria-pressed={selectedScope === 'my'}
                        title={isCreationModeActive ? "Filters disabled while creating OKR" : undefined}
                      >
                        My OKRs
                      </button>
                    )}
                    {availableScopes.includes('team-workspace') && (
                      <button
                        disabled={isCreationModeActive}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-sm font-semibold transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                          isCreationModeActive
                            ? "cursor-not-allowed opacity-50"
                            : selectedScope === 'team-workspace'
                              ? "bg-indigo-600 text-white shadow-md hover:bg-indigo-700"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                        )}
                        onClick={() => handleScopeChange('team-workspace')}
                        aria-pressed={selectedScope === 'team-workspace'}
                        title={isCreationModeActive ? "Filters disabled while creating OKR" : undefined}
                      >
                        Team/Workspace OKRs
                      </button>
                    )}
                    {availableScopes.includes('tenant') && (
                      <button
                        disabled={isCreationModeActive}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-sm font-semibold transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                          isCreationModeActive
                            ? "cursor-not-allowed opacity-50"
                            : selectedScope === 'tenant'
                              ? "bg-indigo-600 text-white shadow-md hover:bg-indigo-700"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                        )}
                        onClick={() => handleScopeChange('tenant')}
                        aria-pressed={selectedScope === 'tenant'}
                        title={isCreationModeActive ? "Filters disabled while creating OKR" : undefined}
                      >
                        Company OKRs
                      </button>
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
                
                {/* Bottom Row: Search and Status Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                {/* Search Input */}
                <div className="flex-1 relative min-w-[200px] max-w-md">
                    <Search className={cn(
                      "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4",
                      isCreationModeActive ? "text-slate-600" : "text-slate-400"
                    )} />
                    <Input
                      placeholder="Search Objectives, Key Results, Initiatives..."
                      disabled={isCreationModeActive}
                      className={cn(
                        "pl-10 h-9 border text-white placeholder:text-slate-500",
                        isCreationModeActive
                          ? "bg-slate-800/30 border-slate-800 cursor-not-allowed opacity-50"
                          : "bg-slate-800/50 border-slate-700 focus:border-indigo-500"
                      )}
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      title={isCreationModeActive ? "Filters disabled while creating OKR" : undefined}
                    />
                    {searchInput && !isCreationModeActive && (
                      <button
                        onClick={() => {
                          setSearchInput('')
                          setDebouncedSearchQuery('')
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  
                  {/* Sort Dropdown */}
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'title-asc' | 'title-desc' | 'none')}
                      disabled={isCreationModeActive}
                      className={cn(
                        "h-9 px-3 pr-8 rounded-md text-sm border transition",
                        isCreationModeActive
                          ? "bg-slate-800/30 border-slate-800 cursor-not-allowed opacity-50 text-slate-500"
                          : "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      )}
                      title={isCreationModeActive ? "Filters disabled while creating OKR" : undefined}
                    >
                      <option value="none">Sort by...</option>
                      <option value="title-asc">Title (A-Z)</option>
                      <option value="title-desc">Title (Z-A)</option>
                    </select>
                  </div>
                
                {/* Status Filter Chips */}
                <div className={cn(
                  "flex items-center gap-2 flex-wrap",
                  isCreationModeActive && "opacity-50"
                )} role="group" aria-label="Status filters">
                  <button
                    disabled={isCreationModeActive}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                      isCreationModeActive
                        ? "cursor-not-allowed"
                        : selectedStatus === null
                          ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                          : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700/50 hover:text-slate-300"
                    )}
                    onClick={() => handleStatusChange(null)}
                    aria-label="Show all statuses"
                    aria-pressed={selectedStatus === null}
                    title={isCreationModeActive ? "Filters disabled while creating OKR" : undefined}
                  >
                    All statuses
                  </button>
                  <button
                    disabled={isCreationModeActive}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                      isCreationModeActive
                        ? "cursor-not-allowed"
                        : selectedStatus === 'ON_TRACK'
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700/50 hover:text-slate-300"
                    )}
                    onClick={() => handleStatusChange('ON_TRACK')}
                    aria-label="Filter by status: On track"
                    aria-pressed={selectedStatus === 'ON_TRACK'}
                    title={isCreationModeActive ? "Filters disabled while creating OKR" : undefined}
                  >
                    On track
                  </button>
                  <button
                    disabled={isCreationModeActive}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                      isCreationModeActive
                        ? "cursor-not-allowed"
                        : selectedStatus === 'AT_RISK'
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700/50 hover:text-slate-300"
                    )}
                    onClick={() => handleStatusChange('AT_RISK')}
                    aria-label="Filter by status: At risk"
                    aria-pressed={selectedStatus === 'AT_RISK'}
                    title={isCreationModeActive ? "Filters disabled while creating OKR" : undefined}
                  >
                    At risk
                  </button>
                  <button
                    disabled={isCreationModeActive}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                      isCreationModeActive
                        ? "cursor-not-allowed"
                        : selectedStatus === 'OFF_TRACK' || selectedStatus === 'BLOCKED'
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700/50 hover:text-slate-300"
                    )}
                    onClick={() => handleStatusChange(selectedStatus === 'OFF_TRACK' || selectedStatus === 'BLOCKED' ? null : 'OFF_TRACK')}
                    aria-label="Filter by status: Off track"
                    aria-pressed={selectedStatus === 'OFF_TRACK' || selectedStatus === 'BLOCKED'}
                    title={isCreationModeActive ? "Filters disabled while creating OKR" : undefined}
                  >
                    Off track
                  </button>
                  <button
                    disabled={isCreationModeActive}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                      isCreationModeActive
                        ? "cursor-not-allowed"
                        : selectedStatus === 'BLOCKED'
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700/50 hover:text-slate-300"
                    )}
                    onClick={() => handleStatusChange(selectedStatus === 'BLOCKED' ? null : 'BLOCKED')}
                    aria-label="Filter by status: Blocked"
                    aria-pressed={selectedStatus === 'BLOCKED'}
                    title={isCreationModeActive ? "Filters disabled while creating OKR" : undefined}
                  >
                    Blocked
                  </button>
                  <button
                    disabled={isCreationModeActive}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none h-9",
                      isCreationModeActive
                        ? "cursor-not-allowed"
                        : selectedStatus === 'COMPLETED'
                          ? "bg-emerald-600/20 text-emerald-300 border border-emerald-600/30"
                          : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700/50 hover:text-slate-300"
                    )}
                    onClick={() => handleStatusChange(selectedStatus === 'COMPLETED' ? null : 'COMPLETED')}
                    aria-label="Filter by status: Completed"
                    aria-pressed={selectedStatus === 'COMPLETED'}
                    title={isCreationModeActive ? "Filters disabled while creating OKR" : undefined}
                  >
                    Completed
                  </button>
                </div>
                </div>
              </div>
            </header>

            {/* Two-Panel Workspace */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* LEFT PANEL: The Cascade Tree */}
              <div className="flex-1 flex flex-col bg-slate-900/30 min-h-0 min-w-0 overflow-hidden">
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

                {/* Content area with scrollable tree and pagination */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  {/* Scrollable Tree Content - Takes available space, scrolls when needed */}
                  <div 
                    ref={scrollableContainerRef} 
                    className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
                  >
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

                  {/* Pagination Controls - Fixed at bottom, always visible */}
                  <nav key="pagination-nav" className="flex-shrink-0 border-t-2 border-indigo-500 bg-slate-900 px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-400 z-20 shadow-lg" aria-label="Pagination">
                    <div className="text-slate-500 font-medium" role="status">
                      {loading ? (
                        <span>Loading...</span>
                      ) : error ? (
                        <span className="text-rose-500">{error}</span>
                      ) : pagination?.totalCount > 0 ? (
                        <>
                          Showing {(pagination.currentPage - 1) * pagination.pageSize + 1} - {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount)} of {pagination.totalCount} root objectives
                          {pagination.totalPages > 1 && ` (Page ${pagination.currentPage} of ${pagination.totalPages})`}
                        </>
                      ) : (
                        <>No objectives found</>
                      )}
                    </div>
                    {!error && pagination && (
                      <div className="flex items-center gap-4">
                        {pagination.totalPages > 1 ? (
                          <>
                            <button
                              className={cn(
                                "rounded-md border-2 border-indigo-400 bg-indigo-500/20 px-4 py-2 text-sm font-semibold shadow-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-500/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white",
                                "focus:ring-offset-2 focus:ring-offset-slate-900"
                              )}
                              disabled={loading || pagination.currentPage <= 1}
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              aria-label="Previous page"
                            >
                              ‹ Previous
                            </button>
                            <div className="tabular-nums text-slate-300 font-bold text-base" aria-current="page">
                              Page {pagination.currentPage} of {Math.max(1, pagination.totalPages)}
                            </div>
                            <button
                              className={cn(
                                "rounded-md border-2 border-indigo-400 bg-indigo-500/20 px-4 py-2 text-sm font-semibold shadow-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-500/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white",
                                "focus:ring-offset-2 focus:ring-offset-slate-900"
                              )}
                              disabled={loading || pagination.currentPage >= pagination.totalPages}
                              onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                              aria-label="Next page"
                            >
                              Next ›
                            </button>
                          </>
                        ) : (
                          <div className="text-slate-500 text-xs">All objectives shown</div>
                        )}
                      </div>
                    )}
                  </nav>
                </div>
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
                                {!detailLoading && okrDetail && selectedItem.type !== 'initiative' && (
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

                                {/* SECTION 4a: Simple Progress for Initiatives */}
                                {!detailLoading && okrDetail && selectedItem.type === 'initiative' && (
                                  <CollapsibleSection sectionId="progress" title="Progress" icon={BarChart3}>
                                    <div className="bg-slate-800/50 rounded-lg border border-slate-800 p-5">
                                      <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm text-slate-400">Progress</span>
                                        <span className="text-2xl font-semibold text-white">{Math.round(clampProgress(okrDetail.progress || 0))}%</span>
                                      </div>
                                      <ProgressBar value={clampProgress(okrDetail.progress || 0)} status={selectedItem.status} />
                                    </div>
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
