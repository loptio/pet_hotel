/** Static image mapping → /public/img. Swap any file (same name) for a real photo. */
import type { PetOut, ServiceItemOut } from "@/api/types"

export const HERO_IMG = "/img/hero.jpg"
export const OWNER_AVATAR_IMG = "/img/avatar-owner.jpg"

/** Service photo by category + tier (used for both the card thumb and detail hero). */
export function serviceImg(s: ServiceItemOut): string {
  if (s.category === "Lodging") {
    return s.roomType === "Deluxe" ? "/img/service-deluxe.jpg" : "/img/service-standard.jpg"
  }
  return s.groomingType === "Full" ? "/img/service-full.jpg" : "/img/service-basic.jpg"
}

/** Pet avatar by species (falls back to a generic). */
export function petImg(p: Pick<PetOut, "species">): string {
  const sp = (p.species ?? "").toLowerCase()
  if (sp.includes("cat") || sp.includes("貓")) return "/img/pet-cat.jpg"
  if (sp.includes("rabbit") || sp.includes("兔")) return "/img/pet-rabbit.jpg"
  if (sp.includes("dog") || sp.includes("狗") || sp.includes("犬")) return "/img/pet-dog.jpg"
  return "/img/pet-default.jpg"
}

const GROOM_PHOTOS = ["/img/groom-1.jpg", "/img/groom-2.jpg", "/img/groom-3.jpg"]
/** Rotating decorative grooming photo for the work-order photo grid. */
export function groomPhoto(index: number): string {
  return GROOM_PHOTOS[index % GROOM_PHOTOS.length]
}
