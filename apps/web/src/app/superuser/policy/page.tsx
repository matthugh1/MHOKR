'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageContainer } from '@/components/ui/PageContainer'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth.context'
import { useWorkspace } from '@/contexts/workspace.context'
import api from '@/lib/api'
import { UserPicker } from './components/UserPicker'
import { ActionPicker } from './components/ActionPicker'
import { ResourcePicker } from './components/ResourcePicker'
import { JsonContextEditor } from './components/JsonContextEditor'
import { DecisionViewer } from './components/DecisionViewer'
import { TenantSelector } from './components/TenantSelector'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'

type Action = 
  | 'view_okr'
  | 'edit_okr'
  | 'delete_okr'
  | 'publish_okr'
  | 'create_okr'
  | 'request_checkin'
  | 'manage_users'
  | 'manage_billing'
  | 'manage_workspaces'
  | 'manage_teams'
  | 'impersonate_user'
  | 'manage_tenant_settings'
  | 'view_all_okrs'
  | 'export_data'

interface DecisionForm {
  userId: string
  action: Action
  resource: {
    tenantId?: string
    workspaceId?: string
    teamId?: string
    objectiveId?: string
    keyResultId?: string
    cycleId?: string
  }
  context?: Record<string, any>
}

interface DecisionResponse {
  allow: boolean
  reason: 'ALLOW' | 'ROLE_DENY' | 'TENANT_BOUNDARY' | 'PRIVATE_VISIBILITY' | 'PUBLISH_LOCK' | 'SUPERUSER_READ_ONLY'
  details: {
    userRoles: string[]
    scopes: {
      tenantIds: string[]
      workspaceIds: string[]
      teamIds: string[]
    }
    resourceCtxEcho: any
    ruleMatched?: string
  }
  meta: {
    requestUserId: string
    evaluatedUserId: string
    action: Action
    timestamp: string
  }
}

export default function PolicyExplorerPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { isSuperuser } = useWorkspace()
  const [inspectorEnabled, setInspectorEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [decision, setDecision] = useState<DecisionResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)
  
  const [form, setForm] = useState<DecisionForm>({
    userId: user?.id || '',
    action: 'view_okr',
    resource: {},
    context: {},
  })
  const [selectedTenantId, setSelectedTenantId] = useState<string>('')

  useEffect(() => {
    // Check if user is superuser and flag is enabled
    if (!user) {
      setLoading(false)
      return
    }

    if (!user.isSuperuser) {
      router.push('/dashboard')
      return
    }

    // Check flag from system status
    api.get('/system/status')
      .then((response) => {
        const enabled = response.data?.flags?.rbacInspector === true
        setInspectorEnabled(enabled)
        if (!enabled) {
          router.push('/dashboard')
        }
      })
      .catch(() => {
        setInspectorEnabled(false)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [user, router])

  const handleSubmit = async () => {
    if (!form.userId || !form.action) {
      return
    }

    setSubmitting(true)
    try {
      const response = await api.post<DecisionResponse>('/policy/decide', {
        userId: form.userId || undefined,
        action: form.action,
        resource: Object.keys(form.resource).length > 0 ? form.resource : undefined,
        context: Object.keys(form.context || {}).length > 0 ? form.context : undefined,
      })

      setDecision(response.data)

      // Telemetry
      if (typeof window !== 'undefined' && (window as any).track) {
        (window as any).track('policy_decide_submitted', {
          action: form.action,
          hasResource: Object.keys(form.resource).length > 0,
          evaluatedUserId: form.userId !== user?.id,
        })

        (window as any).track('policy_decide_result', {
          allow: response.data.allow,
          reason: response.data.reason,
        })
      }
    } catch (error: any) {
      console.error('Failed to get decision:', error)
      if (error.response?.status === 404) {
        alert('Policy Decision Explorer is not enabled (RBAC_INSPECTOR flag is off)')
      } else if (error.response?.status === 403) {
        alert('Only superusers can access the Policy Decision Explorer')
      } else {
        alert('Failed to get decision. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleUseMe = () => {
    if (user?.id) {
      setForm({ ...form, userId: user.id })
    }
  }

  const handleClearResource = () => {
    setForm({ ...form, resource: {} })
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <PageContainer variant="dashboard">
            <div>Loading...</div>
          </PageContainer>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!user?.isSuperuser || inspectorEnabled === false) {
    return null
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <PageContainer variant="dashboard">
          <div className="mb-8">
            <PageHeader
              title="Policy Decision Explorer"
              subtitle="Inspect live permission decisions via the centralised AuthorisationService. Read-only; no data is changed."
            />
          </div>

          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Read-only inspector. No mutations are performed. All decisions are logged for audit purposes.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Form */}
            <Card>
              <CardHeader>
                <CardTitle>Decision Parameters</CardTitle>
                <CardDescription>
                  Configure the user, action, and resource context to evaluate.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <TenantSelector
                  value={selectedTenantId}
                  onChange={setSelectedTenantId}
                />

                <div>
                  <UserPicker
                    value={form.userId}
                    onChange={(userId) => setForm({ ...form, userId })}
                    tenantId={selectedTenantId || undefined}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUseMe}
                    className="mt-2"
                  >
                    Use me
                  </Button>
                </div>

                <ActionPicker
                  value={form.action}
                  onChange={(action) => setForm({ ...form, action })}
                />

                <ResourcePicker
                  value={form.resource}
                  onChange={(resource) => setForm({ ...form, resource })}
                  tenantId={selectedTenantId || undefined}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearResource}
                >
                  Clear resource
                </Button>

                <JsonContextEditor
                  value={form.context}
                  onChange={(context) => setForm({ ...form, context })}
                />

                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !form.userId || !form.action}
                  className="w-full"
                >
                  {submitting ? 'Evaluating...' : 'Evaluate Decision'}
                </Button>
              </CardContent>
            </Card>

            {/* Right Column: Results */}
            <Card>
              <CardHeader>
                <CardTitle>Decision Result</CardTitle>
                <CardDescription>
                  Result of the permission check with detailed reasoning.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {decision ? (
                  <DecisionViewer decision={decision} />
                ) : (
                  <div className="text-muted-foreground text-sm">
                    Submit a decision request to see results here.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </PageContainer>
      </DashboardLayout>
    </ProtectedRoute>
  )
}

