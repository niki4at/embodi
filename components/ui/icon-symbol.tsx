// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'chevron.down': 'keyboard-arrow-down',
  'chevron.up': 'keyboard-arrow-up',
  'figure.run': 'directions-run',
  'figure.strengthtraining.traditional': 'fitness-center',
  'dumbbell.fill': 'fitness-center',
  'dumbbell': 'fitness-center',
  'flame.fill': 'local-fire-department',
  'bolt.fill': 'bolt',
  'heart.fill': 'favorite',
  'heart': 'favorite-border',
  'star.fill': 'star',
  'star': 'star-border',
  'plus': 'add',
  'plus.circle.fill': 'add-circle',
  'minus': 'remove',
  'xmark': 'close',
  'checkmark': 'check',
  'checkmark.circle.fill': 'check-circle',
  'gear': 'settings',
  'person.fill': 'person',
  'person.crop.circle': 'account-circle',
  'bell.fill': 'notifications',
  'calendar': 'calendar-today',
  'clock.fill': 'schedule',
  'timer': 'timer',
  'chart.bar.fill': 'bar-chart',
  'chart.line.uptrend.xyaxis': 'trending-up',
  'magnifyingglass': 'search',
  'arrow.right': 'arrow-forward',
  'arrow.left': 'arrow-back',
  'arrow.up.right': 'north-east',
  'ellipsis': 'more-horiz',
  'info.circle': 'info-outline',
  'sparkles': 'auto-awesome',
  'list.bullet': 'format-list-bulleted',
  'square.grid.2x2.fill': 'grid-view',
  'play.fill': 'play-arrow',
  'pause.fill': 'pause',
  'stop.fill': 'stop',
  'moon.fill': 'nightlight-round',
  'drop.fill': 'water-drop',
  'leaf.fill': 'eco',
  'book.closed': 'menu-book',
  'book.closed.fill': 'menu-book',
  'exclamationmark.triangle.fill': 'warning',
  'exclamationmark.triangle': 'warning-amber',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
