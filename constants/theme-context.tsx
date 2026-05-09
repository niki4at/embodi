import AsyncStorage from '@react-native-async-storage/async-storage'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Appearance, ColorSchemeName } from 'react-native'

import {
  darkPalette,
  lightPalette,
  shadow as baseShadow,
  type Palette,
} from './design'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  mode: ThemeMode
  resolved: ResolvedTheme
  palette: Palette
  shadows: typeof baseShadow
  setMode: (mode: ThemeMode) => void
  toggle: () => void
}

const STORAGE_KEY = '@embodi/theme-mode'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function resolveScheme(mode: ThemeMode, system: ColorSchemeName): ResolvedTheme {
  if (mode === 'system') {
    return system === 'dark' ? 'dark' : 'light'
  }
  return mode
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system')
  const [system, setSystem] = useState<ColorSchemeName>(
    Appearance.getColorScheme(),
  )

  useEffect(() => {
    let cancelled = false
    AsyncStorage.getItem(STORAGE_KEY)
      .then(stored => {
        if (cancelled) return
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setModeState(stored)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystem(colorScheme)
    })
    return () => sub.remove()
  }, [])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {})
  }, [])

  const toggle = useCallback(() => {
    setModeState(prev => {
      const resolvedNow = resolveScheme(prev, system)
      const next: ThemeMode = resolvedNow === 'dark' ? 'light' : 'dark'
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {})
      return next
    })
  }, [system])

  const value = useMemo<ThemeContextValue>(() => {
    const resolved = resolveScheme(mode, system)
    const palette = resolved === 'dark' ? darkPalette : lightPalette
    return {
      mode,
      resolved,
      palette,
      shadows: baseShadow,
      setMode,
      toggle,
    }
  }, [mode, system, setMode, toggle])

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    return {
      mode: 'system',
      resolved: 'light',
      palette: lightPalette,
      shadows: baseShadow,
      setMode: () => {},
      toggle: () => {},
    }
  }
  return ctx
}

export function useThemedPalette(): Palette {
  return useTheme().palette
}
