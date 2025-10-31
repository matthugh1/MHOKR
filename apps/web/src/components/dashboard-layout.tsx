'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth.context'
import { useWorkspace } from '@/contexts/workspace.context'
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
  User
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'My Dashboard', href: '/dashboard/me', icon: User },
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
  const { isSuperuser } = useWorkspace()

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">OKR Nexus</h1>
              <p className="text-xs text-slate-500 mt-1">AI-Powered OKRs</p>
            </div>
            {isSuperuser && (
              <Badge variant="default" className="ml-2 bg-purple-600 hover:bg-purple-700">
                <Shield className="h-3 w-3 mr-1" />
                Superuser
              </Badge>
            )}
          </div>
        </div>

        {/* Workspace Selector */}
        <div className="p-4 border-b border-slate-200">
          <WorkspaceSelector />
        </div>

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
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </div>

          {/* Settings Section */}
          <div>
            <h3 className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Settings
            </h3>
            <div className="space-y-1">
              {settingsNavigation.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 mb-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
        
        {/* TODO[phase6-polish]: unify BuildStamp footer placement across all dashboard layouts */}
        <div className="mt-auto p-3 border-t border-neutral-100">
          <BuildStamp variant="footer" />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <ImpersonationBanner />
        {children}
      </main>
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

