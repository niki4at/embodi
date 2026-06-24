import { useEffect, useState } from 'react'

/**
 * Timestamp-based countdown. Reads the wall clock every 250ms so the value
 * stays accurate even after the JS timer is throttled in the background — the
 * displayed time is always derived from `endsAt`, never accumulated.
 */
export function useCountdownMs(endsAt: number | null, active: boolean): number {
  const [remainingMs, setRemainingMs] = useState(() =>
    endsAt ? Math.max(0, endsAt - Date.now()) : 0,
  )

  useEffect(() => {
    if (endsAt == null) {
      setRemainingMs(0)
      return
    }
    setRemainingMs(Math.max(0, endsAt - Date.now()))
    if (!active) return
    const id = setInterval(() => {
      setRemainingMs(Math.max(0, endsAt - Date.now()))
    }, 250)
    return () => clearInterval(id)
  }, [endsAt, active])

  return remainingMs
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}
