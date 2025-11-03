'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
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
import { Check, ChevronsUpDown, Loader2, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AvatarCircle } from '@/components/dashboard/AvatarCircle'
import { RbacWhyTooltip } from '@/components/rbac/RbacWhyTooltip'

interface User {
  id: string
  name: string
  email?: string | null
}

interface InlineOwnerEditorProps {
  currentOwner: User
  availableUsers: User[]
  onSave: (userId: string) => Promise<void>
  canEdit: boolean
  lockReason?: string
  className?: string
  ariaLabel: string
  resource?: any // For RbacWhyTooltip
  disabled?: boolean
  size?: 'sm' | 'md'
}

export function InlineOwnerEditor({
  currentOwner,
  availableUsers,
  onSave,
  canEdit,
  lockReason,
  className,
  ariaLabel,
  resource,
  disabled = false,
  size = 'sm',
}: InlineOwnerEditorProps) {
  const [open, setOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(currentOwner.id)
  const [isSaving, setIsSaving] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setSelectedUserId(currentOwner.id)
  }, [currentOwner.id])

  const handleSelect = async (userId: string) => {
    if (userId === currentOwner.id) {
      setOpen(false)
      return
    }

    setIsSaving(true)
    setHasError(false)

    try {
      await onSave(userId)
      setOpen(false)
    } catch (error) {
      setHasError(true)
      // Keep popover open on error
    } finally {
      setIsSaving(false)
    }
  }

  const selectedOwner = availableUsers.find(u => u.id === selectedUserId) || currentOwner

  if (!canEdit || disabled) {
    return (
      <RbacWhyTooltip
        action="edit_okr"
        resource={resource}
        allowed={false}
      >
        <div
          className={cn(
            'flex items-center gap-1.5',
            size === 'sm' && 'text-[11px]',
            size === 'md' && 'text-[13px]',
            className
          )}
        >
          <AvatarCircle name={currentOwner.name} size={size === 'sm' ? 'sm' : 'md'} />
          <span className="text-neutral-600">{currentOwner.name}</span>
          {lockReason && (
            <Lock className="h-3 w-3 text-neutral-400" aria-hidden="true" />
          )}
        </div>
      </RbacWhyTooltip>
    )
  }

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={cn(
            'h-auto p-0 hover:bg-transparent justify-start gap-1.5',
            size === 'sm' && 'text-[11px]',
            size === 'md' && 'text-[13px]',
            className
          )}
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          <AvatarCircle name={selectedOwner.name} size={size === 'sm' ? 'sm' : 'md'} />
          <span className="text-neutral-600">{selectedOwner.name}</span>
          <ChevronsUpDown className="h-3 w-3 ml-1 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start" onClick={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput placeholder="Search users..." />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              {availableUsers.map((user) => (
                <CommandItem
                  key={user.id}
                  value={`${user.name} ${user.email || ''}`}
                  onSelect={() => handleSelect(user.id)}
                  disabled={isSaving}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <AvatarCircle name={user.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm">{user.name}</div>
                      {user.email && (
                        <div className="truncate text-xs text-neutral-500">{user.email}</div>
                      )}
                    </div>
                    {selectedUserId === user.id && (
                      <Check className="h-4 w-4 shrink-0" />
                    )}
                    {isSaving && selectedUserId === user.id && (
                      <Loader2 className="h-4 w-4 animate-spin shrink-0 ml-1" />
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
