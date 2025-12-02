'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * OKRs Page - Redirects to Hierarchy View
 * 
 * This page redirects all requests to /dashboard/okrs to /dashboard/okrs/hierarchy
 * The hierarchy page is now the main OKRs page.
 */
export default function OKRsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Preserve all query parameters when redirecting
    const params = searchParams.toString()
    const redirectUrl = `/dashboard/okrs/hierarchy${params ? `?${params}` : ''}`
    router.replace(redirectUrl)
  }, [router, searchParams])

  // Show loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-muted-foreground">Redirecting to OKR Hierarchy...</p>
      </div>
    </div>
  )
}
