import { useAuth } from '@/contexts/auth.context'

/**
 * Hook to access feature flags from the current user session
 */
export function useFeatureFlags() {
  const { user } = useAuth()

  return {
    rbacInspector: user?.features?.rbacInspector === true,
  }
}

