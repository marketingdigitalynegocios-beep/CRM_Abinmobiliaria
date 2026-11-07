/**
 * `NEXT_PUBLIC_CLOUDFLARE_IMAGES_DELIVERY_URL` todavía no está configurado
 * (pendiente de aprovisionar Cloudflare Images, ver plan-implementacion.md
 * §0) — hasta entonces esto devuelve `null` para un `imageId` real de
 * Cloudflare Images, y los componentes que lo llaman muestran un placeholder
 * en vez de una <img> rota.
 *
 * Si `imageId` ya es una URL completa (http/https), se devuelve tal cual —
 * esto es lo que permite sembrar la demo con fotos de stock externas (ver
 * bitacora-desarrollo.md) sin tener Cloudflare Images configurado todavía.
 * En producción esta rama nunca se activa: un `imageId` real nunca es una URL.
 */
export function buildImageUrl(
  imageId: string | null | undefined,
  variant: "public" | "thumbnail" = "public"
): string | null {
  if (!imageId) return null;
  if (imageId.startsWith("http://") || imageId.startsWith("https://")) return imageId;

  const base = process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGES_DELIVERY_URL;
  if (!base) return null;
  return `${base}/${imageId}/${variant}`;
}
