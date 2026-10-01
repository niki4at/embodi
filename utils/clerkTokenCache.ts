import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

export type TokenCache = {
  getToken: (key: string) => Promise<string | null>
  saveToken: (key: string, value: string) => Promise<void>
}

// expo-secure-store's web build is a no-op. Calling it throws
// "getValueWithKeyAsync is not a function", and Clerk's setActive treats
// that as a failed sign-in. On web, persist the token in localStorage.
export const tokenCache: TokenCache = {
  async getToken(key) {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage === 'undefined') return null
        return localStorage.getItem(key)
      }
      return await SecureStore.getItemAsync(key)
    } catch {
      return null
    }
  },
  async saveToken(key, value) {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage === 'undefined') return
        localStorage.setItem(key, value)
        return
      }
      await SecureStore.setItemAsync(key, value)
    } catch {
      // The in-memory Clerk session still signs the user in for this page.
    }
  },
}
