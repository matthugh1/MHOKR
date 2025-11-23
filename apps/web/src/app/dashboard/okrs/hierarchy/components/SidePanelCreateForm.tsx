'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SidePanelCreateObjective } from './SidePanelCreateObjective'
import { SidePanelCreateKeyResult } from './SidePanelCreateKeyResult'
import { Target, TrendingUp } from 'lucide-react'

interface SidePanelCreateFormProps {
  mode: 'objective' | 'kr' | null
  onModeChange: (mode: 'objective' | 'kr' | null) => void
  onSuccess: () => void
  onCancel: () => void
  availableUsers?: Array<{ id: string; name: string; email?: string }>
  availableWorkspaces?: Array<{ id: string; name: string }>
  availableCycles?: Array<{ id: string; name: string }>
  availableTeams?: Array<{ id: string; name: string; workspaceId?: string }>
  parentObjectiveId?: string
  currentOrganization?: { id: string } | null
}

export function SidePanelCreateForm({
  mode,
  onModeChange,
  onSuccess,
  onCancel,
  availableUsers = [],
  availableWorkspaces = [],
  availableCycles = [],
  availableTeams = [],
  parentObjectiveId,
  currentOrganization,
}: SidePanelCreateFormProps) {
  // If no mode selected, show mode selector
  if (!mode) {
    return (
      <div className="flex flex-col h-full p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-2">Create New</h3>
          <p className="text-sm text-slate-400">Choose what you want to create</p>
        </div>
        
        <div className="flex-1 flex flex-col gap-3">
          <button
            onClick={() => onModeChange('objective')}
            className="flex items-center gap-4 p-4 rounded-lg border border-slate-800 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-700 transition-all text-left group"
          >
            <div className="p-3 rounded-lg bg-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/30 transition-colors">
              <Target size={20} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white mb-1">Create Objective</div>
              <div className="text-xs text-slate-400">Create a new objective with key results</div>
            </div>
          </button>

          <button
            onClick={() => onModeChange('kr')}
            className="flex items-center gap-4 p-4 rounded-lg border border-slate-800 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-700 transition-all text-left group"
          >
            <div className="p-3 rounded-lg bg-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/30 transition-colors">
              <TrendingUp size={20} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white mb-1">Create Key Result</div>
              <div className="text-xs text-slate-400">Create a new key result for an objective</div>
            </div>
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="w-full bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // Render appropriate form based on mode
  if (mode === 'objective') {
    return (
      <SidePanelCreateObjective
        onSave={async (data) => {
          await onSuccess(data)
        }}
        onCancel={() => onModeChange(null)}
        availableUsers={availableUsers}
        availableWorkspaces={availableWorkspaces}
        availableCycles={availableCycles}
        parentObjectiveId={parentObjectiveId}
      />
    )
  }

  if (mode === 'kr') {
    return (
      <SidePanelCreateKeyResult
        onSave={async (data) => {
          await onSuccess(data)
        }}
        onCancel={() => onModeChange(null)}
        availableUsers={availableUsers}
        availableCycles={availableCycles.map(c => ({ id: c.id, name: c.name, status: 'ACTIVE' }))}
        availableTeams={availableTeams}
        parentObjectiveId={parentObjectiveId}
        currentOrganization={currentOrganization}
      />
    )
  }

  return null
}

