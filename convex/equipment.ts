import { v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import {
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from './_generated/server'

const capabilities = v.object({
  weightMinKg: v.optional(v.number()),
  weightMaxKg: v.optional(v.number()),
  adjustable: v.optional(v.boolean()),
  incline: v.optional(v.boolean()),
  speedControl: v.optional(v.boolean()),
  resistanceLevels: v.optional(v.number()),
  quantity: v.optional(v.number()),
  resistance: v.optional(v.string()),
  dimensions: v.optional(v.string()),
})

const equipmentDocument = v.object({
  _id: v.id('user_equipment'),
  _creationTime: v.number(),
  userId: v.string(),
  catalogKey: v.string(),
  label: v.string(),
  details: v.optional(v.string()),
  capabilities: v.optional(capabilities),
  photoStorageId: v.optional(v.id('_storage')),
  isArchived: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

const equipmentResult = v.object({
  equipment: equipmentDocument,
  photoUrl: v.union(v.string(), v.null()),
})

const setupDetails = v.object({
  minWeightKg: v.optional(v.number()),
  maxWeightKg: v.optional(v.number()),
  adjustable: v.optional(v.boolean()),
  quantity: v.optional(v.number()),
  resistance: v.optional(v.string()),
  dimensions: v.optional(v.string()),
  notes: v.optional(v.string()),
})

const setupEquipment = v.object({
  _id: v.id('user_equipment'),
  catalogKey: v.string(),
  label: v.string(),
  details: setupDetails,
  photoStorageIds: v.array(v.id('_storage')),
  archived: v.boolean(),
  updatedAt: v.number(),
})

function trimmedRequired(value: string, field: string, maxLength: number): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${field} is required`)
  if (trimmed.length > maxLength) {
    throw new Error(`${field} must be ${maxLength} characters or fewer`)
  }
  return trimmed
}

function validateCapabilities(value: {
  weightMinKg?: number
  weightMaxKg?: number
  adjustable?: boolean
  incline?: boolean
  speedControl?: boolean
  resistanceLevels?: number
  quantity?: number
  resistance?: string
  dimensions?: string
} | undefined): void {
  if (!value) return
  const numericValues = [
    value.weightMinKg,
    value.weightMaxKg,
    value.resistanceLevels,
    value.quantity,
  ].filter((item): item is number => item !== undefined)
  if (numericValues.some((item) => !Number.isFinite(item) || item < 0)) {
    throw new Error('Equipment capability values must be non-negative numbers')
  }
  if (
    value.weightMinKg !== undefined &&
    value.weightMaxKg !== undefined &&
    value.weightMinKg > value.weightMaxKg
  ) {
    throw new Error('Minimum weight cannot exceed maximum weight')
  }
  if (value.quantity !== undefined && (value.quantity < 1 || value.quantity > 100)) {
    throw new Error('Equipment quantity must be between 1 and 100')
  }
  if ((value.resistance?.length ?? 0) > 200) {
    throw new Error('Resistance details must be 200 characters or fewer')
  }
  if ((value.dimensions?.length ?? 0) > 200) {
    throw new Error('Dimensions must be 200 characters or fewer')
  }
}

async function requireOwnedPhotoUpload(
  ctx: MutationCtx,
  userId: string,
  storageId: Id<'_storage'>,
) {
  const upload = await ctx.db
    .query('equipment_photo_uploads')
    .withIndex('by_storageId', (q) => q.eq('storageId', storageId))
    .unique()
  if (!upload || upload.userId !== userId) {
    throw new Error('Equipment photo upload not found')
  }
  return upload
}

async function attachPhotoUpload(
  ctx: MutationCtx,
  userId: string,
  storageId: Id<'_storage'>,
  equipmentId: Id<'user_equipment'>,
): Promise<void> {
  const upload = await requireOwnedPhotoUpload(ctx, userId, storageId)
  await ctx.db.patch(upload._id, {
    status: 'attached',
    equipmentId,
    updatedAt: Date.now(),
  })
}

async function deleteTrackedPhoto(
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
): Promise<void> {
  const upload = await ctx.db
    .query('equipment_photo_uploads')
    .withIndex('by_storageId', (q) => q.eq('storageId', storageId))
    .unique()
  await ctx.storage.delete(storageId)
  if (upload) await ctx.db.delete(upload._id)
}

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    return await ctx.storage.generateUploadUrl()
  },
})

export const registerPhotoUpload = mutation({
  args: { storageId: v.id('_storage') },
  returns: v.id('equipment_photo_uploads'),
  handler: async (ctx, { storageId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    const existing = await ctx.db
      .query('equipment_photo_uploads')
      .withIndex('by_storageId', (q) => q.eq('storageId', storageId))
      .unique()
    if (existing) {
      if (existing.userId !== identity.subject) {
        throw new Error('Equipment photo upload not found')
      }
      return existing._id
    }
    const now = Date.now()
    const uploads = await ctx.db
      .query('equipment_photo_uploads')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .take(120)
    const staleBefore = now - 24 * 60 * 60 * 1000
    for (const upload of uploads) {
      if (upload.status === 'pending' && upload.createdAt < staleBefore) {
        await deleteTrackedPhoto(ctx, upload.storageId)
      }
    }
    const pendingCount = uploads.filter(
      (upload) =>
        upload.status === 'pending' && upload.createdAt >= staleBefore,
    ).length
    if (pendingCount >= 10) {
      await ctx.storage.delete(storageId)
      throw new Error('Finish or discard an existing equipment photo first')
    }
    return await ctx.db.insert('equipment_photo_uploads', {
      userId: identity.subject,
      storageId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const discardPhotoUpload = mutation({
  args: { storageId: v.id('_storage') },
  returns: v.null(),
  handler: async (ctx, { storageId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    const upload = await requireOwnedPhotoUpload(
      ctx,
      identity.subject,
      storageId,
    )
    if (upload.status !== 'pending') {
      throw new Error('Attached equipment photos cannot be discarded')
    }
    await deleteTrackedPhoto(ctx, storageId)
    return null
  },
})

export const getPhotoUploadOwner = internalQuery({
  args: { storageId: v.id('_storage') },
  returns: v.union(
    v.object({
      userId: v.string(),
      status: v.union(v.literal('pending'), v.literal('attached')),
    }),
    v.null(),
  ),
  handler: async (ctx, { storageId }) => {
    const upload = await ctx.db
      .query('equipment_photo_uploads')
      .withIndex('by_storageId', (q) => q.eq('storageId', storageId))
      .unique()
    return upload
      ? { userId: upload.userId, status: upload.status }
      : null
  },
})

export const create = mutation({
  args: {
    catalogKey: v.string(),
    label: v.string(),
    details: v.optional(v.string()),
    capabilities: v.optional(capabilities),
    photoStorageId: v.optional(v.id('_storage')),
  },
  returns: v.id('user_equipment'),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const catalogKey = trimmedRequired(args.catalogKey, 'Catalog key', 80)
    const label = trimmedRequired(args.label, 'Label', 80)
    validateCapabilities(args.capabilities)
    const details = args.details?.trim()
    if (details && details.length > 500) {
      throw new Error('Details must be 500 characters or fewer')
    }
    const existingEquipment = await ctx.db
      .query('user_equipment')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .take(100)
    if (existingEquipment.length >= 100) {
      throw new Error('You can save up to 100 equipment items')
    }
    if (args.photoStorageId) {
      await requireOwnedPhotoUpload(
        ctx,
        identity.subject,
        args.photoStorageId,
      )
    }

    const now = Date.now()
    const equipmentId = await ctx.db.insert('user_equipment', {
      userId: identity.subject,
      catalogKey,
      label,
      details: details || undefined,
      capabilities: args.capabilities,
      photoStorageId: args.photoStorageId,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    })
    if (args.photoStorageId) {
      await attachPhotoUpload(
        ctx,
        identity.subject,
        args.photoStorageId,
        equipmentId,
      )
    }
    return equipmentId
  },
})

export const update = mutation({
  args: {
    equipmentId: v.id('user_equipment'),
    catalogKey: v.optional(v.string()),
    label: v.optional(v.string()),
    details: v.optional(v.string()),
    capabilities: v.optional(capabilities),
    photoStorageId: v.optional(v.id('_storage')),
    removePhoto: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    const existing = await ctx.db.get(args.equipmentId)
    if (!existing || existing.userId !== identity.subject) {
      throw new Error('Equipment not found')
    }

    const catalogKey =
      args.catalogKey === undefined
        ? existing.catalogKey
        : trimmedRequired(args.catalogKey, 'Catalog key', 80)
    const label =
      args.label === undefined
        ? existing.label
        : trimmedRequired(args.label, 'Label', 80)
    const details =
      args.details === undefined ? existing.details : args.details.trim()
    validateCapabilities(args.capabilities)
    if (details && details.length > 500) {
      throw new Error('Details must be 500 characters or fewer')
    }

    let photoStorageId = existing.photoStorageId
    if (args.removePhoto) {
      photoStorageId = undefined
    } else if (args.photoStorageId) {
      await requireOwnedPhotoUpload(
        ctx,
        identity.subject,
        args.photoStorageId,
      )
      photoStorageId = args.photoStorageId
    }
    if (
      existing.photoStorageId &&
      existing.photoStorageId !== photoStorageId
    ) {
      await deleteTrackedPhoto(ctx, existing.photoStorageId)
    }

    await ctx.db.patch(existing._id, {
      catalogKey,
      label,
      details: details || undefined,
      capabilities: args.capabilities ?? existing.capabilities,
      photoStorageId,
      updatedAt: Date.now(),
    })
    if (
      photoStorageId &&
      photoStorageId !== existing.photoStorageId
    ) {
      await attachPhotoUpload(
        ctx,
        identity.subject,
        photoStorageId,
        existing._id,
      )
    }
    return null
  },
})

export const listActive = query({
  args: {},
  returns: v.array(equipmentResult),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const rows = await ctx.db
      .query('user_equipment')
      .withIndex('by_userId_and_isArchived', (q) =>
        q.eq('userId', identity.subject).eq('isArchived', false)
      )
      .take(100)
    return await Promise.all(
      rows.map(async (equipment) => ({
        equipment,
        photoUrl: equipment.photoStorageId
          ? await ctx.storage.getUrl(equipment.photoStorageId)
          : null,
      }))
    )
  },
})

export const archive = mutation({
  args: {
    equipmentId: v.id('user_equipment'),
    archived: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { equipmentId, archived = true }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    const existing = await ctx.db.get(equipmentId)
    if (!existing || existing.userId !== identity.subject) {
      throw new Error('Equipment not found')
    }
    await ctx.db.patch(existing._id, {
      isArchived: archived,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const deleteEquipment = mutation({
  args: { equipmentId: v.id('user_equipment') },
  returns: v.null(),
  handler: async (ctx, { equipmentId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    const existing = await ctx.db.get(equipmentId)
    if (!existing || existing.userId !== identity.subject) {
      throw new Error('Equipment not found')
    }
    if (existing.photoStorageId) {
      await deleteTrackedPhoto(ctx, existing.photoStorageId)
    }
    await ctx.db.delete(existing._id)
    return null
  },
})

export const list = query({
  args: {},
  returns: v.array(setupEquipment),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    const rows = await ctx.db
      .query('user_equipment')
      .withIndex('by_userId_and_isArchived', (q) =>
        q.eq('userId', identity.subject).eq('isArchived', false)
      )
      .take(100)
    return rows.map((row) => ({
      _id: row._id,
      catalogKey: row.catalogKey,
      label: row.label,
      details: {
        minWeightKg: row.capabilities?.weightMinKg,
        maxWeightKg: row.capabilities?.weightMaxKg,
        adjustable: row.capabilities?.adjustable,
        quantity: row.capabilities?.quantity,
        resistance: row.capabilities?.resistance,
        dimensions: row.capabilities?.dimensions,
        notes: row.details,
      },
      photoStorageIds: row.photoStorageId ? [row.photoStorageId] : [],
      archived: row.isArchived,
      updatedAt: row.updatedAt,
    }))
  },
})

export const upsert = mutation({
  args: {
    equipmentId: v.optional(v.id('user_equipment')),
    catalogKey: v.string(),
    label: v.string(),
    details: setupDetails,
    photoStorageIds: v.array(v.id('_storage')),
  },
  returns: v.id('user_equipment'),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    if (args.photoStorageIds.length > 1) {
      throw new Error('Each equipment item supports one private photo')
    }
    const catalogKey = trimmedRequired(args.catalogKey, 'Catalog key', 80)
    const label = trimmedRequired(args.label, 'Label', 80)
    const notes = args.details.notes?.trim()
    validateCapabilities({
      weightMinKg: args.details.minWeightKg,
      weightMaxKg: args.details.maxWeightKg,
      adjustable: args.details.adjustable,
      quantity: args.details.quantity,
      resistance: args.details.resistance,
      dimensions: args.details.dimensions,
    })
    if (notes && notes.length > 500) {
      throw new Error('Notes must be 500 characters or fewer')
    }
    const nextPhotoStorageId = args.photoStorageIds[0]
    if (nextPhotoStorageId) {
      await requireOwnedPhotoUpload(
        ctx,
        identity.subject,
        nextPhotoStorageId,
      )
    }
    const fields = {
      catalogKey,
      label,
      details: notes || undefined,
      capabilities: {
        weightMinKg: args.details.minWeightKg,
        weightMaxKg: args.details.maxWeightKg,
        adjustable: args.details.adjustable,
        quantity: args.details.quantity,
        resistance: args.details.resistance?.trim() || undefined,
        dimensions: args.details.dimensions?.trim() || undefined,
      },
      photoStorageId: nextPhotoStorageId,
      isArchived: false,
      updatedAt: Date.now(),
    }

    if (args.equipmentId) {
      const existing = await ctx.db.get(args.equipmentId)
      if (!existing || existing.userId !== identity.subject) {
        throw new Error('Equipment not found')
      }
      if (
        existing.photoStorageId &&
        existing.photoStorageId !== fields.photoStorageId
      ) {
        await deleteTrackedPhoto(ctx, existing.photoStorageId)
      }
      await ctx.db.patch(existing._id, fields)
      if (
        nextPhotoStorageId &&
        nextPhotoStorageId !== existing.photoStorageId
      ) {
        await attachPhotoUpload(
          ctx,
          identity.subject,
          nextPhotoStorageId,
          existing._id,
        )
      }
      return existing._id
    }

    const existingEquipment = await ctx.db
      .query('user_equipment')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .take(100)
    if (existingEquipment.length >= 100) {
      throw new Error('You can save up to 100 equipment items')
    }
    const equipmentId = await ctx.db.insert('user_equipment', {
      userId: identity.subject,
      ...fields,
      createdAt: Date.now(),
    })
    if (nextPhotoStorageId) {
      await attachPhotoUpload(
        ctx,
        identity.subject,
        nextPhotoStorageId,
        equipmentId,
      )
    }
    return equipmentId
  },
})

export const remove = mutation({
  args: { equipmentId: v.id('user_equipment') },
  returns: v.null(),
  handler: async (ctx, { equipmentId }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    const equipment = await ctx.db.get(equipmentId)
    if (!equipment || equipment.userId !== identity.subject) {
      throw new Error('Equipment not found')
    }
    if (equipment.photoStorageId) {
      await deleteTrackedPhoto(ctx, equipment.photoStorageId)
    }
    await ctx.db.delete(equipment._id)
    return null
  },
})
