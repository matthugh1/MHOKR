'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Action = 
  | 'view_okr'
  | 'edit_okr'
  | 'delete_okr'
  | 'publish_okr'
  | 'create_okr'
  | 'request_checkin'
  | 'manage_users'
  | 'manage_billing'
  | 'manage_workspaces'
  | 'manage_teams'
  | 'impersonate_user'
  | 'manage_tenant_settings'
  | 'view_all_okrs'
  | 'export_data'

interface ActionPickerProps {
  value: Action
  onChange: (action: Action) => void
}

const ACTIONS: Array<{ value: Action; label: string; description?: string }> = [
  { value: 'view_okr', label: 'View OKR', description: 'View an OKR (subject to visibility rules)' },
  { value: 'edit_okr', label: 'Edit OKR', description: 'Edit an OKR' },
  { value: 'delete_okr', label: 'Delete OKR', description: 'Delete an OKR' },
  { value: 'publish_okr', label: 'Publish OKR', description: 'Publish/approve an OKR for visibility' },
  { value: 'create_okr', label: 'Create OKR', description: 'Create a new OKR' },
  { value: 'request_checkin', label: 'Request Check-in', description: 'Request a check-in update from another user' },
  { value: 'manage_users', label: 'Manage Users', description: 'Invite/remove users, assign roles' },
  { value: 'manage_billing', label: 'Manage Billing', description: 'Manage tenant billing and contracts' },
  { value: 'manage_workspaces', label: 'Manage Workspaces', description: 'Create/edit/delete workspaces' },
  { value: 'manage_teams', label: 'Manage Teams', description: 'Create/edit/delete teams' },
  { value: 'impersonate_user', label: 'Impersonate User', description: 'Impersonate another user (superuser only)' },
  { value: 'manage_tenant_settings', label: 'Manage Tenant Settings', description: 'Configure tenant-wide policies' },
  { value: 'view_all_okrs', label: 'View All OKRs', description: 'View all OKRs regardless of visibility (for reporting)' },
  { value: 'export_data', label: 'Export Data', description: 'Export data for reporting/analytics' },
]

export function ActionPicker({ value, onChange }: ActionPickerProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="action-picker">Action</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="action-picker">
          <SelectValue placeholder="Select action..." />
        </SelectTrigger>
        <SelectContent>
          {ACTIONS.map((action) => (
            <SelectItem key={action.value} value={action.value}>
              <div>
                <div className="font-medium">{action.label}</div>
                {action.description && (
                  <div className="text-xs text-muted-foreground">
                    {action.description}
                  </div>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}



