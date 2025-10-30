import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'

export function usePermissions() {
  const { teams, team } = useWorkspace()
  const { user } = useAuth()

  const canCreateWorkspace = () => {
    // Check if user has ORG_ADMIN role in any team
    return teams.some(t => t.role === 'ORG_ADMIN')
  }

  const canManageTeam = (teamId?: string) => {
    // Check if user is TEAM_LEAD or higher for the specified team
    if (!teamId) {
      return teams.some(t => t.role === 'TEAM_LEAD' || t.role === 'ORG_ADMIN' || t.role === 'WORKSPACE_OWNER')
    }
    
    const userTeam = teams.find(t => t.id === teamId)
    if (!userTeam) return false

    return userTeam.role === 'TEAM_LEAD' || userTeam.role === 'ORG_ADMIN' || userTeam.role === 'WORKSPACE_OWNER'
  }

  const canEditOKR = (okr: { ownerId: string; teamId?: string | null }) => {
    // Owner can always edit
    if (okr.ownerId === user?.id) {
      return true
    }

    // Team lead can edit team OKRs
    if (okr.teamId) {
      return canManageTeam(okr.teamId)
    }

    return false
  }

  const canDeleteOKR = (okr: { ownerId: string; teamId?: string | null }) => {
    // Same logic as edit for now
    return canEditOKR(okr)
  }

  const canInviteMembers = () => {
    // Only team leads and above can invite
    return teams.some(t => 
      t.role === 'TEAM_LEAD' || 
      t.role === 'ORG_ADMIN' || 
      t.role === 'WORKSPACE_OWNER'
    )
  }

  return {
    canCreateWorkspace,
    canManageTeam,
    canEditOKR,
    canDeleteOKR,
    canInviteMembers,
  }
}



