'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/auth.context'
import { addObjectiveOwner, type Owner } from '@/lib/okr-owners-api'
import api from '@/lib/api'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type OKRStatus = "NOT_STARTED" | "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "COMPLETED" | "CANCELLED"
type VisibilityLevel = "PUBLIC_TENANT" | "PRIVATE"

interface SidePanelCreateObjectiveProps {
  onSave: (data: {
    title: string
    description?: string
    ownerId: string
    tenantId?: string | null
    workspaceId?: string
    teamId?: string
    cycleId: string
    startDate: string
    endDate: string
    status: OKRStatus
    goalType?: 'ASPIRATIONAL' | 'COMMITTED'
    visibilityLevel: VisibilityLevel
    parentId?: string
    additionalOwnerIds?: string[]
    pillarId?: string | null
  }) => Promise<{ id: string }>
  onCancel: () => void
  availableUsers?: Array<{ id: string; name: string; email?: string }>
  availableWorkspaces?: Array<{ id: string; name: string }>
  availableCycles?: Array<{ id: string; name: string; startDate?: string | Date; endDate?: string | Date }>
  availableTeams?: Array<{ id: string; name: string; workspaceId?: string }>
  parentObjectiveId?: string
  parentObjectiveTitle?: string
  defaultCycleId?: string
  defaultWorkspaceId?: string
  defaultTeamId?: string
  currentOrganization?: { id: string; name?: string } | null
}

