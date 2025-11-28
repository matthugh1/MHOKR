'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function CallbackContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    useEffect(() => {
        const token = searchParams.get('token')

        if (token) {
            localStorage.setItem('access_token', token)
            // Force a reload to ensure auth context picks up the token immediately
            // or just push to dashboard and let AuthContext check it.
            // AuthContext checks on mount, but we are already mounted.
            // However, pushing to /dashboard will trigger a navigation.
            // If AuthContext is high up, it might not re-check unless we trigger it.
            // But usually navigating to a protected route triggers a check or the protected route checks.
            // Let's just push for now.
            router.push('/dashboard')
        } else {
            router.push('/login?error=auth_failed')
        }
    }, [router, searchParams])

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Authenticating...</h2>
                <p className="text-muted-foreground">Please wait while we log you in.</p>
            </div>
        </div>
    )
}

export default function CallbackPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CallbackContent />
        </Suspense>
    )
}
