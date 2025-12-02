'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SearchableUserSelect } from '@/components/okr/SearchableUserSelect'
import { GoalTypeSelector } from '@/components/okr/GoalTypeSelector'
import { OwnerList } from '@/components/okr/OwnerList'
import { useTenantAdmin } from '@/hooks/useTenantAdmin'
import { useTenantPermissions } from '@/hooks/useTenantPermissions'
import { useToast } from '@/hooks/use-toast'
import { useWorkspace } from '@/contexts/workspace.context'
import api from '@/lib/api'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Check, ChevronsUpDown } from 'lucide-react'
import {
  getObjectiveOwners,
  addObjectiveOwner,
  removeObjectiveOwner,
  type Owner,
} from '@/lib/okr-owners-api'
import { HierarchyOKRNode } from './types'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type OKRStatus = "NOT_STARTED" | "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "COMPLETED" | "CANCELLED"

// Valid status values for validation
const VALID_OKR_STATUSES: OKRStatus[] = ["NOT_STARTED", "ON_TRACK", "AT_RISK", "OFF_TRACK", "COMPLETED", "CANCELLED"]
type VisibilityLevel = "PUBLIC_TENANT" | "PRIVATE"

interface SidePanelEditObjectiveProps {
  selectedNode: HierarchyOKRNode | null
  onSave: (data: {
    title: string
    ownerId: string
    workspaceId?: string
    teamId?: string
    cycleId?: string
    status: OKRStatus
    goalType?: 'ASPIRATIONAL' | 'COMMITTED'
    visibilityLevel: VisibilityLevel
    pillarId?: string | null
  }) => Promise<void>
  onCancel: () => void
  availableUsers?: Array<{ id: string; name: string; email?: string }>
  availableWorkspaces?: Array<{ id: string; name: string }>
  availableTeams?: Array<{ id: string; name: string; workspaceId?: string }>
  availableCycles?: Array<{ id: string; name: string }>
}

