import * as Location from 'expo-location'

import type { CapturedCoordinates } from './types'

export const FOREGROUND_LOCATION_DEPENDENCY = 'expo-location'

export async function captureForegroundCoordinates(): Promise<CapturedCoordinates> {
  const servicesEnabled = await Location.hasServicesEnabledAsync()
  if (!servicesEnabled) {
    throw new Error('Turn on location services to capture this place.')
  }

  const currentPermission = await Location.getForegroundPermissionsAsync()
  const permission = currentPermission.granted
    ? currentPermission
    : await Location.requestForegroundPermissionsAsync()
  if (!permission.granted) {
    throw new Error(
      'Location permission was not granted. You can enable it in device Settings.',
    )
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  })
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  }
}
