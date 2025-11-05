'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ResourcePickerProps {
  value: {
    tenantId?: string
    workspaceId?: string
    teamId?: string
    objectiveId?: string
    keyResultId?: string
    cycleId?: string
  }
  onChange: (resource: ResourcePickerProps['value']) => void
}

export function ResourcePicker({ value, onChange }: ResourcePickerProps) {
  const updateField = (field: keyof ResourcePickerProps['value'], val: string) => {
    onChange({
      ...value,
      [field]: val || undefined,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Resource Context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tenant-id">Tenant ID</Label>
          <Input
            id="tenant-id"
            placeholder="Leave blank if not applicable"
            value={value.tenantId || ''}
            onChange={(e) => updateField('tenantId', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="workspace-id">Workspace ID</Label>
          <Input
            id="workspace-id"
            placeholder="Leave blank if not applicable"
            value={value.workspaceId || ''}
            onChange={(e) => updateField('workspaceId', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="team-id">Team ID</Label>
          <Input
            id="team-id"
            placeholder="Leave blank if not applicable"
            value={value.teamId || ''}
            onChange={(e) => updateField('teamId', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="objective-id">Objective ID</Label>
          <Input
            id="objective-id"
            placeholder="Leave blank if not applicable"
            value={value.objectiveId || ''}
            onChange={(e) => updateField('objectiveId', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="key-result-id">Key Result ID</Label>
          <Input
            id="key-result-id"
            placeholder="Leave blank if not applicable"
            value={value.keyResultId || ''}
            onChange={(e) => updateField('keyResultId', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cycle-id">Cycle ID</Label>
          <Input
            id="cycle-id"
            placeholder="Leave blank if not applicable"
            value={value.cycleId || ''}
            onChange={(e) => updateField('cycleId', e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  )
}

