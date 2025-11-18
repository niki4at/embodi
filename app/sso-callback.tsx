import { useEffect, useRef } from 'react'
import { useRouter } from 'expo-router'
import { useConvexAuth } from 'convex/react'
import LoadingScreen from '@/components/loading-screen'

export default function SSOCallback() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useConvexAuth()
  const hasRedirectedRef = useRef(false)

  useEffect(() => {
    if (hasRedirectedRef.current || isLoading) {
      return
    }

    if (isAuthenticated) {
      hasRedirectedRef.current = true
      router.replace('/')
      return
    }

    const fallbackTimer = setTimeout(() => {
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true
        router.replace('/')
      }
    }, 2000)

    return () => clearTimeout(fallbackTimer)
  }, [isAuthenticated, isLoading, router])

  return <LoadingScreen message="Completing sign in..." />
}
