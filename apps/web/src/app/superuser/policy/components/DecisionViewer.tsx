'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

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
    action: string
    timestamp: string
  }
}

interface DecisionViewerProps {
  decision: DecisionResponse
}

export function DecisionViewer({ decision }: DecisionViewerProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(decision, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const reasonColour = decision.allow
    ? 'bg-green-100 text-green-800 border-green-300'
    : decision.reason === 'ROLE_DENY'
    ? 'bg-red-100 text-red-800 border-red-300'
    : decision.reason === 'TENANT_BOUNDARY'
    ? 'bg-orange-100 text-orange-800 border-orange-300'
    : decision.reason === 'PRIVATE_VISIBILITY'
    ? 'bg-purple-100 text-purple-800 border-purple-300'
    : decision.reason === 'PUBLISH_LOCK'
    ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
    : 'bg-gray-100 text-gray-800 border-gray-300'

  return (
    <div className="space-y-4" role="region" aria-live="polite" aria-label="Decision result">
      {/* Decision Badge */}
      <div className="flex items-center gap-4">
        <Badge
          variant="outline"
          className={`text-sm font-semibold px-3 py-1 ${reasonColour}`}
        >
          {decision.allow ? 'ALLOW' : 'DENY'}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {decision.reason}
        </Badge>
      </div>

      {/* Details */}
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold mb-2">User Roles</h4>
          <div className="flex flex-wrap gap-2">
            {decision.details.userRoles.length > 0 ? (
              Array.from(new Set(decision.details.userRoles)).map((role, index) => (
                <Badge key={`${role}-${index}`} variant="secondary">
                  {role}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">No roles assigned</span>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">Scopes</h4>
          <div className="space-y-1 text-sm">
            <div>
              <span className="font-medium">Tenants:</span>{' '}
              {decision.details.scopes.tenantIds.length > 0
                ? decision.details.scopes.tenantIds.join(', ')
                : 'None'}
            </div>
            <div>
              <span className="font-medium">Workspaces:</span>{' '}
              {decision.details.scopes.workspaceIds.length > 0
                ? decision.details.scopes.workspaceIds.join(', ')
                : 'None'}
            </div>
            <div>
              <span className="font-medium">Teams:</span>{' '}
              {decision.details.scopes.teamIds.length > 0
                ? decision.details.scopes.teamIds.join(', ')
                : 'None'}
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">Metadata</h4>
          <div className="space-y-1 text-sm">
            <div>
              <span className="font-medium">Action:</span> {decision.meta.action}
            </div>
            <div>
              <span className="font-medium">Evaluated User:</span> {decision.meta.evaluatedUserId}
            </div>
            <div>
              <span className="font-medium">Requested By:</span> {decision.meta.requestUserId}
            </div>
            <div>
              <span className="font-medium">Timestamp:</span>{' '}
              {new Date(decision.meta.timestamp).toLocaleString()}
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">Full Response</h4>
          <div className="relative">
            <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-64">
              {JSON.stringify(decision, null, 2)}
            </pre>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="absolute top-2 right-2"
              aria-label="Copy JSON to clipboard"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

