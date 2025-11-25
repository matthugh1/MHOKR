'use client'

import React from 'react'
import { HierarchyOKRNode } from './types'
import { SidePanelEditObjective } from './SidePanelEditObjective'
import { SidePanelEditKeyResult } from './SidePanelEditKeyResult'

interface SidePanelEditFormProps {
  selectedNode: HierarchyOKRNode | null
  onSave: (data: any) => Promise<void>
  onCancel: () => void
  availableUsers?: Array<{ id: string; name: string; email?: string }>
  availableWorkspaces?: Array<{ id: string; name: string }>
  availableCycles?: Array<{ id: string; name: string }>
  availableTeams?: Array<{ id: string; name: string; workspaceId?: string }>
  currentOrganization?: { id: string } | null
}

export function SidePanelEditForm({
  selectedNode,
  onSave,
  onCancel,
  availableUsers = [],
  availableWorkspaces = [],
  availableCycles = [],
  availableTeams = [],
  currentOrganization,
}: SidePanelEditFormProps) {
  if (!selectedNode) {
    return (
      <div className="flex flex-col items-start justify-start h-full p-6">
        <p className="text-slate-500 text-sm">Select an item to edit</p>
      </div>
    )
  }

  if (selectedNode.type === 'objective') {
    return (
      <SidePanelEditObjective
        selectedNode={selectedNode}
        onSave={onSave}
        onCancel={onCancel}
        availableUsers={availableUsers}
        availableWorkspaces={availableWorkspaces}
        availableTeams={availableTeams}
        availableCycles={availableCycles}
      />
    )
  }

  if (selectedNode.type === 'keyResult') {
    return (
      <SidePanelEditKeyResult
        selectedNode={selectedNode}
        onSave={onSave}
        onCancel={onCancel}
        availableUsers={availableUsers}
        availableTeams={availableTeams}
        activeCycles={availableCycles.map(c => ({ id: c.id, name: c.name, status: 'ACTIVE' }))}
        currentOrganization={currentOrganization}
      />
    )
  }

  return null
}

