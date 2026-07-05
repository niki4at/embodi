import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Ellipse, G, Path } from 'react-native-svg'

import {
  BACK_PARTS,
  FRONT_PARTS,
  type BodyPart,
} from '@/constants/body-shapes'

/**
 * Map free-form workout body part strings ("Chest", "Lats", "Posterior
 * chain", ...) onto highlightable figure regions. Keyword matching keeps it
 * robust to whatever the catalog or the AI coach names a muscle.
 */
function regionsForBodyParts(bodyParts: string[]): Set<BodyPart> {
  const regions = new Set<BodyPart>()
  const add = (...parts: BodyPart[]) => parts.forEach((p) => regions.add(p))

  for (const raw of bodyParts) {
    const part = raw.toLowerCase()
    if (part.includes('chest') || part.includes('pec')) add('chest')
    if (part.includes('lat') && !part.includes('lateral')) add('upperBack')
    if (
      part.includes('upper back') ||
      part.includes('mid back') ||
      part.includes('trap') ||
      part.includes('rhomboid') ||
      part === 'back'
    ) {
      add('upperBack')
    }
    if (part.includes('lower back') || part.includes('erector')) {
      add('lowerBack')
    }
    if (part.includes('posterior chain')) {
      add('lowerBack', 'leftGlute', 'rightGlute', 'leftThigh', 'rightThigh')
    }
    if (part.includes('shoulder') || part.includes('delt')) {
      add('leftShoulder', 'rightShoulder')
    }
    if (
      part.includes('bicep') ||
      part.includes('tricep') ||
      part.includes('arm')
    ) {
      add('leftArm', 'rightArm')
    }
    if (part.includes('forearm') || part.includes('grip')) {
      add('leftForearm', 'rightForearm')
    }
    if (
      part.includes('core') ||
      part.includes('ab') ||
      part.includes('oblique')
    ) {
      add('abdomen')
    }
    if (part.includes('glute') || part.includes('hip')) {
      add('leftGlute', 'rightGlute')
    }
    if (
      part.includes('quad') ||
      part.includes('hamstring') ||
      part.includes('thigh') ||
      part.includes('adductor') ||
      part.includes('leg')
    ) {
      add('leftThigh', 'rightThigh')
    }
    if (part.includes('calf') || part.includes('calves') || part.includes('ankle')) {
      add('leftCalf', 'rightCalf')
    }
    if (part.includes('knee')) add('leftKnee', 'rightKnee')
    if (part.includes('neck')) add('neck')
    if (part.includes('full body') || part.includes('total body')) {
      add(
        'chest',
        'abdomen',
        'leftShoulder',
        'rightShoulder',
        'leftArm',
        'rightArm',
        'leftThigh',
        'rightThigh',
        'upperBack',
        'leftGlute',
        'rightGlute'
      )
    }
  }
  return regions
}

const BACK_ONLY: Set<BodyPart> = new Set([
  'upperBack',
  'lowerBack',
  'leftGlute',
  'rightGlute',
])

function FigureSvg({
  parts,
  hit,
  height,
  highlightColor,
  baseColor,
}: {
  parts: typeof FRONT_PARTS
  hit: Set<BodyPart>
  height: number
  highlightColor: string
  baseColor: string
}) {
  const width = Math.round((height * 200) / 420)
  return (
    <Svg viewBox="0 0 200 420" width={width} height={height}>
      <G>
        {parts.map((part) => {
          const fill = hit.has(part.id) ? highlightColor : baseColor
          if (part.shape === 'ellipse') {
            return (
              <Ellipse
                key={part.id}
                cx={part.cx}
                cy={part.cy}
                rx={part.rx}
                ry={part.ry}
                fill={fill}
              />
            )
          }
          return <Path key={part.id} d={part.d} fill={fill} />
        })}
      </G>
    </Svg>
  )
}

/**
 * Read-only mini body figure highlighting the muscles a workout hit. Shows
 * the back view only when a hit region lives there, so most cards stay to a
 * single compact silhouette.
 */
export function MuscleFigure({
  bodyParts,
  height = 72,
  highlightColor,
  baseColor,
}: {
  bodyParts: string[]
  height?: number
  /** Fill for hit muscles (defaults to white for gradient contexts). */
  highlightColor?: string
  /** Fill for the rest of the silhouette. */
  baseColor?: string
}) {
  const hit = useMemo(() => regionsForBodyParts(bodyParts), [bodyParts])
  const showBack = useMemo(
    () => Array.from(hit).some((region) => BACK_ONLY.has(region)),
    [hit]
  )
  const showFront = useMemo(
    () => !showBack || Array.from(hit).some((region) => !BACK_ONLY.has(region)),
    [hit, showBack]
  )

  if (hit.size === 0) return null

  const highlight = highlightColor ?? 'rgba(255,255,255,0.95)'
  const base = baseColor ?? 'rgba(255,255,255,0.25)'

  return (
    <View style={styles.row}>
      {showFront ? (
        <FigureSvg
          parts={FRONT_PARTS}
          hit={hit}
          height={height}
          highlightColor={highlight}
          baseColor={base}
        />
      ) : null}
      {showBack ? (
        <FigureSvg
          parts={BACK_PARTS}
          hit={hit}
          height={height}
          highlightColor={highlight}
          baseColor={base}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
})
