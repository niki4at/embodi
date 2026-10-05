/**
 * Where a finished web sign-in is allowed to land.
 * Clerk's success path calls its own navigate(), which will follow the hosted
 * account portal or any absolute URL it was given. Keep the browser on this app.
 */
export function safeAppUrl(to: string | null | undefined, origin: string): string {
  const fallback = new URL('/', origin).toString()
  if (!to) return fallback

  let url: URL
  try {
    url = new URL(to, origin)
  } catch {
    return fallback
  }

  if (url.origin !== origin) return fallback
  return url.toString()
}
