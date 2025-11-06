import { useAuth } from '@/contexts/auth.context'

/**
 * Hook to access feature flags from the current user session.
 * All feature flags are now stored in the database (users.settings.features.*).
 */
export function useFeatureFlags() {
  const { user } = useAuth()

  return {
    rbacInspector: user?.features?.rbacInspector === true,
    okrTreeView: user?.features?.okrTreeView === true,
  }
}


