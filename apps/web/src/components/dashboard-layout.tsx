'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth.context'
import { useWorkspace } from '@/contexts/workspace.context'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WorkspaceSelector } from '@/components/workspace-selector'
import { BuildStamp } from '@/components/ui/BuildStamp'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  Target, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut,
  MessageSquare,
  Network,
  Building2,
  UserCog,
  Shield,
  Calendar,
  PanelLeftClose,
  PanelLeftOpen,
  SearchCheck
} from 'lucide-react'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { ProfilePopup } from '@/components/ProfilePopup'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'OKRs', href: '/dashboard/okrs', icon: Target },
  { name: 'Visual Builder', href: '/dashboard/builder', icon: Network },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'AI Assistant', href: '/dashboard/ai', icon: MessageSquare },
]

const settingsNavigation = [
  { name: 'Organization', href: '/dashboard/settings/organization', icon: Building2 },
  { name: 'Workspaces', href: '/dashboard/settings/workspaces', icon: Settings },
  { name: 'Teams', href: '/dashboard/settings/teams', icon: Users },
  { name: 'People', href: '/dashboard/settings/people', icon: UserCog },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { isSuperuser, currentOrganization } = useWorkspace()
  const permissions = usePermissions()
  const featureFlags = useFeatureFlags()
  
  // Check if user can access governance features
  const canAccessGovernance = permissions.isTenantAdminOrOwner(currentOrganization?.id)
  
  // Check if superuser tools are available
  const canAccessSuperuserTools = isSuperuser && featureFlags.rbacInspector

  // Collapsible sidebar state
  const [isCollapsed, setIsCollapsed] = useState(false)
  // Profile popup state
  const [isProfilePopupOpen, setIsProfilePopupOpen] = useState(false)

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('sidebar-collapsed')
    if (savedState !== null) {
      setIsCollapsed(savedState === 'true')
    }
  }, [])

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed))
  }, [isCollapsed])

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r border-slate-200 flex flex-col transition-all duration-300",
        isCollapsed ? 'w-20' : 'w-64'
      )}>
        <div className={cn("relative border-b border-slate-200", isCollapsed ? 'p-4' : 'p-6')}>
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-slate-900">OKR Nexus</h1>
                <p className="text-xs text-slate-500 mt-1">AI-Powered OKRs</p>
              </div>
            )}
            {isCollapsed && (
              <button
                onClick={toggleSidebar}
                className="flex items-center justify-center w-full cursor-pointer hover:opacity-80 transition-opacity"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center">
                  <Target className="h-5 w-5 text-white" />
                </div>
              </button>
            )}
            {!isCollapsed && isSuperuser && (
              <Badge variant="default" className="ml-2 bg-purple-600 hover:bg-purple-700">
                <Shield className="h-3 w-3 mr-1" />
                Superuser
              </Badge>
            )}
            {isCollapsed && isSuperuser && (
              <Badge variant="default" className="bg-purple-600 hover:bg-purple-700 p-1">
                <Shield className="h-3 w-3" />
              </Badge>
            )}
          </div>
          
          {/* Toggle Button - Only show when expanded */}
          {!isCollapsed && (
            <button
              onClick={toggleSidebar}
              className={cn(
                "absolute z-20 -right-4 top-6",
                "h-9 w-9 rounded-full bg-white border-2 border-slate-300",
                "shadow-lg hover:shadow-xl",
                "flex items-center justify-center",
                "transition-all duration-300 hover:scale-110",
                "hover:border-slate-900 hover:bg-slate-50",
                "focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2",
                "active:scale-95"
              )}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4 text-slate-700 transition-transform duration-300" />
            </button>
          )}
        </div>

        {/* Workspace Selector */}
        {!isCollapsed && (
          <div className="p-4 border-b border-slate-200">
            <WorkspaceSelector />
          </div>
        )}

        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          {/* Main Navigation */}
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || (pathname?.startsWith(item.href + '/') && item.href !== '/dashboard')
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-lg text-sm font-medium transition-colors',
                    isCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2',
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              )
            })}
          </div>

          {/* Settings Section */}
          <div>
            {!isCollapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Settings
              </h3>
            )}
            <div className="space-y-1">
              {settingsNavigation.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center rounded-lg text-sm font-medium transition-colors',
                      isCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2',
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    )}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!isCollapsed && <span>{item.name}</span>}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Governance Section */}
          {canAccessGovernance && (
            <div>
              {!isCollapsed && (
                <h3 className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Governance
                </h3>
              )}
              <div className="space-y-1">
                <Link
                  href="/admin/cycles"
                  className={cn(
                    'flex items-center rounded-lg text-sm font-medium transition-colors',
                    isCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2',
                    pathname === '/admin/cycles' || pathname?.startsWith('/admin/cycles/')
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  )}
                  title={isCollapsed ? 'Cycles' : undefined}
                >
                  <Calendar className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && <span>Cycles</span>}
                </Link>
              </div>
            </div>
          )}

          {/* Superuser Tools Section */}
          {canAccessSuperuserTools && (
            <div>
              {!isCollapsed && (
                <h3 className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Superuser Tools
                </h3>
              )}
              <div className="space-y-1">
                <Link
                  href="/superuser/policy"
                  className={cn(
                    'flex items-center rounded-lg text-sm font-medium transition-colors',
                    isCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2',
                    pathname === '/superuser/policy' || pathname?.startsWith('/superuser/policy/')
                      ? 'bg-purple-100 text-purple-900 border border-purple-300'
                      : 'text-slate-700 hover:bg-purple-50'
                  )}
                  title={isCollapsed ? 'Policy Explorer' : undefined}
                >
                  <SearchCheck className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && <span>Policy Explorer</span>}
                </Link>
              </div>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-200">
          {!isCollapsed && (
            <button
              onClick={() => setIsProfilePopupOpen(true)}
              className="flex items-center gap-3 mb-3 px-3 py-2 w-full rounded-md hover:bg-slate-50 transition-colors text-left"
              aria-label="View profile and permissions"
            >
              <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </button>
          )}
          {isCollapsed && (
            <button
              onClick={() => setIsProfilePopupOpen(true)}
              className="flex items-center justify-center mb-3 w-full rounded-md hover:bg-slate-50 transition-colors"
              aria-label="View profile and permissions"
            >
              <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
            </button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full",
              isCollapsed ? "justify-center" : "justify-start"
            )}
            onClick={logout}
            title={isCollapsed ? 'Logout' : undefined}
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">Logout</span>}
          </Button>
        </div>
        
        {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
        {!isCollapsed && (
          <div className="mt-auto p-3 border-t border-neutral-100">
            <BuildStamp variant="footer" />
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <ImpersonationBanner />
        {children}
      </main>

      {/* Profile Popup */}
      <ProfilePopup isOpen={isProfilePopupOpen} onClose={() => setIsProfilePopupOpen(false)} />
    </div>
  )
}

function ImpersonationBanner() {
  const { impersonating, originalUser, stopImpersonating, user } = useAuth()
  
  if (!impersonating || !originalUser) return null
  
  return (
    <div className="bg-purple-600 text-white px-6 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        <Shield className="h-4 w-4" />
        <span>
          Viewing as <strong>{user?.firstName} {user?.lastName}</strong> ({user?.email})
        </span>
        <span className="text-purple-200">•</span>
        <span className="text-purple-200">
          Original: {originalUser.firstName} {originalUser.lastName}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={stopImpersonating}
        className="bg-white text-purple-600 hover:bg-purple-50 border-white"
      >
        Exit Impersonation
      </Button>
    </div>
  )
}

