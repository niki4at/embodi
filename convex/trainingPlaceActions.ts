"use node"

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto'
import { v } from 'convex/values'

import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { action } from './_generated/server'

const trainingEnvironment = v.union(
  v.literal('home'),
  v.literal('gym'),
  v.literal('outdoors'),
  v.literal('travel')
)

const equipmentIntent = v.union(
  v.literal('available'),
  v.literal('bodyweight'),
  v.literal('treadmill')
)

type EncryptedPlace = {
  _id: Id<'training_places'>
  userId: string
  label: string
  trainingEnvironment: 'home' | 'gym' | 'outdoors' | 'travel'
  equipmentIntent?: 'available' | 'bodyweight' | 'treadmill'
  radiusM: number
  encryptedCoordinates: string
  encryptionIv: string
  encryptionAuthTag: string
  encryptionKeyVersion?: string
  createdAt: number
  updatedAt: number
}

type Coordinates = {
  latitude: number
  longitude: number
}

function currentEncryptionKeyVersion(): string {
  return process.env.TRAINING_PLACE_ENCRYPTION_KEY_VERSION?.trim() || '1'
}

function getEncryptionKey(version: string): Buffer {
  const currentVersion = currentEncryptionKeyVersion()
  let rawKey =
    version === currentVersion
      ? process.env.TRAINING_PLACE_ENCRYPTION_KEY
      : undefined
  if (!rawKey && process.env.TRAINING_PLACE_ENCRYPTION_KEYRING) {
    try {
      const keyring = JSON.parse(
        process.env.TRAINING_PLACE_ENCRYPTION_KEYRING,
      ) as Record<string, string>
      rawKey = keyring[version]
    } catch {
      throw new Error(
        'TRAINING_PLACE_ENCRYPTION_KEYRING must be a JSON object of version-to-key values.'
      )
    }
  }
  if (!rawKey) {
    throw new Error(
      `Training place encryption key version ${version} is not configured. Set TRAINING_PLACE_ENCRYPTION_KEY for the current version or add the old key to TRAINING_PLACE_ENCRYPTION_KEYRING.`
    )
  }
  const key = /^[a-f\d]{64}$/i.test(rawKey)
    ? Buffer.from(rawKey, 'hex')
    : Buffer.from(rawKey, 'base64')
  if (key.length !== 32) {
    throw new Error(
      'TRAINING_PLACE_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 or 64-character hex).'
    )
  }
  return key
}

function encryptCoordinates(userId: string, coordinates: Coordinates): {
  encryptedCoordinates: string
  encryptionIv: string
  encryptionAuthTag: string
  encryptionKeyVersion: string
} {
  const encryptionKeyVersion = currentEncryptionKeyVersion()
  const iv = randomBytes(12)
  const cipher = createCipheriv(
    'aes-256-gcm',
    getEncryptionKey(encryptionKeyVersion),
    iv,
  )
  cipher.setAAD(Buffer.from(userId, 'utf8'))
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(coordinates), 'utf8'),
    cipher.final(),
  ])
  return {
    encryptedCoordinates: encrypted.toString('base64'),
    encryptionIv: iv.toString('base64'),
    encryptionAuthTag: cipher.getAuthTag().toString('base64'),
    encryptionKeyVersion,
  }
}

function decryptCoordinates(place: EncryptedPlace): Coordinates {
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(place.encryptionKeyVersion ?? '1'),
      Buffer.from(place.encryptionIv, 'base64')
    )
    decipher.setAAD(Buffer.from(place.userId, 'utf8'))
    decipher.setAuthTag(Buffer.from(place.encryptionAuthTag, 'base64'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(place.encryptedCoordinates, 'base64')),
      decipher.final(),
    ])
    const parsed = JSON.parse(decrypted.toString('utf8')) as Coordinates
    if (
      !Number.isFinite(parsed.latitude) ||
      !Number.isFinite(parsed.longitude)
    ) {
      throw new Error('Invalid coordinate payload')
    }
    return parsed
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('TRAINING_PLACE_ENCRYPTION') ||
        error.message.includes('encryption key version'))
    ) {
      throw error
    }
    throw new Error(
      'Unable to decrypt saved training places. Confirm TRAINING_PLACE_ENCRYPTION_KEY matches the key used when they were saved.'
    )
  }
}

export const save = action({
  args: {
    placeId: v.optional(v.id('training_places')),
    label: v.string(),
    trainingEnvironment,
    equipmentIntent: v.optional(equipmentIntent),
    radiusM: v.number(),
    latitude: v.number(),
    longitude: v.number(),
  },
  returns: v.id('training_places'),
  handler: async (ctx, args): Promise<Id<'training_places'>> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    if (
      args.trainingEnvironment !== 'home' &&
      args.trainingEnvironment !== 'gym'
    ) {
      throw new Error('Saved places must be Home or Gym')
    }
    if (args.latitude < -90 || args.latitude > 90) {
      throw new Error('Latitude must be between -90 and 90')
    }
    if (args.longitude < -180 || args.longitude > 180) {
      throw new Error('Longitude must be between -180 and 180')
    }

    const encrypted = encryptCoordinates(identity.subject, {
      latitude: args.latitude,
      longitude: args.longitude,
    })
    return await ctx.runMutation(
      internal.trainingPlaces.saveEncryptedForUser,
      {
        userId: identity.subject,
        placeId: args.placeId,
        label: args.label,
        trainingEnvironment: args.trainingEnvironment,
        equipmentIntent: args.equipmentIntent,
        radiusM: args.radiusM,
        ...encrypted,
      }
    )
  },
})

export const list = action({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('training_places'),
      label: v.string(),
      trainingEnvironment,
      equipmentIntent: v.optional(equipmentIntent),
      radiusM: v.number(),
      latitude: v.number(),
      longitude: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    const places: EncryptedPlace[] = await ctx.runQuery(
      internal.trainingPlaces.listEncryptedForUser,
      { userId: identity.subject }
    )
    return places.map((place) => ({
      _id: place._id,
      label: place.label,
      trainingEnvironment: place.trainingEnvironment,
      equipmentIntent: place.equipmentIntent,
      radiusM: place.radiusM,
      ...decryptCoordinates(place),
      createdAt: place.createdAt,
      updatedAt: place.updatedAt,
    }))
  },
})

export const rotateEncryption = action({
  args: {},
  returns: v.object({ rotated: v.number(), keyVersion: v.string() }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    const places: EncryptedPlace[] = await ctx.runQuery(
      internal.trainingPlaces.listEncryptedForUser,
      { userId: identity.subject },
    )
    const keyVersion = currentEncryptionKeyVersion()
    let rotated = 0
    for (const place of places) {
      if ((place.encryptionKeyVersion ?? '1') === keyVersion) continue
      const coordinates = decryptCoordinates(place)
      const encrypted = encryptCoordinates(identity.subject, coordinates)
      await ctx.runMutation(internal.trainingPlaces.saveEncryptedForUser, {
        userId: identity.subject,
        placeId: place._id,
        label: place.label,
        trainingEnvironment: place.trainingEnvironment,
        equipmentIntent: place.equipmentIntent,
        radiusM: place.radiusM,
        ...encrypted,
      })
      rotated += 1
    }
    return { rotated, keyVersion }
  },
})