export function SidePanelEditObjective({
  selectedNode,
  onSave,
  onCancel,
  availableUsers = [],
  availableWorkspaces = [],
  availableTeams = [],
  availableCycles = [],
}: SidePanelEditObjectiveProps) {
  const [title, setTitle] = useState("")
  const [ownerId, setOwnerId] = useState("")
  const [level, setLevel] = useState<'company' | 'workspace' | 'team'>('company')
  const [workspaceId, setWorkspaceId] = useState<string>("")
  const [teamId, setTeamId] = useState<string>("")
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
  const [cycleId, setCycleId] = useState<string>("")
  const [status, setStatus] = useState<OKRStatus>("ON_TRACK")
  const [goalType, setGoalType] = useState<'ASPIRATIONAL' | 'COMMITTED'>('ASPIRATIONAL')
  const [visibilityLevel, setVisibilityLevel] = useState<VisibilityLevel>("PUBLIC_TENANT")
  const [isPublished, setIsPublished] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTogglingPublish, setIsTogglingPublish] = useState(false)
  const [owners, setOwners] = useState<Owner[]>([])
  const [isLoadingOwners, setIsLoadingOwners] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [pillarId, setPillarId] = useState<string | null>(null)
  const [availablePillars, setAvailablePillars] = useState<Array<{ id: string; name: string; color?: string | null; description?: string | null }>>([])
  const [pillarOpen, setPillarOpen] = useState(false)
  
  const { currentOrganization } = useWorkspace()

  // Find the selected pillar object - check both state and selectedNode
  const currentPillarId = pillarId || selectedNode?.pillarId || null
  const selectedPillar = useMemo(() => {
    if (!currentPillarId) return null
    return availablePillars.find((p) => p.id === currentPillarId) || null
  }, [currentPillarId, availablePillars])

  // Build complete cycles list including current cycleId if not in availableCycles
  const allCycles = useMemo(() => {
    const cycles = [...availableCycles]
    // If selectedNode has a cycleId that isn't in availableCycles, add it as an option
    const nodeCycleId = selectedNode?.cycleId
    if (nodeCycleId && nodeCycleId !== "none" && nodeCycleId !== "" && !availableCycles.some(c => c.id === nodeCycleId)) {
      cycles.push({
        id: nodeCycleId,
        name: selectedNode?.cycleName || `Cycle ${nodeCycleId.substring(0, 8)}...`
      })
    }
    return cycles
  }, [availableCycles, selectedNode?.cycleId, selectedNode?.cycleName])

  const { isTenantAdmin } = useTenantAdmin()
  const tenantPermissions = useTenantPermissions()
  const { toast } = useToast()

  // Determine current type based on workspaceId/teamId
  const currentType = useMemo(() => {
    if (!selectedNode) return 'company'
    if (selectedNode.teamId) return 'team'
    if (selectedNode.workspaceId) return 'workspace'
    return 'company'
  }, [selectedNode?.teamId, selectedNode?.workspaceId])

  // Check if type can be changed (company type cannot be changed)
  const canChangeType = currentType !== 'company'

  // Load objective data when node changes
  useEffect(() => {
    if (selectedNode && selectedNode.type === 'objective') {
      console.log('[SidePanelEditObjective] Loading node data:', {
        id: selectedNode.id,
        teamId: selectedNode.teamId,
        workspaceId: selectedNode.workspaceId,
        level: selectedNode.teamId ? 'team' : selectedNode.workspaceId ? 'workspace' : 'company'
      })
      setTitle(selectedNode.title || "")
      setOwnerId(selectedNode.ownerId || "")
      setWorkspaceId(selectedNode.workspaceId || "")
      // Set type based on workspaceId/teamId - default to current type
      if (selectedNode.teamId) {
        setLevel('team')
        setTeamId(selectedNode.teamId) // Set teamId after setting level to 'team'
        console.log('[SidePanelEditObjective] Set team level with teamId:', selectedNode.teamId)
      } else if (selectedNode.workspaceId) {
        setLevel('workspace')
        setTeamId("") // Clear teamId for workspace level
      } else {
        setLevel('company')
        setTeamId("") // Clear teamId for company level
      }
      // Use cycleId directly from selectedNode - ensure it's set correctly
      if (selectedNode.cycleId) {
        setCycleId(selectedNode.cycleId)
      } else {
        setCycleId("")
      }
      // Set status - use selectedNode.status directly if valid, otherwise default to ON_TRACK
      const nodeStatus = selectedNode.status
      
      if (nodeStatus && typeof nodeStatus === 'string' && VALID_OKR_STATUSES.includes(nodeStatus as OKRStatus)) {
        setStatus(nodeStatus as OKRStatus)
      } else if (nodeStatus && typeof nodeStatus === 'string') {
        // Try case-insensitive match
        const normalized = nodeStatus.toUpperCase()
        const matched = VALID_OKR_STATUSES.find(s => s.toUpperCase() === normalized)
        if (matched) {
          setStatus(matched)
        } else {
          setStatus("ON_TRACK")
        }
      } else {
        // Default to ON_TRACK if status is missing or invalid
        setStatus("ON_TRACK")
      }
      setGoalType((selectedNode as any).goalType || "ASPIRATIONAL")
      setVisibilityLevel((selectedNode.visibilityLevel as VisibilityLevel) || "PUBLIC_TENANT")
      setIsPublished(selectedNode.isPublished || false)
      setPillarId(selectedNode.pillarId || null)
    } else {
      // Reset form when no node is selected
      setTitle("")
      setOwnerId("")
      setWorkspaceId("")
      setTeamId("")
      setLevel('company')
      setCycleId("")
      setPillarId(null)
      setStatus("ON_TRACK")
    }
  }, [selectedNode?.id])

  // Reset workspace/team when level/type changes (but only if level actually changed, not on initial load)
  // Use a ref to track if this is the initial load
  const isInitialLoadRef = useRef(true)
  useEffect(() => {
    if (isInitialLoadRef.current) {
      // Skip reset on initial load
      isInitialLoadRef.current = false
      return
    }
    
    // Only reset if level is explicitly set and different from current type
    if (level && level !== currentType) {
      console.log('[SidePanelEditObjective] Level changed, resetting workspace/team:', { level, currentType })
      const effectiveLevel = level
      if (effectiveLevel === 'company') {
        setWorkspaceId("")
        setTeamId("")
      } else if (effectiveLevel === 'workspace') {
        setTeamId("")
      }
    }
  }, [level, currentType])
  
  // Reset initial load flag when selectedNode changes
  useEffect(() => {
    isInitialLoadRef.current = true
  }, [selectedNode?.id])

  // Load owners
  useEffect(() => {
    const loadOwners = async () => {
      if (selectedNode?.id) {
        setIsLoadingOwners(true)
        try {
          const ownersData = await getObjectiveOwners(selectedNode.id)
          setOwners(ownersData)
        } catch (error) {
          console.error('Failed to load owners:', error)
          setOwners([])
        } finally {
          setIsLoadingOwners(false)
        }
      } else {
        setOwners([])
      }
    }
    loadOwners()
  }, [selectedNode?.id])

  // Load strategic pillars
  useEffect(() => {
    if (currentOrganization?.id) {
      api.get('/reports/pillars')
        .then((res) => {
          const pillars = res.data || []
          setAvailablePillars(pillars)
          // If we have a pillarId from selectedNode but it's not in state yet, set it
          if (selectedNode?.pillarId && !pillarId && pillars.some((p: { id: string }) => p.id === selectedNode.pillarId)) {
            setPillarId(selectedNode.pillarId)
          }
        })
        .catch((err) => {
          console.error('Failed to fetch strategic pillars', err)
        })
    }
  }, [currentOrganization?.id, selectedNode?.pillarId, pillarId])


  const handleAddOwner = async (userId: string) => {
    if (!selectedNode?.id) return
    await addObjectiveOwner(selectedNode.id, userId)
    const ownersData = await getObjectiveOwners(selectedNode.id)
    setOwners(ownersData)
  }

  const handleRemoveOwner = async (userId: string) => {
    if (!selectedNode?.id) return
    await removeObjectiveOwner(selectedNode.id, userId)
    const ownersData = await getObjectiveOwners(selectedNode.id)
    setOwners(ownersData)
  }

  const canEditOwners = useMemo(() => {
    if (!selectedNode || !selectedNode.id) return false
    return tenantPermissions.canEditObjective({
      id: selectedNode.id,
      ownerId: selectedNode.ownerId,
      tenantId: currentOrganization?.id || null,
      workspaceId: selectedNode.workspaceId || null,
      teamId: selectedNode.teamId || null,
      isPublished: isPublished,
      cycle: null,
      cycleStatus: null,
    })
  }, [selectedNode, isPublished, tenantPermissions, currentOrganization?.id])

  const canPublish = useMemo(() => {
    if (!selectedNode || !selectedNode.id) return false
    return isTenantAdmin ||
      (selectedNode.workspaceId && tenantPermissions.canEditObjective({
        id: selectedNode.id,
        ownerId: selectedNode.ownerId,
        tenantId: currentOrganization?.id || null,
        workspaceId: selectedNode.workspaceId || null,
        teamId: selectedNode.teamId || null,
        isPublished: false,
        cycle: null,
        cycleStatus: null,
      }))
  }, [isTenantAdmin, selectedNode, tenantPermissions, currentOrganization?.id])

  const canUnpublish = useMemo(() => {
    if (!selectedNode || !selectedNode.id) return false
    return isTenantAdmin || tenantPermissions.canEditObjective({
      id: selectedNode.id,
      ownerId: selectedNode.ownerId,
      tenantId: currentOrganization?.id || null,
      workspaceId: selectedNode.workspaceId || null,
      teamId: selectedNode.teamId || null,
      isPublished: isPublished,
      cycle: null,
      cycleStatus: null,
    })
  }, [isTenantAdmin, selectedNode, isPublished, tenantPermissions, currentOrganization?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !ownerId) {
      toast({
        title: 'Validation Error',
        description: 'Title and owner are required',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const effectiveLevel = level || currentType
      await onSave({
        title: title.trim(),
        ownerId,
        workspaceId: effectiveLevel === 'workspace' || effectiveLevel === 'team' ? (workspaceId || undefined) : undefined,
        teamId: effectiveLevel === 'team' ? (teamId || undefined) : undefined,
        cycleId: cycleId || undefined,
        status,
        goalType,
        visibilityLevel,
        pillarId: pillarId || undefined,
      })
    } catch (error) {
      console.error("Failed to update objective:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!selectedNode || selectedNode.type !== 'objective') {
    return null
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col w-full bg-slate-900 m-0 p-0">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 border-b border-slate-800 p-0 h-9">
          <TabsTrigger 
            value="basic" 
            className="text-xs font-medium data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 text-slate-400 hover:text-slate-300 rounded-none h-full"
          >
            Basic
          </TabsTrigger>
          <TabsTrigger 
            value="settings" 
            className="text-xs font-medium data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 text-slate-400 hover:text-slate-300 rounded-none h-full"
          >
            Settings
          </TabsTrigger>
          <TabsTrigger 
            value="metadata" 
            className="text-xs font-medium data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 text-slate-400 hover:text-slate-300 rounded-none h-full"
          >
            Metadata
          </TabsTrigger>
        </TabsList>

        {/* Basic Tab */}
        <TabsContent value="basic" className="p-4 space-y-4 mt-0">
          <div className="space-y-2">
            <Label htmlFor="edit-title" className="text-sm font-medium text-slate-200">
              Title <span className="text-red-400">*</span>
            </Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter objective title"
              required
              className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-10 focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-owner" className="text-sm font-medium text-slate-200">
              Primary Owner <span className="text-red-400">*</span>
            </Label>
            <SearchableUserSelect
              value={ownerId}
              onValueChange={setOwnerId}
              availableUsers={availableUsers}
              placeholder="Select owner"
              id="edit-owner"
              required
            />
          </div>

          {selectedNode.id && (
            <div className="space-y-2 border-t border-slate-800 pt-4">
              {isLoadingOwners ? (
                <div className="text-sm text-slate-500">Loading owners...</div>
              ) : (
                <OwnerList
                  owners={owners}
                  availableUsers={availableUsers}
                  onAddOwner={handleAddOwner}
                  onRemoveOwner={handleRemoveOwner}
                  canEdit={canEditOwners}
                  resourceType="objective"
                  resourceId={selectedNode.id}
                  size="md"
                />
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-type" className="text-sm font-medium text-slate-200">
              Type <span className="text-red-400">*</span>
            </Label>
            <Select 
              value={level || currentType} 
              onValueChange={(value: string) => setLevel(value as 'company' | 'workspace' | 'team')} 
              required
              disabled={!canChangeType}
            >
              <SelectTrigger id="edit-type" className="bg-slate-800/50 border-slate-700 text-white h-10 hover:bg-slate-700 focus:border-indigo-500 focus:ring-indigo-500 disabled:opacity-50">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                <SelectItem value="company" className="text-white focus:bg-slate-700">Company</SelectItem>
                <SelectItem value="workspace" className="text-white focus:bg-slate-700">Workspace</SelectItem>
                <SelectItem value="team" className="text-white focus:bg-slate-700">Team</SelectItem>
              </SelectContent>
            </Select>
            {!canChangeType && (
              <p className="text-xs text-slate-500">Company-type objectives cannot be changed to workspace or team type.</p>
            )}
          </div>

          {(level || currentType) === 'company' && currentOrganization && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-200">Organization</Label>
              <div className="text-sm text-slate-400 p-2 bg-slate-800/50 rounded border border-slate-700">
                {currentOrganization.name || currentOrganization.id}
              </div>
            </div>
          )}

          {(level || currentType) === 'workspace' && (
            <div className="space-y-2">
              <Label htmlFor="edit-workspace" className="text-sm font-medium text-slate-200">
                Workspace <span className="text-red-400">*</span>
              </Label>
              {availableWorkspaces.length === 0 ? (
                <div className="text-sm text-slate-400 p-2">No workspaces available</div>
              ) : (
                <Popover open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={workspaceOpen}
                      className="w-full justify-between h-10 bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700 hover:text-white"
                    >
                      <span className={cn(
                        'truncate',
                        workspaceId ? 'text-white' : 'text-slate-400'
                      )}>
                        {workspaceId
                          ? availableWorkspaces.find((w) => w.id === workspaceId)?.name || 'Select workspace'
                          : 'Select workspace'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-70" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 bg-slate-800 border-slate-700" align="start">
                    <Command className="bg-slate-800">
                      <CommandInput 
                        placeholder="Search workspaces..." 
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      />
                      <CommandList>
                        <CommandEmpty className="text-slate-400">No workspaces found.</CommandEmpty>
                        <CommandGroup>
                          {availableWorkspaces.map((workspace) => (
                            <CommandItem
                              key={workspace.id}
                              value={`${workspace.name} ${workspace.id}`}
                              onSelect={() => {
                                setWorkspaceId(workspace.id)
                                setWorkspaceOpen(false)
                              }}
                              className="cursor-pointer !opacity-100 !pointer-events-auto text-white hover:bg-slate-700 focus:bg-slate-700"
                              style={{ opacity: 1, pointerEvents: 'auto' }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  workspaceId === workspace.id ? 'opacity-100 text-indigo-400' : 'opacity-0'
                                )}
                              />
                              <span className="text-white">{workspace.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}

          {(level || currentType) === 'team' && (
            <div className="space-y-2">
              <Label htmlFor="edit-team" className="text-sm font-medium text-slate-200">
                Team <span className="text-red-400">*</span>
              </Label>
              {availableTeams.length === 0 ? (
                <div className="text-sm text-slate-400 p-2">No teams available</div>
              ) : (
                <Popover open={teamOpen} onOpenChange={setTeamOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={teamOpen}
                      className="w-full justify-between h-10 bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700 hover:text-white"
                    >
                      <span className={cn(
                        'truncate',
                        teamId ? 'text-white' : 'text-slate-400'
                      )}>
                        {(() => {
                          if (!teamId) return 'Select team'
                          const foundTeam = availableTeams.find((t) => t.id === teamId)
                          if (foundTeam) return foundTeam.name
                          console.warn('[SidePanelEditObjective] Team not found in availableTeams:', {
                            teamId,
                            availableTeamIds: availableTeams.map(t => t.id),
                            selectedNodeTeamId: selectedNode?.teamId
                          })
                          return `Team ID: ${teamId} (not in list)`
                        })()}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-70" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 bg-slate-800 border-slate-700" align="start">
                    <Command className="bg-slate-800">
                      <CommandInput 
                        placeholder="Search teams..." 
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      />
                      <CommandList>
                        <CommandEmpty className="text-slate-400">No teams found.</CommandEmpty>
                        <CommandGroup>
                          {availableTeams
                            .filter((team) => !workspaceId || team.workspaceId === workspaceId)
                            .map((team) => (
                            <CommandItem
                              key={team.id}
                              value={`${team.name} ${team.id}`}
                              onSelect={() => {
                                setTeamId(team.id)
                                // Automatically set workspace from team's workspaceId
                                if (team.workspaceId) {
                                  setWorkspaceId(team.workspaceId)
                                }
                                setTeamOpen(false)
                              }}
                              className="cursor-pointer !opacity-100 !pointer-events-auto text-white hover:bg-slate-700 focus:bg-slate-700"
                              style={{ opacity: 1, pointerEvents: 'auto' }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  teamId === team.id ? 'opacity-100 text-indigo-400' : 'opacity-0'
                                )}
                              />
                              <span className="text-white">{team.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}

          {availableCycles.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="edit-cycle" className="text-sm font-medium text-slate-200">Cycle / Period</Label>
              <Select 
                value={cycleId || selectedNode?.cycleId || "none"} 
                onValueChange={(value: string) => setCycleId(value === "none" ? "" : value)}
              >
                <SelectTrigger id="edit-cycle" className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500 hover:bg-slate-700">
                  <SelectValue placeholder="Select cycle" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="none" className="text-white focus:bg-slate-700">None</SelectItem>
                  {allCycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id} className="text-white focus:bg-slate-700">
                      {cycle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-pillar" className="text-sm font-medium text-slate-200">
              Strategic Pillar
            </Label>
            <Popover open={pillarOpen} onOpenChange={setPillarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pillarOpen}
                  className="w-full justify-between h-10 bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700 hover:text-white"
                >
                  <span className={cn(
                    'truncate flex items-center gap-2',
                    currentPillarId ? 'text-white' : 'text-slate-400'
                  )}>
                    {selectedPillar ? (
                      <>
                        {selectedPillar.color && (
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: selectedPillar.color }}
                          />
                        )}
                        {selectedPillar.name}
                      </>
                    ) : currentPillarId ? (
                      // Show ID if pillar not found in availablePillars yet (still loading)
                      `Pillar ${currentPillarId}`
                    ) : (
                      'None (optional)'
                    )}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-70" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0 !bg-slate-800 !border-slate-700 !text-white" align="start" style={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#ffffff' }}>
                <Command className="!bg-slate-800 !text-white" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                  <CommandInput
                    placeholder="Search pillars..."
                    className="!bg-slate-800 !border-slate-700 !text-white placeholder:!text-slate-500"
                    style={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#ffffff' }}
                  />
                  <CommandList className="!bg-slate-800" style={{ backgroundColor: '#1e293b' }}>
                    <CommandEmpty className="!text-slate-400">No strategic pillars found.</CommandEmpty>
                    <CommandGroup className="!bg-slate-800" style={{ backgroundColor: '#1e293b' }}>
                      <CommandItem
                        value="none"
                        onSelect={() => {
                          setPillarId(null)
                          setPillarOpen(false)
                        }}
                        className="cursor-pointer !opacity-100 !pointer-events-auto !text-white hover:!bg-slate-700 focus:!bg-slate-700"
                        style={{ opacity: 1, pointerEvents: 'auto', color: '#ffffff' }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            !currentPillarId ? 'opacity-100 text-indigo-400' : 'opacity-0'
                          )}
                        />
                        <span className="text-white">None (optional)</span>
                      </CommandItem>
                      {availablePillars.map((pillar) => (
                        <CommandItem
                          key={pillar.id}
                          value={`${pillar.name} ${pillar.id}`}
                          onSelect={() => {
                            setPillarId(pillar.id)
                            setPillarOpen(false)
                          }}
                          className="cursor-pointer !opacity-100 !pointer-events-auto !text-white hover:!bg-slate-700 focus:!bg-slate-700"
                          style={{ opacity: 1, pointerEvents: 'auto', color: '#ffffff' }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              currentPillarId === pillar.id ? 'opacity-100 text-indigo-400' : 'opacity-0'
                            )}
                          />
                          <div className="flex items-center gap-2">
                            {pillar.color && (
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: pillar.color }}
                              />
                            )}
                            <span className="text-white">{pillar.name}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-slate-500 mt-2">Link this objective to a strategic pillar for reporting and grouping.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-status" className="text-sm font-medium text-slate-200">
              Status <span className="text-red-400">*</span>
            </Label>
            <Select 
              value={status || (selectedNode?.status && VALID_OKR_STATUSES.includes(selectedNode.status as OKRStatus) ? selectedNode.status : "ON_TRACK")} 
              onValueChange={(value: string) => setStatus(value as OKRStatus)} 
              required
            >
              <SelectTrigger id="edit-status" className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500 hover:bg-slate-700">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                <SelectItem value="NOT_STARTED" className="text-white focus:bg-slate-700">Not Started</SelectItem>
                <SelectItem value="ON_TRACK" className="text-white focus:bg-slate-700">On Track</SelectItem>
                <SelectItem value="AT_RISK" className="text-white focus:bg-slate-700">At Risk</SelectItem>
                <SelectItem value="OFF_TRACK" className="text-white focus:bg-slate-700">Off Track</SelectItem>
                <SelectItem value="COMPLETED" className="text-white focus:bg-slate-700">Completed</SelectItem>
                <SelectItem value="CANCELLED" className="text-white focus:bg-slate-700">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <GoalTypeSelector
            value={goalType}
            onValueChange={setGoalType}
            label="Goal Type"
            id="edit-goal-type"
          />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="p-4 space-y-4 mt-0">
          <div className="space-y-2">
            <Label htmlFor="edit-visibility" className="text-sm font-medium text-slate-200">
              Visibility <span className="text-red-400">*</span>
            </Label>
            <Select
              value={visibilityLevel}
              onValueChange={(value: string) => setVisibilityLevel(value as VisibilityLevel)}
              required
            >
              <SelectTrigger id="edit-visibility" className="bg-slate-800/50 border-slate-700 text-white h-10 focus:border-indigo-500 focus:ring-indigo-500 hover:bg-slate-700">
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                <SelectItem value="PUBLIC_TENANT" className="text-white focus:bg-slate-700">Public (Tenant)</SelectItem>
                <SelectItem value="PRIVATE" className="text-white focus:bg-slate-700">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedNode.id && (
            <div className="border-t border-slate-800 pt-4">
              <Label className="text-sm text-slate-300">Publish Status</Label>
              <div className="flex items-center justify-between mt-2 p-3 rounded-md border border-slate-800 bg-slate-800/50">
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-200">
                    {isPublished ? 'Published' : 'Draft'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {isPublished
                      ? 'This objective is published and locked. Only organization administrators can edit published objectives.'
                      : 'This objective is in draft mode and can be edited freely.'}
                  </p>
                </div>
                <div className="ml-4">
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()

                      if (!selectedNode.id || isTogglingPublish) {
                        return
                      }

                      const canToggle = isPublished ? canUnpublish : canPublish

                      if (!canToggle) {
                        toast({
                          title: 'Permission denied',
                          description: isPublished
                            ? 'Only organization administrators can unpublish objectives.'
                            : 'Only organization administrators or workspace leads can publish objectives.',
                          variant: 'destructive',
                        })
                        return
                      }

                      const newIsPublished = !isPublished
                      setIsTogglingPublish(true)

                      try {
                        await api.patch(`/objectives/${selectedNode.id}`, {
                          isPublished: newIsPublished
                        })

                        setIsPublished(newIsPublished)

                        toast({
                          title: newIsPublished ? 'Objective published' : 'Objective unpublished',
                          description: newIsPublished
                            ? 'This objective is now published and locked for editing.'
                            : 'This objective is now in draft mode and can be edited.',
                        })
                      } catch (error: any) {
                        console.error('[SidePanelEditObjective] Failed to update publish status:', error)
                        const errorMessage = error.response?.data?.message || error.message || 'Failed to update publish status'
                        toast({
                          title: 'Error',
                          description: errorMessage,
                          variant: 'destructive',
                        })
                      } finally {
                        setIsTogglingPublish(false)
                      }
                    }}
                    disabled={isTogglingPublish || (isPublished ? !canUnpublish : !canPublish)}
                    className={cn(
                      'px-4 py-2 rounded-md text-sm font-medium transition-colors h-10',
                      isPublished
                        ? 'bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                        : 'bg-indigo-600 text-white hover:bg-indigo-500',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {isTogglingPublish ? 'Updating...' : (isPublished ? 'Unpublish' : 'Publish')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Metadata Tab */}
        <TabsContent value="metadata" className="p-4 space-y-4 mt-0">
          <div className="text-sm text-slate-400 py-4">
            Additional metadata features coming soon.
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex-shrink-0 p-6 border-t border-slate-800 bg-slate-900 flex gap-3">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel} 
          disabled={isSubmitting} 
          className="flex-1 bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-10 font-medium"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting || !title.trim() || !ownerId} 
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white h-10 font-medium"
        >
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  )
}