export function SidePanelCreateObjective({
  onSave,
  onCancel,
  availableUsers = [],
  availableWorkspaces = [],
  availableCycles = [],
  availableTeams = [],
  parentObjectiveId,
  parentObjectiveTitle,
  defaultCycleId,
  defaultWorkspaceId,
  defaultTeamId,
  currentOrganization,
}: SidePanelCreateObjectiveProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [ownerId, setOwnerId] = useState("")
  const [level, setLevel] = useState<'company' | 'workspace' | 'team'>('company')
  const [workspaceId, setWorkspaceId] = useState<string>(defaultWorkspaceId || "")
  const [teamId, setTeamId] = useState<string>(defaultTeamId || "")
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
  const [cycleId, setCycleId] = useState<string>(() => {
    // Default to defaultCycleId if provided and available, otherwise first available cycle
    if (defaultCycleId && availableCycles.some(c => c.id === defaultCycleId)) {
      return defaultCycleId
    }
    return availableCycles.length > 0 ? availableCycles[0].id : ""
  })
  const [status, setStatus] = useState<OKRStatus>("ON_TRACK")
  const [goalType, setGoalType] = useState<'ASPIRATIONAL' | 'COMMITTED'>('ASPIRATIONAL')
  const [visibilityLevel, setVisibilityLevel] = useState<VisibilityLevel>("PUBLIC_TENANT")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [parentId, setParentId] = useState<string>(parentObjectiveId || "")
  const [availableObjectives, setAvailableObjectives] = useState<Array<{ id: string; title: string }>>([])
  const [parentObjectiveOpen, setParentObjectiveOpen] = useState(false)
  const [additionalOwners, setAdditionalOwners] = useState<Owner[]>([])
  const [createdObjectiveId, setCreatedObjectiveId] = useState<string | null>(null)
  const [pillarId, setPillarId] = useState<string | null>(null)
  const [availablePillars, setAvailablePillars] = useState<Array<{ id: string; name: string; color?: string | null; description?: string | null }>>([])
  const [pillarOpen, setPillarOpen] = useState(false)

  const { toast } = useToast()
  const { user } = useAuth()

  // Set default owner to current user
  useEffect(() => {
    if (user?.id && !ownerId) {
      setOwnerId(user.id)
    }
  }, [user?.id, ownerId])

  // Update cycleId when defaultCycleId changes
  useEffect(() => {
    if (defaultCycleId && availableCycles.some(c => c.id === defaultCycleId)) {
      setCycleId(defaultCycleId)
    }
  }, [defaultCycleId, availableCycles])

  // Set default level based on defaultWorkspaceId/defaultTeamId
  useEffect(() => {
    if (defaultTeamId) {
      setLevel('team')
      setTeamId(defaultTeamId)
    } else if (defaultWorkspaceId) {
      setLevel('workspace')
      setWorkspaceId(defaultWorkspaceId)
    }
  }, [defaultWorkspaceId, defaultTeamId])

  // Reset workspace/team when level changes
  useEffect(() => {
    if (level === 'company') {
      setWorkspaceId("")
      setTeamId("")
    } else if (level === 'workspace') {
      setTeamId("")
      if (!workspaceId && defaultWorkspaceId) {
        setWorkspaceId(defaultWorkspaceId)
      }
    } else if (level === 'team') {
      if (!teamId && defaultTeamId) {
        setTeamId(defaultTeamId)
        // Also set workspace if team has one
        const team = availableTeams.find(t => t.id === defaultTeamId)
        if (team?.workspaceId) {
          setWorkspaceId(team.workspaceId)
        }
      }
    }
  }, [level, defaultWorkspaceId, defaultTeamId, availableTeams])

  // Load objectives for parent selection
  useEffect(() => {
    if (currentOrganization?.id) {
      api.get(`/okr/overview?tenantId=${currentOrganization.id}&pageSize=50`)
        .then((res) => {
          const objectives = res.data?.objectives || []
          // Map objectives to the format we need
          const allObjectives = objectives.map((obj: any) => ({
            id: obj.objectiveId || obj.id,
            title: obj.title,
          }))
          
          // If parentObjectiveId exists but isn't in the fetched list, add it with the provided title
          if (parentObjectiveId && parentObjectiveTitle && !allObjectives.find((obj: { id: string; title: string }) => obj.id === parentObjectiveId)) {
            allObjectives.unshift({
              id: parentObjectiveId,
              title: parentObjectiveTitle,
            })
          }
          
          setAvailableObjectives(allObjectives)
        })
        .catch((err) => {
          console.error('Failed to fetch objectives for parent selection', err)
        })
    }
  }, [currentOrganization?.id, parentObjectiveId, parentObjectiveTitle])

  // Load strategic pillars
  useEffect(() => {
    if (currentOrganization?.id) {
      api.get('/reports/pillars')
        .then((res) => {
          setAvailablePillars(res.data || [])
        })
        .catch((err) => {
          console.error('Failed to fetch strategic pillars', err)
        })
    }
  }, [currentOrganization?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !ownerId || !cycleId) {
      toast({
        title: 'Validation Error',
        description: 'Title, owner, and cycle are required',
        variant: 'destructive',
      })
      return
    }

    if (level === 'workspace' && !workspaceId) {
      toast({
        title: 'Validation Error',
        description: 'Workspace is required',
        variant: 'destructive',
      })
      return
    }

    if (level === 'team' && !teamId) {
      toast({
        title: 'Validation Error',
        description: 'Team is required',
        variant: 'destructive',
      })
      return
    }

    // Get startDate and endDate from the selected cycle
    const selectedCycle = availableCycles.find(c => c.id === cycleId)
    if (!selectedCycle?.startDate || !selectedCycle?.endDate) {
      toast({
        title: 'Validation Error',
        description: 'Selected cycle must have start and end dates',
        variant: 'destructive',
      })
      return
    }

    // Format dates as ISO strings for the API
    const startDate = selectedCycle.startDate instanceof Date
      ? selectedCycle.startDate.toISOString()
      : new Date(selectedCycle.startDate).toISOString()
    const endDate = selectedCycle.endDate instanceof Date
      ? selectedCycle.endDate.toISOString()
      : new Date(selectedCycle.endDate).toISOString()

    setIsSubmitting(true)
    try {
      const result = await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        ownerId,
        tenantId: level === 'company' ? (currentOrganization?.id || null) : undefined,
        workspaceId: level === 'workspace' || level === 'team' ? (workspaceId || undefined) : undefined,
        teamId: level === 'team' ? (teamId || undefined) : undefined,
        cycleId,
        startDate,
        endDate,
        status,
        goalType,
        visibilityLevel,
        parentId: parentId || undefined,
        additionalOwnerIds: additionalOwners.map(o => o.userId),
        pillarId: pillarId || undefined,
      })
      
      // Reset form
      setTitle("")
      setDescription("")
      setOwnerId("")
      setLevel('company')
      setWorkspaceId("")
      setTeamId("")
      setCycleId(availableCycles.length > 0 ? availableCycles[0].id : "")
      setStatus("ON_TRACK")
      setGoalType('ASPIRATIONAL')
      setVisibilityLevel("PUBLIC_TENANT")
      setAdditionalOwners([])
      setCreatedObjectiveId(null)
      setPillarId(null)
    } catch (error) {
      console.error("Failed to create objective:", error)
      // Re-throw error to propagate to parent handler
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-start justify-start h-full bg-slate-900 m-0 p-0">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col items-start justify-start flex-1 min-h-0 m-0 w-full">
        <TabsList className="grid w-full grid-cols-2 flex-shrink-0 bg-slate-800/50 border-b border-slate-800 p-0 h-9 m-0 self-start">
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
        </TabsList>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Basic Tab */}
          <TabsContent value="basic" className="space-y-5 mt-0">
            <div className="space-y-5">
              {/* Core Information */}
              <div className="space-y-2">
                <Label htmlFor="create-title" className="text-sm font-medium text-slate-200">
                  Title <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="create-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter objective title"
                  required
                  autoFocus
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-10 focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-description" className="text-sm text-slate-300">Description</Label>
                <Textarea
                  id="create-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter objective description (optional)"
                  rows={3}
                  className="bg-slate-800 border-slate-700 text-white resize-none"
                />
              </div>

              {/* Ownership */}
              <div className="space-y-2">
                <Label htmlFor="create-owner" className="text-sm font-medium text-slate-200">
                  Primary Owner <span className="text-red-400">*</span>
                </Label>
                <SearchableUserSelect
                  value={ownerId}
                  onValueChange={setOwnerId}
                  availableUsers={availableUsers}
                  placeholder="Select primary owner"
                  id="create-owner"
                  required
                />
              </div>

              {ownerId && (
                <div className="space-y-2 border-t border-slate-800 pt-4">
                  <OwnerList
                    owners={additionalOwners}
                    availableUsers={availableUsers.filter(u => u.id !== ownerId)}
                    onAddOwner={async (userId: string) => {
                      const user = availableUsers.find(u => u.id === userId)
                      if (user && !additionalOwners.some(o => o.userId === userId)) {
                        setAdditionalOwners([...additionalOwners, {
                          id: `temp-${userId}-${Date.now()}`,
                          userId: userId,
                          userName: user.name,
                          userEmail: user.email || '',
                          isPrimary: false,
                          createdAt: new Date().toISOString(),
                        }])
                      }
                    }}
                    onRemoveOwner={async (userId: string) => {
                      setAdditionalOwners(additionalOwners.filter(o => o.userId !== userId))
                    }}
                    canEdit={true}
                    resourceType="objective"
                    resourceId={createdObjectiveId || 'temp-create'}
                    size="md"
                  />
                </div>
              )}

              {/* Planning & Status */}
              {availableCycles.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="create-cycle" className="text-sm text-slate-300">
                    Cycle <span className="text-red-500">*</span>
                  </Label>
                  <Select value={cycleId} onValueChange={setCycleId} required>
                    <SelectTrigger id="create-cycle" className="bg-slate-800/50 border-slate-700 text-white h-10 hover:bg-slate-700 focus:border-indigo-500 focus:ring-indigo-500">
                      <SelectValue placeholder="Select cycle" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                      {availableCycles.map((cycle) => (
                        <SelectItem key={cycle.id} value={cycle.id} className="text-white focus:bg-slate-700">
                          {cycle.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-status" className="text-sm text-slate-300">
                    Status <span className="text-red-500">*</span>
                  </Label>
                  <Select value={status} onValueChange={(value: string) => setStatus(value as OKRStatus)} required>
                    <SelectTrigger id="create-status" className="bg-slate-800/50 border-slate-700 text-white h-10 hover:bg-slate-700 focus:border-indigo-500 focus:ring-indigo-500">
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
                  id="create-goal-type"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-level" className="text-sm font-medium text-slate-200">
                  Level <span className="text-red-400">*</span>
                </Label>
                <Select value={level} onValueChange={(value: string) => setLevel(value as 'company' | 'workspace' | 'team')} required>
                  <SelectTrigger id="create-level" className="bg-slate-800/50 border-slate-700 text-white h-10 hover:bg-slate-700 focus:border-indigo-500 focus:ring-indigo-500">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="company" className="text-white focus:bg-slate-700">Company</SelectItem>
                    <SelectItem value="workspace" className="text-white focus:bg-slate-700">Workspace</SelectItem>
                    <SelectItem value="team" className="text-white focus:bg-slate-700">Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {level === 'company' && currentOrganization && (
                <div className="space-y-2">
                  <Label htmlFor="create-organization" className="text-sm text-slate-300">Organization</Label>
                  <Input
                    id="create-organization"
                    value={currentOrganization.name || currentOrganization.id}
                    disabled
                    className="bg-slate-800/50 border-slate-700 text-slate-400 h-10"
                  />
                  <p className="text-xs text-slate-500">Current organization will be assigned</p>
                </div>
              )}

              {level === 'workspace' && (
                <div className="space-y-2">
                  <Label htmlFor="create-workspace" className="text-sm font-medium text-slate-200">
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

              {level === 'team' && (
                <div className="space-y-2">
                  <Label htmlFor="create-team" className="text-sm font-medium text-slate-200">
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
                            {teamId
                              ? availableTeams.find((t) => t.id === teamId)?.name || 'Select team'
                              : 'Select team'}
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
                              {availableTeams.map((team) => (
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

              <div className="space-y-2">
                <Label htmlFor="create-parent" className="text-sm text-slate-300">
                  Parent Objective
                </Label>
                  <Popover open={parentObjectiveOpen} onOpenChange={setParentObjectiveOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={parentObjectiveOpen}
                        className="w-full min-h-[4rem] h-auto py-2 bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700 hover:text-white !justify-between !items-start !whitespace-normal"
                      >
                        <span className={cn(
                          'text-left flex-1 break-words pr-2 min-w-0',
                          parentId ? 'text-white' : 'text-slate-400'
                        )}>
                          {parentId
                            ? availableObjectives.find((obj) => obj.id === parentId)?.title || 'Select parent objective'
                            : 'None (root objective)'}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-70 mt-0.5 flex-shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[400px] p-0 bg-slate-800 border-slate-700" align="start">
                      <Command className="bg-slate-800">
                        <CommandInput 
                          placeholder="Search objectives..." 
                          className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                        />
                        <CommandList>
                          <CommandEmpty className="text-slate-400">No objectives found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="none"
                              onSelect={() => {
                                setParentId("")
                                setParentObjectiveOpen(false)
                              }}
                              className="cursor-pointer !opacity-100 !pointer-events-auto text-white hover:bg-slate-700 focus:bg-slate-700"
                              style={{ opacity: 1, pointerEvents: 'auto' }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  !parentId ? 'opacity-100 text-indigo-400' : 'opacity-0'
                                )}
                              />
                              <span className="text-white">None (root objective)</span>
                            </CommandItem>
                            {availableObjectives.map((obj) => (
                              <CommandItem
                                key={obj.id}
                                value={`${obj.title} ${obj.id}`}
                                onSelect={() => {
                                  setParentId(obj.id)
                                  setParentObjectiveOpen(false)
                                }}
                                className="cursor-pointer !opacity-100 !pointer-events-auto text-white hover:bg-slate-700 focus:bg-slate-700"
                                style={{ opacity: 1, pointerEvents: 'auto' }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4 shrink-0',
                                    parentId === obj.id ? 'opacity-100 text-indigo-400' : 'opacity-0'
                                  )}
                                />
                                <span className="text-white truncate">{obj.title}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                <p className="text-xs text-slate-500 mt-2">Select a parent objective to create a nested objective, or leave as root.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-pillar" className="text-sm text-slate-300">
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
                        pillarId ? 'text-white' : 'text-slate-400'
                      )}>
                        {pillarId ? (
                          <>
                            {availablePillars.find((p) => p.id === pillarId)?.color && (
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: availablePillars.find((p) => p.id === pillarId)?.color || undefined }}
                              />
                            )}
                            {availablePillars.find((p) => p.id === pillarId)?.name || 'Select pillar'}
                          </>
                        ) : (
                          'None (no pillar)'
                        )}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-70" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 bg-slate-800 border-slate-700" align="start">
                    <Command className="bg-slate-800">
                      <CommandInput 
                        placeholder="Search pillars..." 
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      />
                      <CommandList>
                        <CommandEmpty className="text-slate-400">No pillars found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="none"
                            onSelect={() => {
                              setPillarId(null)
                              setPillarOpen(false)
                            }}
                            className="cursor-pointer !opacity-100 !pointer-events-auto text-white hover:bg-slate-700 focus:bg-slate-700"
                            style={{ opacity: 1, pointerEvents: 'auto' }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                !pillarId ? 'opacity-100 text-indigo-400' : 'opacity-0'
                              )}
                            />
                            <span className="text-white">None (no pillar)</span>
                          </CommandItem>
                          {availablePillars.map((pillar) => (
                            <CommandItem
                              key={pillar.id}
                              value={`${pillar.name} ${pillar.id}`}
                              onSelect={() => {
                                setPillarId(pillar.id)
                                setPillarOpen(false)
                              }}
                              className="cursor-pointer !opacity-100 !pointer-events-auto text-white hover:bg-slate-700 focus:bg-slate-700"
                              style={{ opacity: 1, pointerEvents: 'auto' }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  pillarId === pillar.id ? 'opacity-100 text-indigo-400' : 'opacity-0'
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
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-0">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-visibility" className="text-sm font-medium text-slate-200">
                  Visibility <span className="text-red-400">*</span>
                </Label>
                <Select
                  value={visibilityLevel}
                  onValueChange={(value: string) => setVisibilityLevel(value as VisibilityLevel)}
                  required
                >
                  <SelectTrigger id="create-visibility" className="bg-slate-800/50 border-slate-700 text-white h-10 hover:bg-slate-700 focus:border-indigo-500 focus:ring-indigo-500">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="PUBLIC_TENANT" className="text-white focus:bg-slate-700">Public (Tenant)</SelectItem>
                    <SelectItem value="PRIVATE" className="text-white focus:bg-slate-700">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>
          </TabsContent>
        </div>
      </Tabs>

      <div className="flex-shrink-0 p-6 border-t border-slate-800 bg-slate-900 flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1 bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-10">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !title.trim() || !ownerId || !cycleId} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white h-10 font-medium">
          {isSubmitting ? "Creating..." : "Create Objective"}
        </Button>
      </div>
    </form>
  )
}

