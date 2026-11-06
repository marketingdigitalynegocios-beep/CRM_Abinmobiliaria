/**
 * `NEXT_PUBLIC_CLOUDFLARE_IMAGES_DELIVERY_URL` todavía no está configurado
 * (pendiente de aprovisionar Cloudflare Images, ver plan-implementacion.md
 * §0) — hasta entonces esto devuelve `null` y los componentes que lo llaman
 * muestran un placeholder en vez de una <img> rota.
 */
export function buildImageUrl(
  imageId: string | null | undefined,
  variant: "public" | "thumbnail" = "public"
): string | null {
  const base = process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGES_DELIVERY_URL;
  if (!imageId || !base) return null;
  return `${base}/${imageId}/${variant}`;
}
