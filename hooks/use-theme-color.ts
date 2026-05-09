import { useTheme } from '@/constants/theme-context'
import { Colors } from '@/constants/theme'

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark,
) {
  const { resolved } = useTheme()
  const colorFromProps = props[resolved]
  if (colorFromProps) return colorFromProps
  return Colors[resolved][colorName]
}
