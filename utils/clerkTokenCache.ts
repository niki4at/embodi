import * as SecureStore from 'expo-secure-store'

export type TokenCache = {
  getToken: (key: string) => Promise<string | null>
  saveToken: (key: string, value: string) => Promise<void>
}

export const tokenCache: TokenCache = {
  getToken: (key) => SecureStore.getItemAsync(key),
  saveToken: (key, value) => SecureStore.setItemAsync(key, value),
}
