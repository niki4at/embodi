import type {
  EquipmentIntent,
  TrainingEnvironment,
} from '@/components/training-context'

export type Coordinates = {
  latitude: number
  longitude: number
}

export type MatchableTrainingPlace = Coordinates & {
  trainingEnvironment: TrainingEnvironment
  equipmentIntent?: EquipmentIntent
  radiusM: number
}

export type TrainingPlaceMatch = {
  trainingEnvironment: TrainingEnvironment
  equipmentIntent?: EquipmentIntent
  distanceM: number
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180
}

export function distanceBetweenCoordinates(
  from: Coordinates,
  to: Coordinates,
): number {
  const earthRadiusM = 6_371_000
  const latitudeDelta = degreesToRadians(to.latitude - from.latitude)
  const longitudeDelta = degreesToRadians(to.longitude - from.longitude)
  const fromLatitude = degreesToRadians(from.latitude)
  const toLatitude = degreesToRadians(to.latitude)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2

  return earthRadiusM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export function matchTrainingPlace(
  current: Coordinates,
  places: MatchableTrainingPlace[],
): TrainingPlaceMatch | null {
  const ranked = places
    .map((place) => ({
      place,
      distanceM: distanceBetweenCoordinates(current, place),
    }))
    .filter(({ place, distanceM }) => distanceM <= place.radiusM)
    .sort((left, right) => left.distanceM - right.distanceM)
  const nearest = ranked[0]
  if (!nearest) return null

  return {
    trainingEnvironment: nearest.place.trainingEnvironment,
    equipmentIntent: nearest.place.equipmentIntent,
    distanceM: Math.round(nearest.distanceM),
  }
}
