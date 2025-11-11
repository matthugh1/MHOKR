'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Clock, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { useAuth } from '@/contexts/auth.context'
import { usePermissions } from '@/hooks/usePermissions'
import { trapFocus, returnFocus, getActiveElement } from '@/lib/focus-trap'
import { mapErrorToMessage } from '@/lib/error-mapping'
import { track } from '@/lib/analytics'

interface AttentionItem {
  type: 'OVERDUE_CHECKIN' | 'NO_UPDATE_14D' | 'STATUS_DOWNGRADE'
  objectiveId: string
  keyResultId?: string
  ageDays?: number
  from?: string
  to?: string
}

interface AttentionFeed {
  page: number
  pageSize: number
  totalCount: number
  items: AttentionItem[]
}

interface AttentionDrawerProps {
  isOpen: boolean
  onClose: () => void
  cycleId: string | null
  scope?: 'my' | 'team-workspace' | 'tenant'
  onNavigateToObjective?: (objectiveId: string) => void
  onNavigateToKeyResult?: (krId: string) => void
  canRequestCheckIn?: boolean
  onRequestCheckIn?: (krId: string) => void
}

export function AttentionDrawer({
  isOpen,
  onClose,
  cycleId,
  scope,
  onNavigateToObjective,
  onNavigateToKeyResult,
  canRequestCheckIn = false,
  onRequestCheckIn,
}: AttentionDrawerProps) {
  const { user } = useAuth()
  const permissions = usePermissions()
  const [feed, setFeed] = useState<AttentionFeed | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20
  const sheetContentRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const emptyStateTelemetryFiredRef = useRef(false)

  useEffect(() => {
    if (isOpen) {
      // Store previous focus
      previousFocusRef.current = getActiveElement()
      
      // Reset empty state telemetry flag
      emptyStateTelemetryFiredRef.current = false
      
      // Track telemetry
      track('attention_drawer_opened', {
        userId: user?.id,
        cycleId,
        scope,
        timestamp: new Date().toISOString(),
      })
      
      fetchFeed(1)
    } else {
      setFeed(null)
      setCurrentPage(1)
      
      // Return focus to opener
      if (previousFocusRef.current) {
        returnFocus(previousFocusRef.current)
        previousFocusRef.current = null
      }
    }
  }, [isOpen, cycleId, scope, user?.id])

  // Focus trap when drawer opens
  useEffect(() => {
    if (isOpen && sheetContentRef.current) {
      const cleanup = trapFocus(sheetContentRef.current)
      return cleanup
    }
  }, [isOpen])

  // Handle Esc key
  useEffect(() => {
    if (!isOpen) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  const fetchFeed = async (page: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      })
      if (cycleId) {
        params.append('cycleId', cycleId)
      }
      if (scope) {
        params.append('scope', scope)
      }

      const response = await api.get(`/okr/insights/attention?${params.toString()}`)
      setFeed(response.data)
      setCurrentPage(page)
      
      // Track empty state telemetry if no items
      if (response.data.items.length === 0 && !emptyStateTelemetryFiredRef.current) {
        emptyStateTelemetryFiredRef.current = true
        const userRole = getUserRole()
        track('attention_empty_state_viewed', {
          userId: user?.id,
          cycleId,
          scope,
          role: userRole,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (err: any) {
      const errorInfo = mapErrorToMessage(err)
      setError(errorInfo.message)
      console.error('[Attention Drawer] Error:', err)
    } finally {
      setLoading(false)
    }
  }
  
  const getUserRole = (): string => {
    if (permissions.isSuperuser) {
      return 'SUPERUSER'
    }
    
    // Check tenant roles
    const tenantRoles = permissions.rolesByScope?.tenant || []
    for (const tenant of tenantRoles) {
      if (tenant.roles.includes('TENANT_OWNER')) {
        return 'TENANT_OWNER'
      }
      if (tenant.roles.includes('TENANT_ADMIN')) {
        return 'TENANT_ADMIN'
      }
    }
    
    // Check workspace/team roles
    const workspaceRoles = permissions.rolesByScope?.workspace || []
    const teamRoles = permissions.rolesByScope?.team || []
    
    if (workspaceRoles.length > 0 || teamRoles.length > 0) {
      // Check if they have LEAD roles
      const hasWorkspaceLead = workspaceRoles.some(w => w.roles.includes('WORKSPACE_LEAD'))
      const hasTeamLead = teamRoles.some(t => t.roles.includes('TEAM_LEAD'))
      if (hasWorkspaceLead || hasTeamLead) {
        return 'MANAGER_LEAD'
      }
      // Otherwise contributor
      return 'CONTRIBUTOR'
    }
    
    return 'CONTRIBUTOR'
  }
  
  const getEmptyStateMessage = (): string => {
    const userRole = getUserRole()
    
    if (userRole === 'TENANT_OWNER' || userRole === 'TENANT_ADMIN') {
      return 'No items need your attention. All OKRs are on track.'
    }
    
    if (userRole === 'MANAGER_LEAD') {
      return 'No team items need attention right now.'
    }
    
    return 'Nothing needs your attention.'
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && feed && newPage <= Math.ceil(feed.totalCount / pageSize)) {
      fetchFeed(newPage)
    }
  }

  const getItemIcon = (type: AttentionItem['type']) => {
    switch (type) {
      case 'OVERDUE_CHECKIN':
        return <AlertCircle className="w-4 h-4 text-rose-600" />
      case 'NO_UPDATE_14D':
        return <Clock className="w-4 h-4 text-amber-600" />
      case 'STATUS_DOWNGRADE':
        return <TrendingDown className="w-4 h-4 text-rose-600" />
      default:
        return null
    }
  }

  const getItemLabel = (item: AttentionItem) => {
    switch (item.type) {
      case 'OVERDUE_CHECKIN':
        return `Overdue check-in${item.ageDays ? ` (${item.ageDays} days)` : ''}`
      case 'NO_UPDATE_14D':
        return `No update in ${item.ageDays || 14}+ days`
      case 'STATUS_DOWNGRADE':
        return `Status changed from ${item.from || 'ON_TRACK'} to ${item.to || 'AT_RISK'}`
      default:
        return 'Needs attention'
    }
  }

  const handleRequestCheckIn = (krId: string) => {
    if (onRequestCheckIn) {
      track('okr.insights.request_checkin.click', {
        userId: user?.id,
        keyResultId: krId,
        timestamp: new Date().toISOString(),
      })
      onRequestCheckIn(krId)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg" ref={sheetContentRef} aria-labelledby="attention-drawer-title" aria-describedby="attention-drawer-description">
        {/* SheetTitle must be a direct child of SheetContent for Radix UI accessibility */}
        <SheetTitle id="attention-drawer-title">Needs Attention</SheetTitle>
        <SheetHeader>
          <SheetDescription id="attention-drawer-description">
            Items requiring attention in {cycleId ? 'this cycle' : 'all cycles'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4" aria-busy={loading}>
          {loading && (
            <div className="text-center text-sm text-muted-foreground py-8" role="status" aria-label="Loading attention items">
              Loading attention items...
            </div>
          )}

          {error && (
            <div className="text-center text-sm text-destructive py-8" role="alert">
              {error}
            </div>
          )}

          {feed && feed.items.length === 0 && (
            <div 
              className="text-center text-sm text-muted-foreground py-8" 
              role="status"
              data-testid="attention-empty"
            >
              {getEmptyStateMessage()}
            </div>
          )}

          {feed && feed.items.length > 0 && (
            <>
              <div className="space-y-2" role="list" aria-label="Attention items">
                {feed.items.map((item, index) => (
                  <div
                    key={`${item.type}-${item.objectiveId}-${item.keyResultId || ''}-${index}`}
                    className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-muted/50 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:outline-none"
                    role="listitem"
                    tabIndex={0}
                  >
                    <div className="mt-0.5" aria-hidden="true">{getItemIcon(item.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs" role="status">
                          {item.type.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-sm font-medium">{getItemLabel(item)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 focus:ring-2 focus:ring-ring focus:outline-none"
                          onClick={() => {
                            if (item.keyResultId && onNavigateToKeyResult) {
                              onNavigateToKeyResult(item.keyResultId)
                            } else if (onNavigateToObjective) {
                              onNavigateToObjective(item.objectiveId)
                            }
                          }}
                          aria-label={item.keyResultId ? `Open key result ${item.keyResultId}` : `Open objective ${item.objectiveId}`}
                        >
                          {item.keyResultId ? 'Open KR' : 'Open Objective'}
                        </Button>
                        {item.keyResultId && canRequestCheckIn && onRequestCheckIn && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 focus:ring-2 focus:ring-ring focus:outline-none"
                            onClick={() => handleRequestCheckIn(item.keyResultId!)}
                            aria-label={`Request check-in for key result ${item.keyResultId}`}
                          >
                            Request check-in
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {feed.totalCount > pageSize && (
                <nav className="flex items-center justify-between pt-4 border-t" aria-label="Pagination">
                  <div className="text-sm text-muted-foreground" role="status">
                    Showing {((currentPage - 1) * pageSize) + 1}-
                    {Math.min(currentPage * pageSize, feed.totalCount)} of {feed.totalCount}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      aria-label="Previous page"
                      className="focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground" aria-current="page">
                      Page {currentPage} of {Math.ceil(feed.totalCount / pageSize)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= Math.ceil(feed.totalCount / pageSize)}
                      aria-label="Next page"
                      className="focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </nav>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

