/** Static image mapping → /public/new-img (real PNG assets). Swap any file
 * (same name) for a different photo; ImageSlot falls back to a gradient if missing. */
import type { PetOut, ServiceItemOut } from "@/api/types"

const IMG = "/new-img"

export const HERO_IMG = `${IMG}/hero.png`
export const OWNER_AVATAR_IMG = `${IMG}/avatar-owner.png`

/** Service photo by category + tier (used for both the card thumb and detail hero). */
export function serviceImg(s: ServiceItemOut): string {
  if (s.category === "Lodging") {
    return s.roomType === "Deluxe" ? `${IMG}/service-deluxe.png` : `${IMG}/service-standard.png`
  }
  return s.groomingType === "Full" ? `${IMG}/service-full.png` : `${IMG}/service-basic.png`
}

/** Pet avatar by species (falls back to a generic). */
export function petImg(p: Pick<PetOut, "species">): string {
  const sp = (p.species ?? "").toLowerCase()
  if (sp.includes("cat") || sp.includes("貓")) return `${IMG}/pet-cat.png`
  if (sp.includes("rabbit") || sp.includes("兔")) return `${IMG}/pet-rabbit.png`
  if (sp.includes("dog") || sp.includes("狗") || sp.includes("犬")) return `${IMG}/pet-dog.png`
  return `${IMG}/pet-default.png`
}

const GROOM_PHOTOS = [`${IMG}/groom-1.png`, `${IMG}/groom-2.png`, `${IMG}/groom-3.png`]
/** Rotating decorative grooming photo for the work-order photo grid. */
export function groomPhoto(index: number): string {
  return GROOM_PHOTOS[index % GROOM_PHOTOS.length]
}
