import { useAuth } from '@clerk/clerk-expo'
import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react'
import React, { useCallback, useMemo, useRef } from 'react'

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL
if (!convexUrl) {
  throw new Error('Missing EXPO_PUBLIC_CONVEX_URL')
}

const convex = new ConvexReactClient(convexUrl)

type TokenOptions = {
  template?: string
  skipCache?: boolean
}

type ClerkTokenAuth = {
  getToken: (options?: TokenOptions) => Promise<string | null>
  audience: string | string[] | undefined
}

function audienceOf(claims: unknown): string | string[] | undefined {
  if (!claims || typeof claims !== 'object' || !('aud' in claims)) return undefined
  const audience = (claims as { aud?: unknown }).aud
  if (typeof audience === 'string') return audience
  if (Array.isArray(audience) && audience.every((value) => typeof value === 'string')) {
    return audience
  }
  return undefined
}

function useClerkConvexAuth() {
  const { isLoaded, isSignedIn, getToken, sessionClaims } = useAuth()
  const authRef = useRef<ClerkTokenAuth>({
    getToken: (options) => getToken(options),
    audience: audienceOf(sessionClaims),
  })
  authRef.current = {
    getToken: (options) => getToken(options),
    audience: audienceOf(sessionClaims),
  }

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      // The session cookie is often a beat behind Google's return. One null
      // token makes Convex report signed-out and Home's queries throw.
      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          const { getToken: readToken, audience } = authRef.current
          const alreadyConvex =
            audience === 'convex' ||
            (Array.isArray(audience) && audience.includes('convex'))
          const token = await readToken(
            alreadyConvex
              ? { skipCache: forceRefreshToken || attempt > 0 }
              : { template: 'convex', skipCache: forceRefreshToken || attempt > 0 },
          )
          if (token) return token
        } catch {
          // Clerk has not minted the Convex JWT yet.
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      return null
    },
    [],
  )

  return useMemo(
    () => ({
      isLoading: !isLoaded,
      isAuthenticated: isSignedIn ?? false,
      fetchAccessToken,
    }),
    [fetchAccessToken, isLoaded, isSignedIn],
  )
}

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useClerkConvexAuth}>
      {children}
    </ConvexProviderWithAuth>
  )
}
