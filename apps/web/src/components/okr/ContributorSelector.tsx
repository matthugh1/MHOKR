'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { AvatarCircle } from '@/components/dashboard/AvatarCircle'
import { X, Users, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface Contributor {
  id: string
  user: {
    id: string
    name: string
    email?: string
    avatar?: string | null
  }
  role: string
  addedAt?: string
}

interface ContributorSelectorProps {
  entityType: 'objective' | 'key-result' | 'initiative'
  entityId: string
  selectedContributors: Contributor[]
  onContributorsChange: (contributors: Contributor[]) => void
  availableUsers: Array<{ id: string; name: string; email?: string; avatar?: string | null }>
  currentOrganizationId: string | null
  canEdit?: boolean
  disabled?: boolean
}

export function ContributorSelector({
  entityType,
  entityId,
  selectedContributors,
  onContributorsChange,
  availableUsers,
  currentOrganizationId,
  canEdit = true,
  disabled = false,
}: ContributorSelectorProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Load current contributors for entity
  useEffect(() => {
    if (entityId && currentOrganizationId) {
      setLoading(true)
      api.get(`/${entityType}s/${entityId}/contributors`)
        .then((res) => {
          onContributorsChange(res.data || [])
        })
        .catch((err) => {
          console.error('Failed to load entity contributors:', err)
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [entityId, entityType, currentOrganizationId, onContributorsChange])

  const handleAddContributor = async (userId: string) => {
    if (disabled || !canEdit) return

    try {
      await api.post(`/${entityType}s/${entityId}/contributors`, { userId })
      const user = availableUsers.find(u => u.id === userId)
      if (user) {
        const newContributor: Contributor = {
          id: `temp-${Date.now()}`,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
          },
          role: 'CONTRIBUTOR',
        }
        onContributorsChange([...selectedContributors, newContributor])
        toast({
          title: 'Contributor added',
          description: `${user.name || user.email} has been added as a contributor.`,
        })
        setSearchQuery('')
      }
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.code === 'DUPLICATE_CONTRIBUTOR') {
        toast({
          title: 'Already a contributor',
          description: error.response.data.message || 'This user is already a contributor.',
          variant: 'default',
        })
      } else {
        toast({
          title: 'Failed to add contributor',
          description: error.response?.data?.message || 'Please try again.',
          variant: 'destructive',
        })
      }
    }
  }

  const handleRemoveContributor = async (userId: string) => {
    if (disabled || !canEdit) return

    const contributor = selectedContributors.find(c => c.user.id === userId)
    try {
      await api.delete(`/${entityType}s/${entityId}/contributors/${userId}`)
      onContributorsChange(selectedContributors.filter(c => c.user.id !== userId))
      toast({
        title: 'Contributor removed',
        description: contributor ? `${contributor.user.name || contributor.user.email} has been removed.` : 'Contributor removed.',
      })
    } catch (error: any) {
      toast({
        title: 'Failed to remove contributor',
        description: error.response?.data?.message || 'Please try again.',
        variant: 'destructive',
      })
    }
  }


  const filteredUsers = availableUsers.filter(user =>
    !selectedContributors.find(c => c.user.id === user.id) &&
    (user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     user.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (!canEdit && selectedContributors.length === 0) {
    return <div className="text-sm text-muted-foreground">No contributors</div>
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selectedContributors.map((contributor) => (
          <Badge
            key={contributor.id}
            variant="secondary"
            className="flex items-center gap-2 px-2 py-1"
          >
            <AvatarCircle
              name={contributor.user.name || contributor.user.email || 'U'}
              size="sm"
            />
            <span className="text-xs">
              {contributor.user.name || contributor.user.email || contributor.user.id}
            </span>
            {canEdit && !disabled && (
              <button
                type="button"
                onClick={() => handleRemoveContributor(contributor.user.id)}
                className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                aria-label={`Remove ${contributor.user.name || contributor.user.email}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
        {canEdit && !disabled && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1"
              >
                <Users className="h-3 w-3" />
                Add Contributor
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search users..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandList>
                  {loading ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    <>
                      <CommandEmpty>No users found.</CommandEmpty>
                      <CommandGroup>
                        {filteredUsers.map((user) => (
                          <CommandItem
                            key={user.id}
                            onSelect={() => handleAddContributor(user.id)}
                          >
                            <div className="flex items-center gap-2">
                              <AvatarCircle
                                name={user.name || user.email || 'U'}
                                size="sm"
                              />
                              <div className="flex flex-col">
                                <span className="text-sm">{user.name || user.email || user.id}</span>
                                {user.email && user.name && (
                                  <span className="text-xs text-muted-foreground">{user.email}</span>
                                )}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}

