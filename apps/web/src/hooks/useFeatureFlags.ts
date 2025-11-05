import { useAuth } from '@/contexts/auth.context'

/**
 * Hook to access feature flags from the current user session and environment variables
 */
export function useFeatureFlags() {
  const { user } = useAuth()

  return {
    rbacInspector: user?.features?.rbacInspector === true,
    okrTreeView: process.env.NEXT_PUBLIC_OKR_TREE_VIEW === 'true',
  }
}


