'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'

interface Organization {
  id: string
  name: string
  slug: string
}

interface Workspace {
  id: string
  name: string
  organizationId: string
}

interface Team {
  id: string
  name: string
  role: string
  workspaceId: string
  workspace: string
}

type OKRLevel = 'organization' | 'workspace' | 'team' | 'personal'

interface WorkspaceContextType {
  currentOrganization: Organization | null
  currentWorkspace: Workspace | null
  currentTeam: Team | null
  currentOKRLevel: OKRLevel
  organizations: Organization[]
  workspaces: Workspace[]
  teams: Team[]
  loading: boolean
  isSuperuser: boolean
  selectOrganization: (organizationId: string) => void
  selectWorkspace: (workspaceId: string) => void
  selectTeam: (teamId: string | null) => void
  selectOKRLevel: (level: OKRLevel) => void
  refreshContext: () => Promise<void>
  defaultOKRContext: {
    organizationId: string | null
    workspaceId: string | null
    teamId: string | null
    ownerId: string | null
  }
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null)
  const [currentOKRLevel, setCurrentOKRLevel] = useState<OKRLevel>('personal')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isSuperuser, setIsSuperuser] = useState(false)

  const checkSuperuserStatus = async () => {
    if (!user) {
      setIsSuperuser(false)
      return false
    }

    // Check if user object has isSuperuser flag
    if (user.isSuperuser) {
      setIsSuperuser(true)
      return true
    }

    // Also check via API endpoint
    try {
      const response = await api.get('/superuser/check')
      const isSuper = response.data.isSuperuser || false
      setIsSuperuser(isSuper)
      return isSuper
    } catch (error) {
      setIsSuperuser(false)
      return false
    }
  }

  const fetchUserContext = async () => {
    try {
      console.log('Fetching user context...')
      
      // Check if superuser first
      const isSuper = await checkSuperuserStatus()
      
      let userContextData
      let allOrganizationsData: Organization[] = []

      if (isSuper) {
        // Superuser: Fetch all organizations
        try {
          const orgsResponse = await api.get('/superuser/organizations')
          allOrganizationsData = orgsResponse.data || []
        } catch (error) {
          // Fallback to regular endpoint
          console.warn('Superuser endpoint failed, trying regular endpoint')
          const orgsResponse = await api.get('/organizations')
          allOrganizationsData = orgsResponse.data || []
        }
        
        // Still get user context for workspaces/teams
        const contextResponse = await api.get('/users/me/context')
        userContextData = contextResponse.data
      } else {
        // Regular user: Get their context
        const contextResponse = await api.get('/users/me/context')
        userContextData = contextResponse.data
      }

      setUserId(userContextData.user.id)
      
      // Set organizations
      if (isSuper && allOrganizationsData.length > 0) {
        setOrganizations(allOrganizationsData)
      } else {
        setOrganizations(userContextData.organizations || (userContextData.organization ? [userContextData.organization] : []))
      }
      
      setWorkspaces(userContextData.workspaces || [])
      setTeams(userContextData.teams || [])

      // Check localStorage for saved preferences
      const savedOrganizationId = localStorage.getItem('currentOrganizationId')
      const savedWorkspaceId = localStorage.getItem('currentWorkspaceId')
      const savedTeamId = localStorage.getItem('currentTeamId')

      // Determine which organizations are available
      const availableOrganizations = isSuper && allOrganizationsData.length > 0 
        ? allOrganizationsData 
        : (userContextData.organizations || (userContextData.organization ? [userContextData.organization] : []))

      // Set organization - auto-select first one if none selected
      if (savedOrganizationId && availableOrganizations.find((o: Organization) => o.id === savedOrganizationId)) {
        const savedOrg = availableOrganizations.find((o: Organization) => o.id === savedOrganizationId)
        setCurrentOrganization(savedOrg)
      } else if (availableOrganizations.length > 0) {
        // Auto-select first organization on login
        const firstOrg = availableOrganizations[0]
        setCurrentOrganization(firstOrg)
        localStorage.setItem('currentOrganizationId', firstOrg.id)
        
        // Also set OKR level to organization if we have one
        if (firstOrg) {
          setCurrentOKRLevel('organization')
          localStorage.setItem('currentOKRLevel', 'organization')
        }
      }

      // Set workspace - but only if it belongs to the selected organization
      // For superusers viewing an org they're not part of, don't set workspace/team
      const selectedOrgId = savedOrganizationId || (availableOrganizations.length > 0 ? availableOrganizations[0].id : null)
      
      if (isSuper && selectedOrgId) {
        // For superusers: Only set workspace/team if they belong to the selected organization
        // We'll fetch workspaces for the org in selectOrganization, so clear these for now
        setCurrentWorkspace(null)
        setCurrentTeam(null)
        localStorage.removeItem('currentWorkspaceId')
        localStorage.removeItem('currentTeamId')
      } else {
        // For regular users: Set workspace/team from their memberships
        // Only set if the workspace belongs to the selected organization
        if (savedWorkspaceId) {
          const savedWorkspace = userContextData.workspaces?.find((w: Workspace) => w.id === savedWorkspaceId)
          if (savedWorkspace && (!selectedOrgId || savedWorkspace.organizationId === selectedOrgId)) {
            setCurrentWorkspace(savedWorkspace)
          }
        } else if (userContextData.workspace) {
          // Only set if workspace belongs to selected organization
          if (!selectedOrgId || userContextData.workspace.organizationId === selectedOrgId) {
            setCurrentWorkspace(userContextData.workspace)
            localStorage.setItem('currentWorkspaceId', userContextData.workspace.id)
          }
        }

        // Set team - only if it belongs to the current workspace and selected organization
        if (savedTeamId) {
          const savedTeam = userContextData.teams?.find((t: Team) => t.id === savedTeamId)
          if (savedTeam) {
            // Find the workspace for this team
            const teamWorkspace = userContextData.workspaces?.find((w: Workspace) => w.id === savedTeam.workspaceId)
            if (teamWorkspace && (!selectedOrgId || teamWorkspace.organizationId === selectedOrgId)) {
              setCurrentTeam(savedTeam)
            }
          }
        } else if (userContextData.team) {
          // Find the workspace for this team
          const teamWorkspace = userContextData.workspaces?.find((w: Workspace) => w.id === userContextData.team.workspaceId)
          if (teamWorkspace && (!selectedOrgId || teamWorkspace.organizationId === selectedOrgId)) {
            setCurrentTeam(userContextData.team)
            localStorage.setItem('currentTeamId', userContextData.team.id)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load user context:', error)
      // Set loading to false even on error so UI doesn't get stuck
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token && user) {
      fetchUserContext()
    } else {
      setLoading(false)
    }
  }, [user])

  const selectOrganization = async (organizationId: string) => {
    const newOrganization = organizations.find(o => o.id === organizationId)
    if (newOrganization) {
      setCurrentOrganization(newOrganization)
      localStorage.setItem('currentOrganizationId', organizationId)

      // If superuser, check if user is a member of the selected organization
      if (isSuperuser) {
        // Check if user has any workspace/team memberships in the selected organization
        const userWorkspacesInOrg = workspaces.filter(w => w.organizationId === organizationId)
        
        if (userWorkspacesInOrg.length > 0) {
          // User is a member: set their workspace/team in this org
          const savedWorkspaceId = localStorage.getItem('currentWorkspaceId')
          const savedWorkspace = userWorkspacesInOrg.find(w => w.id === savedWorkspaceId) || userWorkspacesInOrg[0]
          
          setCurrentWorkspace(savedWorkspace)
          localStorage.setItem('currentWorkspaceId', savedWorkspace.id)
          
          // Set team if available
          const userTeamsInWorkspace = teams.filter(t => t.workspaceId === savedWorkspace.id)
          if (userTeamsInWorkspace.length > 0) {
            const savedTeamId = localStorage.getItem('currentTeamId')
            const savedTeam = userTeamsInWorkspace.find(t => t.id === savedTeamId) || userTeamsInWorkspace[0]
            setCurrentTeam(savedTeam)
            localStorage.setItem('currentTeamId', savedTeam.id)
          } else {
            setCurrentTeam(null)
            localStorage.removeItem('currentTeamId')
          }
        } else {
          // User is NOT a member of this organization: clear workspace/team
          setCurrentWorkspace(null)
          setCurrentTeam(null)
          localStorage.removeItem('currentWorkspaceId')
          localStorage.removeItem('currentTeamId')
        }
      } else {
        // Regular user: Filter existing workspaces
        const workspacesInOrg = workspaces.filter(w => w.organizationId === organizationId)
        if (workspacesInOrg.length > 0) {
          setCurrentWorkspace(workspacesInOrg[0])
          localStorage.setItem('currentWorkspaceId', workspacesInOrg[0].id)

          // Reset team
          const teamsInWorkspace = teams.filter(t => t.workspaceId === workspacesInOrg[0].id)
          if (teamsInWorkspace.length > 0) {
            setCurrentTeam(teamsInWorkspace[0])
            localStorage.setItem('currentTeamId', teamsInWorkspace[0].id)
          } else {
            setCurrentTeam(null)
            localStorage.removeItem('currentTeamId')
          }
        } else {
          setCurrentWorkspace(null)
          setCurrentTeam(null)
          localStorage.removeItem('currentWorkspaceId')
          localStorage.removeItem('currentTeamId')
        }
      }
    }
  }

  const selectWorkspace = (workspaceId: string) => {
    const newWorkspace = workspaces.find(w => w.id === workspaceId)
    if (newWorkspace) {
      // Check if we need to switch organization
      if (newWorkspace.organizationId !== currentOrganization?.id) {
        const newOrganization = organizations.find(o => o.id === newWorkspace.organizationId)
        if (newOrganization) {
          setCurrentOrganization(newOrganization)
          localStorage.setItem('currentOrganizationId', newOrganization.id)
        }
      }

      setCurrentWorkspace(newWorkspace)
      localStorage.setItem('currentWorkspaceId', workspaceId)

      // Reset team to null or find a team in the new workspace
      const teamsInWorkspace = teams.filter(t => t.workspaceId === workspaceId)
      if (teamsInWorkspace.length > 0) {
        setCurrentTeam(teamsInWorkspace[0])
        localStorage.setItem('currentTeamId', teamsInWorkspace[0].id)
      } else {
        setCurrentTeam(null)
        localStorage.removeItem('currentTeamId')
      }
    }
  }

  const selectTeam = (teamId: string | null) => {
    if (teamId === null) {
      setCurrentTeam(null)
      localStorage.removeItem('currentTeamId')
    } else {
      const newTeam = teams.find(t => t.id === teamId)
      if (newTeam) {
        setCurrentTeam(newTeam)
        localStorage.setItem('currentTeamId', teamId)

        // If team is in a different workspace, switch workspace too
        if (newTeam.workspaceId !== currentWorkspace?.id) {
          const newWorkspace = workspaces.find(w => w.id === newTeam.workspaceId)
          if (newWorkspace) {
            setCurrentWorkspace(newWorkspace)
            localStorage.setItem('currentWorkspaceId', newWorkspace.id)

            // Check if we need to switch organization too
            if (newWorkspace.organizationId !== currentOrganization?.id) {
              const newOrganization = organizations.find(o => o.id === newWorkspace.organizationId)
              if (newOrganization) {
                setCurrentOrganization(newOrganization)
                localStorage.setItem('currentOrganizationId', newOrganization.id)
              }
            }
          }
        }
      }
    }
  }

  const refreshContext = async () => {
    setLoading(true)
    await fetchUserContext()
  }

  const selectOKRLevel = (level: OKRLevel) => {
    setCurrentOKRLevel(level)
    localStorage.setItem('currentOKRLevel', level)
  }

  const defaultOKRContext = {
    organizationId: currentOKRLevel === 'organization' ? currentOrganization?.id || null : null,
    workspaceId: currentOKRLevel === 'workspace' || currentOKRLevel === 'team' ? currentWorkspace?.id || null : null,
    teamId: currentOKRLevel === 'team' ? currentTeam?.id || null : null,
    ownerId: userId,
  }

  return (
    <WorkspaceContext.Provider
      value={{
        currentOrganization,
        currentWorkspace,
        currentTeam,
        currentOKRLevel,
        organizations,
        workspaces,
        teams,
        loading,
        isSuperuser,
        selectOrganization,
        selectWorkspace,
        selectTeam,
        selectOKRLevel,
        refreshContext,
        defaultOKRContext,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}

