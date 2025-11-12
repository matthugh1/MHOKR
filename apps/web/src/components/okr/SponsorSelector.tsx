'use client'

import { useState, useEffect } from 'react'
import { SearchableUserSelect } from '@/components/okr/SearchableUserSelect'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface SponsorSelectorProps {
  objectiveId: string
  sponsorId: string | null
  onSponsorChange: (sponsorId: string | null) => void
  availableUsers: Array<{ id: string; name: string; email?: string }>
  currentOrganizationId: string | null
  canEdit?: boolean
  disabled?: boolean
}

export function SponsorSelector({
  objectiveId,
  sponsorId,
  onSponsorChange,
  availableUsers,
  currentOrganizationId,
  canEdit = true,
  disabled = false,
}: SponsorSelectorProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load current sponsor
  useEffect(() => {
    if (objectiveId && currentOrganizationId) {
      setLoading(true)
      api.get(`/objectives/${objectiveId}`)
        .then((res) => {
          onSponsorChange(res.data?.sponsorId || null)
        })
        .catch((err) => {
          console.error('Failed to load objective sponsor:', err)
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [objectiveId, currentOrganizationId, onSponsorChange])

  const handleSponsorChange = async (newSponsorId: string | null) => {
    if (disabled || !canEdit || saving) return

    // Optimistic update
    const prevSponsorId = sponsorId
    onSponsorChange(newSponsorId)
    setSaving(true)

    try {
      await api.patch(`/objectives/${objectiveId}/sponsor`, { sponsorId: newSponsorId })
      const sponsor = newSponsorId ? availableUsers.find(u => u.id === newSponsorId) : null
      toast({
        title: 'Sponsor updated',
        description: sponsor
          ? `${sponsor.name || sponsor.email} has been set as sponsor.`
          : 'Sponsor has been removed.',
      })
    } catch (error: any) {
      // Revert on error
      onSponsorChange(prevSponsorId)
      toast({
        title: 'Failed to update sponsor',
        description: error.response?.data?.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading sponsor...</span>
      </div>
    )
  }

  if (!canEdit) {
    const sponsor = sponsorId ? availableUsers.find(u => u.id === sponsorId) : null
    return (
      <div className="text-sm">
        {sponsor ? (
          <span>{sponsor.name || sponsor.email || sponsorId}</span>
        ) : (
          <span className="text-muted-foreground">No sponsor</span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <SearchableUserSelect
        value={sponsorId || ''}
        onValueChange={(value) => handleSponsorChange(value || null)}
        availableUsers={availableUsers}
        placeholder="Select sponsor (optional)"
        disabled={disabled || saving}
      />
      {sponsorId && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => handleSponsorChange(null)}
          disabled={disabled || saving}
          className="text-xs"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Remove sponsor
        </Button>
      )}
    </div>
  )
}


