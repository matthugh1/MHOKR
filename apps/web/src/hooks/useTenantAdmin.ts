import { usePermissions } from './usePermissions'
import { useWorkspace } from '@/contexts/workspace.context'

/**
 * Hook to check if the current user is a tenant admin or owner.
 * Returns true if user has TENANT_OWNER or TENANT_ADMIN role in the current organization.
 * 
 * This matches backend RBAC checks for admin-only actions like:
 * - Editing/deleting published OKRs
 * - Exporting CSV data
 * - Accessing tenant-wide analytics
 * 
 * @returns true if user is TENANT_OWNER or TENANT_ADMIN, false otherwise
 */
export function useTenantAdmin() {
  const permissions = usePermissions()
  const { currentOrganization } = useWorkspace()

  // Check if user has tenant admin/owner role in the current organization
  // must match backend RBAC canExportData() for CSV export
  // must match backend publish lock rules in objective.service.ts and key-result.service.ts
  const isTenantAdmin = permissions.isTenantAdminOrOwner(currentOrganization?.id)

  return {
    isTenantAdmin,
    loading: permissions.loading,
  }
}


