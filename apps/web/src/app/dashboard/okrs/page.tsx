'use client'

import { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search, Filter, Grid3x3, List, Calendar, X } from 'lucide-react'
import { Period } from '@okr-nexus/types'
import { 
  formatPeriod, 
  getPeriodLabel, 
  getAvailablePeriodFilters, 
  getCurrentPeriodFilter,
  doesOKRMatchPeriod,
  type PeriodFilterOption
} from '@/lib/date-utils'
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'
import api from '@/lib/api'

export default function OKRsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedPeriod, setSelectedPeriod] = useState<string>(getCurrentPeriodFilter())
  const availablePeriods = getAvailablePeriodFilters()
  
  // Filter states
  const [filterWorkspaceId, setFilterWorkspaceId] = useState<string>('all')
  const [filterTeamId, setFilterTeamId] = useState<string>('all')
  const [filterOwnerId, setFilterOwnerId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  const { workspaces, teams, currentOrganization } = useWorkspace()
  const { user } = useAuth()
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [okrs, setOkrs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    loadOKRs()
    loadUsers()
  }, [currentOrganization?.id])
  
  const loadOKRs = async () => {
    if (!currentOrganization?.id) return
    try {
      setLoading(true)
      const response = await api.get(`/objectives`)
      setOkrs(response.data || [])
    } catch (error) {
      console.error('Failed to load OKRs:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const loadUsers = async () => {
    try {
      const response = await api.get('/users')
      setAvailableUsers(response.data || [])
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }

  const selectedPeriodOption = availablePeriods.find(p => p.value === selectedPeriod);
  
  // Apply filters
  const filteredOKRs = okrs.filter(okr => {
    // Period filter
    if (selectedPeriod !== 'all' && selectedPeriodOption) {
      if (okr.startDate && okr.endDate) {
        if (!doesOKRMatchPeriod(okr.startDate, okr.endDate, selectedPeriodOption)) {
          return false
        }
      } else {
        return false
      }
    }
    
    // Workspace filter
    if (filterWorkspaceId !== 'all' && okr.workspaceId !== filterWorkspaceId) {
      return false
    }
    
    // Team filter
    if (filterTeamId !== 'all' && okr.teamId !== filterTeamId) {
      return false
    }
    
    // Owner filter
    if (filterOwnerId !== 'all' && okr.ownerId !== filterOwnerId) {
      return false
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesTitle = okr.title?.toLowerCase().includes(query)
      const matchesDescription = okr.description?.toLowerCase().includes(query)
      const matchesOwner = okr.owner?.name?.toLowerCase().includes(query)
      if (!matchesTitle && !matchesDescription && !matchesOwner) {
        return false
      }
    }
    
    return true
  })
  
  const clearFilters = () => {
    setFilterWorkspaceId('all')
    setFilterTeamId('all')
    setFilterOwnerId('all')
    setSearchQuery('')
  }
  
  const hasActiveFilters = filterWorkspaceId !== 'all' || filterTeamId !== 'all' || filterOwnerId !== 'all' || searchQuery.length > 0;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">OKRs</h1>
                <p className="text-slate-600 mt-1">Manage your objectives and key results</p>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New OKR
              </Button>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 relative min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search OKRs..." 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <Select value={filterWorkspaceId} onValueChange={setFilterWorkspaceId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Workspaces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workspaces</SelectItem>
                  {workspaces.map(ws => (
                    <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterTeamId} onValueChange={setFilterTeamId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterOwnerId} onValueChange={setFilterOwnerId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Owners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {availableUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm min-w-[160px]"
              >
                <option value="all">All Time Periods</option>
                <optgroup label="Years">
                  {availablePeriods.filter(p => p.period === Period.ANNUAL).map(period => (
                    <option key={period.value} value={period.value}>{period.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Quarters">
                  {availablePeriods.filter(p => p.period === Period.QUARTERLY).map(period => (
                    <option key={period.value} value={period.value}>{period.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Months">
                  {availablePeriods.filter(p => p.period === Period.MONTHLY).map(period => (
                    <option key={period.value} value={period.value}>{period.label}</option>
                  ))}
                </optgroup>
              </select>
              
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>
            
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-600">Active filters:</span>
                {filterWorkspaceId !== 'all' && (
                  <Badge variant="secondary" className="text-xs">
                    Workspace: {workspaces.find(w => w.id === filterWorkspaceId)?.name}
                  </Badge>
                )}
                {filterTeamId !== 'all' && (
                  <Badge variant="secondary" className="text-xs">
                    Team: {teams.find(t => t.id === filterTeamId)?.name}
                  </Badge>
                )}
                {filterOwnerId !== 'all' && (
                  <Badge variant="secondary" className="text-xs">
                    Owner: {availableUsers.find(u => u.id === filterOwnerId)?.name}
                  </Badge>
                )}
              </div>
            )}
          </div>
            <div className="flex border rounded-lg">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* OKRs Grid/List */}
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading OKRs...</div>
          ) : filteredOKRs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 mb-4">No OKRs found</p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters to see all OKRs
                </Button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOKRs.map((okr) => {
                const owner = availableUsers.find(u => u.id === okr.ownerId)
                const team = teams.find(t => t.id === okr.teamId)
                const workspace = workspaces.find(w => w.id === okr.workspaceId)
                return (
                  <Card key={okr.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant={okr.status === 'ON_TRACK' ? 'default' : okr.status === 'AT_RISK' ? 'destructive' : 'secondary'} className="text-xs">
                            {okr.status === 'ON_TRACK' ? 'On Track' : okr.status === 'AT_RISK' ? 'At Risk' : okr.status}
                          </Badge>
                          {okr.visibilityLevel === 'PRIVATE' && (
                            <Badge variant="outline" className="text-xs">🔒 Private</Badge>
                          )}
                          {okr.startDate && (
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatPeriod(okr.period, okr.startDate)}
                            </Badge>
                          )}
                        </div>
                        <span className="text-2xl font-bold text-slate-900">{Math.round(okr.progress || 0)}%</span>
                      </div>
                      <CardTitle className="text-lg">{okr.title}</CardTitle>
                      <CardDescription>{okr.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="bg-slate-200 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.round(okr.progress || 0))}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">{okr.keyResults?.length || 0} Key Results</span>
                          {team && <span className="text-slate-600">{team.name}</span>}
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <div className="h-6 w-6 rounded-full bg-slate-300 flex items-center justify-center text-xs font-medium">
                            {owner?.name ? owner.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2) : '?'}
                          </div>
                          <span className="text-sm text-slate-600">{owner?.name || 'Unknown'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredOKRs.map((okr) => {
                    const owner = availableUsers.find(u => u.id === okr.ownerId)
                    const team = teams.find(t => t.id === okr.teamId)
                    const workspace = workspaces.find(w => w.id === okr.workspaceId)
                    return (
                      <div key={okr.id} className="p-6 hover:bg-slate-50 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="font-semibold text-lg">{okr.title}</h3>
                              <Badge variant={okr.status === 'ON_TRACK' ? 'default' : okr.status === 'AT_RISK' ? 'destructive' : 'secondary'} className="text-xs">
                                {okr.status === 'ON_TRACK' ? 'On Track' : okr.status === 'AT_RISK' ? 'At Risk' : okr.status}
                              </Badge>
                              {okr.visibilityLevel === 'PRIVATE' && (
                                <Badge variant="outline" className="text-xs">🔒 Private</Badge>
                              )}
                              {okr.startDate && (
                                <Badge variant="outline" className="text-xs flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatPeriod(okr.period, okr.startDate)}
                                </Badge>
                              )}
                            </div>
                            <p className="text-slate-600 mb-3">{okr.description}</p>
                            <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                              {workspace && <span>{workspace.name}</span>}
                              {team && <span>• {team.name}</span>}
                              <span>• {okr.keyResults?.length || 0} Key Results</span>
                              {owner && <span>• Owner: {owner.name}</span>}
                            </div>
                          </div>
                          <div className="ml-6 flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-3xl font-bold text-slate-900">{Math.round(okr.progress || 0)}%</div>
                              <div className="text-xs text-slate-500">Progress</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}

