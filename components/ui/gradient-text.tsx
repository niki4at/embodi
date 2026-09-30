import React from 'react'
import { Text, View, type StyleProp, type TextStyle } from 'react-native'
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg'

import { gradients } from '@/constants/design'

/**
 * Text filled with a horizontal gradient. Uses SVG so it works identically on
 * iOS, Android, and web without a masked-view dependency. Width is measured
 * from an invisible sibling so the SVG never clips.
 */
export function GradientText({
  children,
  colors = gradients.name,
  style,
  fontFamily,
  fontSize,
  lineHeight,
  letterSpacing = 0,
  accessibilityLabel,
  outline = false,
}: {
  children: string
  colors?: readonly [string, string]
  style?: StyleProp<TextStyle>
  fontFamily: string
  fontSize: number
  lineHeight?: number
  letterSpacing?: number
  accessibilityLabel?: string
  /** Stroke the glyphs with the gradient instead of filling them. */
  outline?: boolean
}) {
  const [width, setWidth] = React.useState(0)
  const height = lineHeight ?? Math.round(fontSize * 1.25)
  const id = React.useId().replace(/:/g, '')

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? children}
      style={{ height, alignSelf: 'flex-start' }}
    >
      <Text
        allowFontScaling={false}
        onLayout={(e) => setWidth(Math.ceil(e.nativeEvent.layout.width) + 2)}
        style={[
          style,
          {
            fontFamily,
            fontSize,
            lineHeight: height,
            letterSpacing,
            opacity: 0,
            position: 'absolute',
          },
        ]}
        numberOfLines={1}
      >
        {children}
      </Text>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors[0]} />
              <Stop offset="1" stopColor={colors[1]} />
            </LinearGradient>
          </Defs>
          <SvgText
            fill={outline ? 'none' : `url(#${id})`}
            stroke={outline ? `url(#${id})` : undefined}
            strokeWidth={outline ? 1.5 : undefined}
            fontFamily={fontFamily}
            fontSize={fontSize}
            letterSpacing={letterSpacing}
            x={0}
            y={height / 2 + fontSize * 0.36}
          >
            {children}
          </SvgText>
        </Svg>
      ) : null}
    </View>
  )
}
