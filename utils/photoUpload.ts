import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

const MAX_DIMENSION = 1080
const JPEG_QUALITY = 0.75

/**
 * Downscale + recompress a local photo, then upload it to Convex storage.
 * Keeps upload sizes small (~100-300KB) so posting feels instant and
 * storage/bandwidth costs stay low.
 */
export async function compressAndUploadPhoto(
  localUri: string,
  generateUploadUrl: () => Promise<string>
): Promise<string> {
  const context = ImageManipulator.manipulate(localUri)
  context.resize({ width: MAX_DIMENSION })
  const rendered = await context.renderAsync()
  const saved = await rendered.saveAsync({
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
  })

  const uploadUrl = await generateUploadUrl()
  const blob = await (await fetch(saved.uri)).blob()
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob,
  })
  if (!response.ok) {
    throw new Error('Photo upload failed')
  }
  const { storageId } = (await response.json()) as { storageId: string }
  return storageId
}
