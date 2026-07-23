import AsyncStorage from '@react-native-async-storage/async-storage'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

/**
 * Device-local presentation preferences (not synced through Convex).
 * Reduce motion follows the OS setting by default; users can force it on
 * for this app without changing their system accessibility settings.
 */
interface PreferencesContextValue {
  /** Force reduced motion in this app regardless of the OS setting. */
  reduceMotion: boolean
  setReduceMotion: (value: boolean) => void
}

const STORAGE_KEY = '@embodi/reduce-motion'

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [reduceMotion, setReduceMotionState] = useState(false)

  useEffect(() => {
    let cancelled = false
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return
        if (stored === 'true') setReduceMotionState(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const setReduceMotion = useCallback((value: boolean) => {
    setReduceMotionState(value)
    AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false').catch(() => {})
  }, [])

  const value = useMemo<PreferencesContextValue>(
    () => ({ reduceMotion, setReduceMotion }),
    [reduceMotion, setReduceMotion],
  )

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) {
    return { reduceMotion: false, setReduceMotion: () => {} }
  }
  return ctx
}
