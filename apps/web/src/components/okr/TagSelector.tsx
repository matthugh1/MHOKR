'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Plus, X, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface Tag {
  id: string
  name: string
  color?: string | null
}

interface TagSelectorProps {
  entityType: 'objective' | 'key-result' | 'initiative'
  entityId: string
  selectedTags: Tag[]
  onTagsChange: (tags: Tag[]) => void
  currentOrganizationId: string | null
  canEdit?: boolean
  disabled?: boolean
}

export function TagSelector({
  entityType,
  entityId,
  selectedTags,
  onTagsChange,
  currentOrganizationId,
  canEdit = true,
  disabled = false,
}: TagSelectorProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateTag, setShowCreateTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')
  const [creatingTag, setCreatingTag] = useState(false)

  // Load available tags for tenant
  const loadTags = useCallback(async () => {
    if (!currentOrganizationId) return

    setLoading(true)
    try {
      // TODO: Add GET /tags endpoint to backend (for now, we'll fetch from entity tags)
      // For now, we'll fetch tags from existing entities to build a list
      // This is a workaround until we have a dedicated tags endpoint
      const response = await api.get(`/${entityType}s/${entityId}/tags`).catch(() => ({ data: [] }))
      const entityTags = response.data || []
      
      // Build unique tag list from entity tags
      const tagMap = new Map<string, Tag>()
      entityTags.forEach((tag: Tag) => {
        if (!tagMap.has(tag.id)) {
          tagMap.set(tag.id, tag)
        }
      })
      
      // Also include selected tags that might not be in the list yet
      selectedTags.forEach(tag => {
        if (!tagMap.has(tag.id)) {
          tagMap.set(tag.id, tag)
        }
      })
      
      setAvailableTags(Array.from(tagMap.values()))
    } catch (error) {
      console.error('Failed to load tags:', error)
    } finally {
      setLoading(false)
    }
  }, [currentOrganizationId, entityType, entityId, selectedTags])

  useEffect(() => {
    if (open && currentOrganizationId) {
      loadTags()
    }
  }, [open, currentOrganizationId, loadTags])

  // Load current tags for entity
  useEffect(() => {
    if (entityId && currentOrganizationId) {
      api.get(`/${entityType}s/${entityId}/tags`)
        .then((res) => {
          onTagsChange(res.data || [])
        })
        .catch((err) => {
          console.error('Failed to load entity tags:', err)
        })
    }
  }, [entityId, entityType, currentOrganizationId, onTagsChange])

  const handleAddTag = async (tagId: string) => {
    if (disabled || !canEdit) return

    try {
      await api.post(`/${entityType}s/${entityId}/tags`, { tagId })
      const tag = availableTags.find(t => t.id === tagId)
      if (tag) {
        onTagsChange([...selectedTags, tag])
        toast({
          title: 'Tag added',
          description: `"${tag.name}" has been added.`,
        })
      }
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.code === 'DUPLICATE_TAG') {
        toast({
          title: 'Tag already added',
          description: error.response.data.message || 'This tag is already assigned.',
          variant: 'default',
        })
      } else {
        toast({
          title: 'Failed to add tag',
          description: error.response?.data?.message || 'Please try again.',
          variant: 'destructive',
        })
      }
    }
  }

  const handleRemoveTag = async (tagId: string) => {
    if (disabled || !canEdit) return

    const tag = selectedTags.find(t => t.id === tagId)
    try {
      await api.delete(`/${entityType}s/${entityId}/tags/${tagId}`)
      onTagsChange(selectedTags.filter(t => t.id !== tagId))
      toast({
        title: 'Tag removed',
        description: tag ? `"${tag.name}" has been removed.` : 'Tag removed.',
      })
    } catch (error: any) {
      toast({
        title: 'Failed to remove tag',
        description: error.response?.data?.message || 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !currentOrganizationId || creatingTag) return

    setCreatingTag(true)
    try {
      // TODO: Add POST /tags endpoint to backend
      // For now, we'll show an error message
      toast({
        title: 'Tag creation',
        description: 'Tag creation endpoint not yet implemented. Please create tags through the tags management page.',
        variant: 'default',
      })
      setShowCreateTag(false)
      setNewTagName('')
    } catch (error: any) {
      toast({
        title: 'Failed to create tag',
        description: error.response?.data?.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setCreatingTag(false)
    }
  }

  const filteredTags = availableTags.filter(tag =>
    !selectedTags.find(st => st.id === tag.id) &&
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!canEdit && selectedTags.length === 0) {
    return <div className="text-sm text-muted-foreground">No tags</div>
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selectedTags.map((tag) => (
          <Badge
            key={tag.id}
            variant="secondary"
            className="flex items-center gap-1"
            style={tag.color ? { backgroundColor: tag.color + '20', borderColor: tag.color } : undefined}
          >
            <span style={tag.color ? { color: tag.color } : undefined}>{tag.name}</span>
            {canEdit && !disabled && (
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                aria-label={`Remove ${tag.name}`}
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
                <Plus className="h-3 w-3" />
                Add Tag
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search tags..."
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
                      <CommandEmpty>
                        {searchQuery ? 'No tags found.' : 'No tags available.'}
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredTags.map((tag) => (
                          <CommandItem
                            key={tag.id}
                            onSelect={() => {
                              handleAddTag(tag.id)
                              setSearchQuery('')
                            }}
                          >
                            <div className="flex items-center gap-2">
                              {tag.color && (
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: tag.color }}
                                />
                              )}
                              <span>{tag.name}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      {!showCreateTag && (
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => setShowCreateTag(true)}
                            className="text-primary"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Create new tag
                          </CommandItem>
                        </CommandGroup>
                      )}
                    </>
                  )}
                </CommandList>
              </Command>
              {showCreateTag && (
                <div className="border-t p-3 space-y-2">
                  <Input
                    placeholder="Tag name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCreateTag()
                      } else if (e.key === 'Escape') {
                        setShowCreateTag(false)
                        setNewTagName('')
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="h-8 w-16 rounded border"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateTag}
                      disabled={!newTagName.trim() || creatingTag}
                    >
                      {creatingTag ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowCreateTag(false)
                        setNewTagName('')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}


