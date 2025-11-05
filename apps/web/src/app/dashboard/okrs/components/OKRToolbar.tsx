'use client'

import { Bell, Plus, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface OKRToolbarProps {
  availableScopes: Array<'my' | 'team-workspace' | 'tenant'>
  selectedScope: 'my' | 'team-workspace' | 'tenant'
  onScopeChange: (scope: 'my' | 'team-workspace' | 'tenant') => void
  attentionCount: number
  onOpenAttentionDrawer: () => void
  canCreateObjective: boolean
  canEditOKR: boolean
  isSuperuser: boolean
  onCreateObjective: () => void
  onCreateKeyResult: () => void
  onCreateInitiative: () => void
}

export function OKRToolbar({
  availableScopes,
  selectedScope,
  onScopeChange,
  attentionCount,
  onOpenAttentionDrawer,
  canCreateObjective,
  canEditOKR,
  isSuperuser,
  onCreateObjective,
  onCreateKeyResult,
  onCreateInitiative,
}: OKRToolbarProps) {
  return (
    <div className="flex items-center gap-3 flex-shrink-0">
      {/* Scope Toggle */}
      {availableScopes.length > 1 && (
        <div className="flex items-center gap-1 rounded-lg border border-neutral-300 bg-neutral-50 p-1" role="group" aria-label="Scope filter">
          {availableScopes.includes('my') && (
            <button
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none",
                selectedScope === 'my'
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              )}
              onClick={() => onScopeChange('my')}
              aria-pressed={selectedScope === 'my'}
            >
              My
            </button>
          )}
          {availableScopes.includes('team-workspace') && (
            <button
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none",
                selectedScope === 'team-workspace'
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              )}
              onClick={() => onScopeChange('team-workspace')}
              aria-pressed={selectedScope === 'team-workspace'}
            >
              Team/Workspace
            </button>
          )}
          {availableScopes.includes('tenant') && (
            <button
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:ring-2 focus:ring-ring focus:outline-none",
                selectedScope === 'tenant'
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              )}
              onClick={() => onScopeChange('tenant')}
              aria-pressed={selectedScope === 'tenant'}
            >
              Tenant
            </button>
          )}
        </div>
      )}
      
      {/* Actions */}
      {/* Needs Attention - Icon button with badge */}
      <Button
        variant="outline"
        size="icon"
        onClick={onOpenAttentionDrawer}
        aria-label="Open attention drawer"
        className="relative focus:ring-2 focus:ring-ring focus:outline-none"
      >
        <Bell className="h-4 w-4" />
        {attentionCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            aria-label={`${attentionCount} items need attention`}
          >
            {attentionCount > 99 ? '99+' : attentionCount}
          </Badge>
        )}
      </Button>

      {/* Add - RBAC-aware split-button */}
      {(canCreateObjective || canEditOKR) && !isSuperuser && (
        <DropdownMenu>
          <div className="flex items-center">
            <Button
              onClick={onCreateObjective}
              aria-label="Add"
              className="focus:ring-2 focus:ring-ring focus:outline-none rounded-r-none border-r-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="default"
                className="rounded-l-none px-2 focus:ring-2 focus:ring-ring focus:outline-none"
                aria-label="Add options"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </div>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCreateObjective}>
              <Plus className="h-4 w-4 mr-2" />
              New Objective
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateKeyResult}>
              <Plus className="h-4 w-4 mr-2" />
              New Key Result
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateInitiative}>
              <Plus className="h-4 w-4 mr-2" />
              New Initiative
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

