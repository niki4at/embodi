/** Compact relative timestamps for social surfaces ("2h ago", "3d ago"). */
export function timeAgo(thenMs: number, nowMs: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((nowMs - thenMs) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const date = new Date(thenMs)
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year:
      date.getFullYear() === new Date(nowMs).getFullYear()
        ? undefined
        : 'numeric',
  })
}

/** Days until an event, floored at 0. */
export function daysUntil(eventMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, Math.ceil((eventMs - nowMs) / (24 * 60 * 60 * 1000)))
}

/** Weeks until an event, floored at 0. */
export function weeksUntil(eventMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, Math.ceil((eventMs - nowMs) / (7 * 24 * 60 * 60 * 1000)))
}
