'use client'

import { Check, ChevronsUpDown, Building2, Shield } from 'lucide-react'
import { useState } from 'react'
import { useWorkspace } from '@/contexts/workspace.context'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export function WorkspaceSelector() {
  const { 
    currentOrganization, 
    organizations,
    isSuperuser,
    selectOrganization,
    loading 
  } = useWorkspace()
  const [open, setOpen] = useState(false)

  if (loading) {
    return (
      <div className="w-full px-3 py-2 text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (!currentOrganization) {
    return (
      <div className="w-full px-3 py-2 text-sm text-muted-foreground">
        No organization
      </div>
    )
  }

  // For normal users: just display the organization name (no dropdown)
  if (!isSuperuser) {
    return (
      <div className="w-full px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <Building2 className="h-4 w-4 shrink-0 text-blue-600" />
          <div className="text-left">
            <div className="font-medium text-slate-900">{currentOrganization.name}</div>
            <div className="text-xs text-muted-foreground">Organization</div>
          </div>
        </div>
      </div>
    )
  }

  // For superusers: show dropdown to switch organizations
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2 text-left min-w-0">
            <Building2 className="h-4 w-4 shrink-0 text-blue-600" />
            <div>
              <div className="text-sm font-medium truncate">{currentOrganization.name}</div>
              <div className="text-xs text-muted-foreground">Organization</div>
            </div>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
        <div className="p-2">
          {/* Superuser indicator */}
          <div className="mb-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-md">
            <div className="flex items-center gap-2">
              <Shield className="h-3 w-3 text-purple-600" />
              <span className="text-xs font-medium text-purple-900">Superuser Mode</span>
            </div>
          </div>

          {/* Organization Selection */}
          <div className="mb-2">
            <div className="px-3 py-2 text-xs font-medium text-slate-500 uppercase">Select Organization</div>
            {organizations.length > 0 ? (
              organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    selectOrganization(org.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
                    currentOrganization?.id === org.id
                      ? 'bg-slate-900 text-white'
                      : 'hover:bg-slate-100 text-slate-700'
                  )}
                >
                  <Building2 className="h-4 w-4 shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">{org.name}</div>
                    <div className={cn(
                      "text-xs",
                      currentOrganization?.id === org.id ? "text-slate-300" : "text-slate-500"
                    )}>
                      {org.slug}
                    </div>
                  </div>
                  {currentOrganization?.id === org.id && (
                    <Check className="h-4 w-4 shrink-0" />
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-slate-500">No organizations available</div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

