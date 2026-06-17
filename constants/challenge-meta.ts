import type { Palette } from './design'
import type { IconSymbol } from '@/components/ui/icon-symbol'

export type ChallengeCategory =
  | 'endurance'
  | 'weight_loss'
  | 'weight_gain'
  | 'strength'
  | 'habit'
  | 'custom'

export type MetricKind =
  | 'body_weight'
  | 'distance'
  | 'frequency'
  | 'duration'
  | 'custom'

export type MetricDirection = 'increase' | 'decrease' | 'maintain'

type IconName = Parameters<typeof IconSymbol>[0]['name']

export interface CategoryMeta {
  id: ChallengeCategory
  label: string
  blurb: string
  icon: IconName
  accent: keyof Palette
  defaultTitle: string
  defaultMetric: {
    kind: MetricKind
    unit: string
    direction: MetricDirection
  }
}

export const CATEGORY_META: Record<ChallengeCategory, CategoryMeta> = {
  endurance: {
    id: 'endurance',
    label: 'Endurance',
    blurb: 'Run a 5K, half, or full marathon',
    icon: 'figure.run',
    accent: 'accentTeal',
    defaultTitle: 'Run a marathon',
    defaultMetric: { kind: 'distance', unit: 'km', direction: 'increase' },
  },
  weight_loss: {
    id: 'weight_loss',
    label: 'Lose weight',
    blurb: 'Shed body weight steadily and safely',
    icon: 'flame.fill',
    accent: 'primary',
    defaultTitle: 'Lose weight',
    defaultMetric: { kind: 'body_weight', unit: 'kg', direction: 'decrease' },
  },
  weight_gain: {
    id: 'weight_gain',
    label: 'Gain weight',
    blurb: 'Build mass and strength over time',
    icon: 'dumbbell.fill',
    accent: 'accentPurple',
    defaultTitle: 'Gain weight',
    defaultMetric: { kind: 'body_weight', unit: 'kg', direction: 'increase' },
  },
  strength: {
    id: 'strength',
    label: 'Get stronger',
    blurb: 'Hit a new lift or strength milestone',
    icon: 'figure.strengthtraining.traditional',
    accent: 'warning',
    defaultTitle: 'Get stronger',
    defaultMetric: { kind: 'custom', unit: 'kg', direction: 'increase' },
  },
  habit: {
    id: 'habit',
    label: 'Build a habit',
    blurb: 'Move regularly, e.g. swim 3x a week',
    icon: 'repeat',
    accent: 'accentPink',
    defaultTitle: 'Swim regularly',
    defaultMetric: { kind: 'frequency', unit: 'sessions', direction: 'increase' },
  },
  custom: {
    id: 'custom',
    label: 'Custom goal',
    blurb: 'Anything you want to work toward',
    icon: 'target',
    accent: 'accentCoral',
    defaultTitle: 'My challenge',
    defaultMetric: { kind: 'custom', unit: 'reps', direction: 'increase' },
  },
}

export const CATEGORY_ORDER: ChallengeCategory[] = [
  'endurance',
  'weight_loss',
  'weight_gain',
  'strength',
  'habit',
  'custom',
]
