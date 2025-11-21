'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AvatarCircle } from '@/components/dashboard/AvatarCircle'
import { X, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
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
import type { Owner } from '@/lib/okr-owners-api'

interface User {
  id: string
  name: string
  email?: string | null
}

interface OwnerListProps {
  owners: Owner[]
  availableUsers: User[]
  onAddOwner: (userId: string) => Promise<void>
  onRemoveOwner: (userId: string) => Promise<void>
  canEdit: boolean
  resourceType: 'objective' | 'keyResult'
  resourceId: string
  className?: string
  size?: 'sm' | 'md'
}

export function OwnerList({
  owners,
  availableUsers,
  onAddOwner,
  onRemoveOwner,
  canEdit,
  resourceType,
  resourceId,
  className,
  size = 'sm',
}: OwnerListProps) {
  const { toast } = useToast()
  const [isRemoving, setIsRemoving] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const handleRemove = async (userId: string, isPrimary: boolean) => {
    if (isPrimary) {
      toast({
        title: 'Cannot remove primary owner',
        description: 'The primary owner cannot be removed. Update the owner field to change the primary owner.',
        variant: 'destructive',
      })
      return
    }

    setIsRemoving(userId)
    try {
      await onRemoveOwner(userId)
      toast({
        title: 'Owner removed',
        description: 'The owner has been removed successfully.',
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to remove owner'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsRemoving(null)
    }
  }

  const handleAdd = async (userId: string) => {
    // Check if user is already an owner
    if (owners.some(o => o.userId === userId)) {
      toast({
        title: 'Already an owner',
        description: 'This user is already an owner.',
        variant: 'default',
      })
      return
    }

    setIsAdding(true)
    try {
      await onAddOwner(userId)
      toast({
        title: 'Owner added',
        description: 'The owner has been added successfully.',
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to add owner'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsAdding(false)
    }
  }

  // Filter out users who are already owners
  const availableToAdd = availableUsers.filter(
    user => !owners.some(owner => owner.userId === user.id)
  )

  if (!canEdit && owners.length === 0) {
    return null
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <label className={cn(
          'text-sm font-medium text-neutral-700',
          size === 'sm' && 'text-xs'
        )}>
          Owners {owners.length > 0 && `(${owners.length})`}
        </label>
        {canEdit && availableToAdd.length > 0 && (
          <OwnerSelector
            availableUsers={availableToAdd}
            onSelect={handleAdd}
            disabled={isAdding}
            size={size}
          />
        )}
      </div>

      {owners.length === 0 ? (
        <p className={cn(
          'text-sm text-neutral-500 italic',
          size === 'sm' && 'text-xs'
        )}>
          No additional owners
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {owners.map((owner) => (
            <div
              key={owner.id}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md border bg-white',
                size === 'sm' && 'px-1.5 py-0.5'
              )}
            >
              <AvatarCircle
                name={owner.userName}
                size={size === 'sm' ? 'sm' : 'md'}
              />
              <span className={cn(
                'text-neutral-700',
                size === 'sm' ? 'text-[11px]' : 'text-sm'
              )}>
                {owner.userName}
              </span>
              {owner.isPrimary && (
                <span className={cn(
                  'px-1 py-0.5 rounded text-[10px] font-medium bg-violet-100 text-violet-700',
                  size === 'sm' && 'text-[9px]'
                )}>
                  Primary
                </span>
              )}
              {canEdit && !owner.isPrimary && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 hover:bg-red-50 hover:text-red-600"
                  onClick={() => handleRemove(owner.userId, owner.isPrimary)}
                  disabled={isRemoving === owner.userId}
                  aria-label={`Remove ${owner.userName} as owner`}
                >
                  {isRemoving === owner.userId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Owner selector component using Command
interface OwnerSelectorProps {
  availableUsers: User[]
  onSelect: (userId: string) => Promise<void>
  disabled?: boolean
  size?: 'sm' | 'md'
}

function OwnerSelector({
  availableUsers,
  onSelect,
  disabled = false,
  size = 'sm',
}: OwnerSelectorProps) {
  const [open, setOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)

  const handleSelect = async (userId: string) => {
    setIsAdding(true)
    try {
      await onSelect(userId)
      setOpen(false)
    } finally {
      setIsAdding(false)
    }
  }

  if (availableUsers.length === 0) {
    return null
  }

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size === 'sm' ? 'sm' : 'default'}
          disabled={disabled || isAdding}
          className="h-7 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Owner
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="end">
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
                  disabled={isAdding}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <AvatarCircle name={user.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm">{user.name}</div>
                      {user.email && (
                        <div className="truncate text-xs text-neutral-500">
                          {user.email}
                        </div>
                      )}
                    </div>
                    {isAdding && (
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
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

