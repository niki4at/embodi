import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Submit one OpenAI Batch request covering every active user's "This week"
// insight. Runs Mondays at 06:00 UTC; batch results are picked up by the
// poller below within minutes/hours.
crons.cron(
  'weekly insights batch kickoff',
  '0 6 * * 1',
  internal.weeklyInsights.kickoffWeeklyBatch
)

// Poll any pending batches every 5 minutes and write results back to each
// user's weekly_insights row. Cheap when there are no jobs.
crons.interval(
  'weekly insights batch poller',
  { minutes: 5 },
  internal.weeklyInsights.pollPendingBatches
)

// Recompute the Social tab's Discover strip (suggested people + trending
// open communities) once a day into a single snapshot document.
crons.cron(
  'discover snapshot',
  '0 4 * * *',
  internal.discover.computeDiscoverSnapshot
)

// Roll every streak row into the new ISO week just after Monday midnight UTC
// so lapsed streaks read as 0 everywhere without per-read normalization.
crons.cron(
  'finalize lapsed streaks',
  '5 0 * * 1',
  internal.streaks.finalizeLapsedStreaks,
  {}
)

// Rebuild the Social tab's "Trending this week" top-10 most-tried workouts.
crons.interval(
  'trending workouts snapshot',
  { hours: 4 },
  internal.trending.refreshTrending,
  {}
)

export default crons
