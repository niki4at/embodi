import type { Id } from '@/convex/_generated/dataModel'

export type TodaysCheckin = {
  _id: Id<'daily_checkins'>
  energyLevel: number
  painLevel: number
  timeAvailable: string
  workoutType: string
} | null | undefined

export type TodaysSession = {
  _id: Id<'workout_sessions'>
  status: 'generating' | 'generated' | 'in-progress' | 'completed' | 'failed'
  goal: string
  modality: string
  durationMin: number
  planCount: number
  setsLogged: number
  totalTargetSets: number
} | null | undefined

export type TodayState =
  | { kind: 'loading' }
  | { kind: 'needs-checkin' }
  | { kind: 'checkin-orphan' }
  | { kind: 'generating'; sessionId: Id<'workout_sessions'> }
  | {
      kind: 'ready' | 'in-progress' | 'completed'
      session: NonNullable<TodaysSession>
    }

export type StartMovementCardState = Extract<
  TodayState,
  { kind: 'needs-checkin' | 'completed' }
>
export type TodayCardState = Exclude<TodayState, StartMovementCardState>

export function deriveTodayState(
  checkin: TodaysCheckin,
  session: TodaysSession,
): TodayState {
  if (checkin === undefined || session === undefined) {
    return { kind: 'loading' }
  }
  if (session) {
    if (session.status === 'generating') {
      return { kind: 'generating', sessionId: session._id }
    }
    if (session.status === 'in-progress') {
      return { kind: 'in-progress', session }
    }
    if (session.status === 'completed') {
      return { kind: 'completed', session }
    }
    return { kind: 'ready', session }
  }
  if (checkin) {
    return { kind: 'checkin-orphan' }
  }
  return { kind: 'needs-checkin' }
}

export function shouldShowStartMovementCard(
  state: TodayState,
): state is StartMovementCardState {
  return state.kind === 'needs-checkin' || state.kind === 'completed'
}
