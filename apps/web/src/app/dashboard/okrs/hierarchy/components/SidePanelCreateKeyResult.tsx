'use client'

import React, { useState, useEffect } from 'react'
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
import { MetricTypeSelector } from '@/components/okr/MetricTypeSelector'
import { UnitInput } from '@/components/okr/UnitInput'
import { StandardCycleSelector } from '@/components/okr/StandardCycleSelector'
import { useToast } from '@/hooks/use-toast'
import { MetricType } from '@okr-nexus/types'
import api from '@/lib/api'

interface SidePanelCreateKeyResultProps {
  onSave: (data: {
    title: string
    objectiveId: string
    ownerId: string
    cycleId: string
    targetValue: number
    startValue: number
    unit: string
    metricType: MetricType
    goalType?: 'ASPIRATIONAL' | 'COMMITTED'
    teamId?: string | null
    weight?: number
  }) => Promise<void>
  onCancel: () => void
  availableUsers?: Array<{ id: string; name: string; email?: string }>
  availableCycles?: Array<{ id: string; name: string; status: string }>
  availableTeams?: Array<{ id: string; name: string; workspaceId?: string }>
  parentObjectiveId?: string
  currentOrganization?: { id: string } | null
}

export function SidePanelCreateKeyResult({
  onSave,
  onCancel,
  availableUsers = [],
  availableCycles = [],
  availableTeams = [],
  parentObjectiveId,
  currentOrganization,
}: SidePanelCreateKeyResultProps) {
  const [title, setTitle] = useState('')
  const [objectiveId, setObjectiveId] = useState<string>(parentObjectiveId || '')
  const [ownerId, setOwnerId] = useState('')
  const [cycleId, setCycleId] = useState<string>(availableCycles.length > 0 ? availableCycles[0].id : '')
  const [targetValue, setTargetValue] = useState<number>(100)
  const [startValue, setStartValue] = useState<number>(0)
  const [unit, setUnit] = useState('units')
  const [metricType, setMetricType] = useState<MetricType>(MetricType.INCREASE)
  const [goalType, setGoalType] = useState<'ASPIRATIONAL' | 'COMMITTED'>('ASPIRATIONAL')
  const [teamId, setTeamId] = useState<string | null>(null)
  const [weight, setWeight] = useState<number>(1.0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [availableObjectives, setAvailableObjectives] = useState<Array<{ id: string; title: string }>>([])

  const { toast } = useToast()

  // Load objectives for parent selection
  useEffect(() => {
    if (currentOrganization?.id && !parentObjectiveId) {
      api.get(`/okr/overview?tenantId=${currentOrganization.id}&pageSize=50`)
        .then((res) => {
          const objectives = res.data?.objectives || []
          setAvailableObjectives(objectives.map((obj: any) => ({
            id: obj.id || obj.objectiveId,
            title: obj.title,
          })))
        })
        .catch((err) => {
          console.error('Failed to fetch objectives for parent selection', err)
        })
    }
  }, [currentOrganization?.id, parentObjectiveId])

  // Update objectiveId when parentObjectiveId changes
  useEffect(() => {
    if (parentObjectiveId) {
      setObjectiveId(parentObjectiveId)
    }
  }, [parentObjectiveId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !objectiveId || !ownerId || !cycleId) {
      toast({
        title: 'Validation Error',
        description: 'Title, parent objective, owner, and cycle are required',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      await onSave({
        title: title.trim(),
        objectiveId,
        ownerId,
        cycleId,
        targetValue,
        startValue,
        unit,
        metricType,
        goalType,
        teamId: teamId || null,
        weight,
      })
      // Reset form
      setTitle('')
      setObjectiveId(parentObjectiveId || '')
      setOwnerId('')
      setCycleId(availableCycles.length > 0 ? availableCycles[0].id : '')
      setTargetValue(100)
      setStartValue(0)
      setUnit('units')
      setMetricType(MetricType.INCREASE)
      setGoalType('ASPIRATIONAL')
      setTeamId(null)
      setWeight(1.0)
    } catch (error) {
      console.error("Failed to create key result:", error)
      // Re-throw error to propagate to parent handler
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-start justify-start h-full bg-slate-900 m-0 p-0">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col items-start justify-start flex-1 min-h-0 m-0 w-full">
        <TabsList className="grid w-full grid-cols-3 flex-shrink-0 bg-slate-800/50 border-b border-slate-800 p-0 h-9 m-0 self-start">
          <TabsTrigger 
            value="basic" 
            className="text-xs font-medium data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 text-slate-400 hover:text-slate-300 rounded-none h-full"
          >
            Basic
          </TabsTrigger>
          <TabsTrigger 
            value="metrics" 
            className="text-xs font-medium data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 text-slate-400 hover:text-slate-300 rounded-none h-full"
          >
            Metrics
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
              <div className="space-y-2">
                <Label htmlFor="kr-title" className="text-sm font-medium text-slate-200">
                  Key Result Title <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="kr-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter key result title"
                  required
                  autoFocus
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-10 focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="kr-objective" className="text-sm text-slate-300">
                  Parent Objective <span className="text-red-500">*</span>
                </Label>
                {parentObjectiveId ? (
                  <>
                    <Input
                      id="kr-objective"
                      value="Pre-selected from context"
                      disabled
                      readOnly
                      className="bg-slate-800/50 border-slate-700 text-slate-400 cursor-not-allowed h-9"
                    />
                    <p className="text-xs text-slate-500">Parent objective is pre-selected from context.</p>
                  </>
                ) : (
                  <>
                    <Select
                      value={objectiveId}
                      onValueChange={setObjectiveId}
                      required
                    >
                      <SelectTrigger id="kr-objective" className="bg-slate-800 border-slate-700 text-white h-9">
                        <SelectValue placeholder="Select objective" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableObjectives.map((obj) => (
                          <SelectItem key={obj.id} value={obj.id}>
                            {obj.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">Select the objective this key result measures.</p>
                  </>
                )}
              </div>

              {(objectiveId || parentObjectiveId) && (
                <div className="space-y-2">
                  <Label htmlFor="kr-weight" className="text-sm text-slate-300">Weight</Label>
                  <Input
                    id="kr-weight"
                    type="number"
                    min="0"
                    max="3"
                    step="0.1"
                    value={weight}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value)
                      setWeight(isNaN(value) ? 1.0 : value)
                    }}
                    className="bg-slate-800 border-slate-700 text-white h-9"
                  />
                  <p className="text-xs text-slate-500">
                    Influence of this KR on objective progress (0.0–3.0). Default 1.0.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="kr-owner" className="text-sm text-slate-300">
                  Owner <span className="text-red-500">*</span>
                </Label>
                <SearchableUserSelect
                  value={ownerId}
                  onValueChange={setOwnerId}
                  availableUsers={availableUsers}
                  placeholder="Select owner"
                  id="kr-owner"
                  required
                />
              </div>

              {availableCycles.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="kr-cycle" className="text-sm text-slate-300">
                    Cycle <span className="text-red-500">*</span>
                  </Label>
                  <StandardCycleSelector
                    value={cycleId}
                    onValueChange={setCycleId}
                    availableCycles={availableCycles}
                  />
                </div>
              )}

              <GoalTypeSelector
                value={goalType}
                onValueChange={setGoalType}
                label="Goal Type"
                id="kr-goal-type"
              />
            </div>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4 mt-0">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="kr-start" className="text-sm text-slate-300">Start Value</Label>
                  <Input
                    id="kr-start"
                    type="number"
                    step="any"
                    value={startValue}
                    onChange={(e) => setStartValue(parseFloat(e.target.value) || 0)}
                    className="bg-slate-800 border-slate-700 text-white h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kr-target" className="text-sm text-slate-300">
                    Target Value <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="kr-target"
                    type="number"
                    step="any"
                    value={targetValue}
                    onChange={(e) => setTargetValue(parseFloat(e.target.value) || 0)}
                    required
                    className="bg-slate-800 border-slate-700 text-white h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MetricTypeSelector
                  value={metricType}
                  onValueChange={setMetricType}
                  id="kr-metric"
                />
                <UnitInput
                  value={unit}
                  onValueChange={setUnit}
                  id="kr-unit"
                />
              </div>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-0">
            <div className="space-y-4">
              {availableTeams.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="kr-team" className="text-sm text-slate-300">Team</Label>
                  <Select
                    value={teamId || 'none'}
                    onValueChange={(value) => setTeamId(value === 'none' ? null : value)}
                  >
                    <SelectTrigger id="kr-team" className="bg-slate-800 border-slate-700 text-white h-9">
                      <SelectValue placeholder="Select team (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {availableTeams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <div className="flex-shrink-0 p-6 border-t border-slate-800 bg-slate-900 flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1 bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-10">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !title.trim() || !objectiveId || !ownerId || !cycleId} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white h-10 font-medium">
          {isSubmitting ? "Creating..." : "Create Key Result"}
        </Button>
      </div>
    </form>
  )
}

