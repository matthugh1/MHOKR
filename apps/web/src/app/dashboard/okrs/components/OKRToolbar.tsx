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
  attentionCount: number
  onOpenAttentionDrawer: () => void
  canCreateObjective: boolean
  canEditOKR: boolean
  isSuperuser: boolean
  onCreateObjective: () => void
  onCreateKeyResult: () => void
  onCreateInitiative: () => void
  onOpenCycleManagement?: () => void
  canManageCycles?: boolean
}

export function OKRToolbar({
  attentionCount,
  onOpenAttentionDrawer,
  canCreateObjective,
  canEditOKR,
  isSuperuser,
  onCreateObjective,
  onCreateKeyResult,
  onCreateInitiative,
  onOpenCycleManagement,
  canManageCycles = false,
}: OKRToolbarProps) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0 h-9">
      {/* Needs Attention - Icon button with badge */}
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenAttentionDrawer}
        aria-label={attentionCount > 0 ? `Attention (${attentionCount})` : 'Attention items'}
        className="relative h-9 focus:ring-2 focus:ring-ring focus:outline-none"
      >
        <Bell className="h-4 w-4 mr-2" />
        {attentionCount > 0 ? `Attention (${attentionCount})` : 'Attention'}
        {attentionCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs ml-1"
            aria-label={`${attentionCount} items need attention`}
            data-testid="attention-badge"
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
              size="sm"
              className="h-9 focus:ring-2 focus:ring-ring focus:outline-none rounded-r-none border-r-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="h-9 rounded-l-none px-2 focus:ring-2 focus:ring-ring focus:outline-none"
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

