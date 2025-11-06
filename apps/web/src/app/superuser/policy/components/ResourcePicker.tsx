'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ObjectivePicker } from './ObjectivePicker'

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
  tenantId?: string
}

export function ResourcePicker({ value, onChange, tenantId }: ResourcePickerProps) {
  const [useAdvanced, setUseAdvanced] = useState(false)

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
      <CardContent>
        <Tabs value={useAdvanced ? 'advanced' : 'simple'} onValueChange={(v) => setUseAdvanced(v === 'advanced')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="simple">Simple</TabsTrigger>
            <TabsTrigger value="advanced">Advanced (Manual IDs)</TabsTrigger>
          </TabsList>
          
          <TabsContent value="simple" className="space-y-4 mt-4">
            <ObjectivePicker
              value={value.objectiveId || ''}
              onChange={(id) => updateField('objectiveId', id)}
              tenantId={tenantId}
            />
            <div className="text-xs text-muted-foreground">
              Note: Other resource fields (workspace, team, cycle, key result) can be set manually in Advanced mode for cross-tenant testing.
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
