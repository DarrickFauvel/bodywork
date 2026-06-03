import { v2 as cloudinary } from "cloudinary"
import type { Settings } from "../types"

const configured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
)

if (configured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  })
} else {
  console.warn("[cloudinary] credentials not set — using base64 stub")
}

export async function uploadLogo(buf: ArrayBuffer, mimeType: string, userId: string): Promise<string> {
  const b64 = Buffer.from(buf).toString("base64")
  if (!configured) return `data:${mimeType};base64,${b64}`
  const result = await cloudinary.uploader.upload(`data:${mimeType};base64,${b64}`, {
    folder: `bodywork/${userId}`,
    type: "authenticated",
    resource_type: "image",
  })
  return result.public_id
}

export async function deleteLogo(publicId: string): Promise<void> {
  if (!configured || publicId.startsWith("data:")) return
  try {
    await cloudinary.uploader.destroy(publicId, { type: "authenticated", resource_type: "image" })
  } catch {
    console.error("Cloudinary delete failed for", publicId)
  }
}

// Signed URL valid for 7 days — appropriate for customer-facing shared documents
export function signedLogoUrl(publicId: string): string {
  if (!configured || publicId.startsWith("data:")) return publicId
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
