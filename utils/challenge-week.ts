const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

/** Zero-based index of the program week the user is in right now. */
export function currentWeekIndex(
  createdAt: number,
  weekCount: number,
  now: number = Date.now(),
): number {
  if (weekCount <= 0) return 0
  const elapsed = Math.floor((now - createdAt) / MS_PER_WEEK)
  return Math.min(weekCount - 1, Math.max(0, elapsed))
}
