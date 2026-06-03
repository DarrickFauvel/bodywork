import { v2 as cloudinary } from "cloudinary"
import type { Settings } from "../types"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

export async function uploadLogo(buf: ArrayBuffer, mimeType: string, userId: string): Promise<string> {
  const b64 = Buffer.from(buf).toString("base64")
  const dataUri = `data:${mimeType};base64,${b64}`
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `bodywork/${userId}`,
    type: "authenticated",
    resource_type: "image",
  })
  return result.public_id
}

export async function deleteLogo(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { type: "authenticated", resource_type: "image" })
  } catch {
    // Log but don't throw — DB should still be cleared even if Cloudinary delete fails
    console.error("Cloudinary delete failed for", publicId)
  }
}

// Signed URL valid for 7 days — appropriate for customer-facing shared documents
export function signedLogoUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    type: "authenticated",
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + 604800,
    secure: true,
  })
}

// Replaces logoData with a fresh signed URL when a Cloudinary logo is stored
export function resolveLogoUrl(settings: Settings): Settings {
  if (!settings.logoPublicId) return settings
  return { ...settings, logoData: signedLogoUrl(settings.logoPublicId) }
}
