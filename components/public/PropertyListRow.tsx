import { buildImageUrl } from "@/lib/images/delivery-url";
import type { PublicPropertySummary } from "./PropertyCard";

const typeLabels: Record<string, string> = {
  apartment: "Apartamento",
  house: "Casa",
  commercial: "Local comercial",
  land: "Lote",
};

/** Template "classic" (ver blueprint §12): lista con imagen a la izquierda. */
export function PropertyListRow({
  tenantSlug,
  property,
}: {
  tenantSlug: string;
  property: PublicPropertySummary;
}) {
  const imageUrl = buildImageUrl(property.coverImageId, "public");

  return (
    <a
      className="flex gap-4 border-b border-border bg-white py-4 transition hover:bg-light-gray/60"
      href={`/${tenantSlug}/property/${property.id}`}
    >
      <div className="relative h-28 w-40 shrink-0 overflow-hidden rounded-md bg-light-gray">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={property.title} className="h-full w-full object-cover" src={imageUrl} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray">Sin foto</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-base font-semibold text-dark">{property.title}</h3>
        <p className="text-sm text-gray">
          {typeLabels[property.type] ?? property.type}
          {property.city ? ` · ${property.city}` : ""}
        </p>
        <p className="mt-1 text-base font-semibold text-dark">
          ${(property.priceCents / 100).toLocaleString("es-CO")} {property.currency}
        </p>
      </div>
    </a>
  );
}
