import { buildImageUrl } from "@/lib/images/delivery-url";

const typeLabels: Record<string, string> = {
  apartment: "Apartamento",
  house: "Casa",
  commercial: "Local comercial",
  land: "Lote",
};

const operationLabels: Record<string, string> = {
  sale: "Venta",
  rent: "Arriendo",
  sale_rent: "Venta o arriendo",
};

export interface PublicPropertySummary {
  id: string;
  slug: string;
  title: string;
  type: string;
  operation: string;
  priceCents: number;
  currency: string;
  city: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaM2: number | null;
  coverImageId: string | null;
  status: string;
}

export function PropertyCard({
  tenantSlug,
  property,
}: {
  tenantSlug: string;
  property: PublicPropertySummary;
}) {
  const imageUrl = buildImageUrl(property.coverImageId, "public");

  return (
    <a
      className="group overflow-hidden rounded-lg border border-border bg-white transition hover:shadow-md"
      href={`/${tenantSlug}/property/${property.id}`}
    >
      <div className="relative aspect-[4/3] bg-light-gray">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={property.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            src={imageUrl}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray">Sin foto</div>
        )}
        {property.status !== "active" && (
          <span className="absolute left-2 top-2 rounded bg-dark/80 px-2 py-0.5 text-xs font-medium text-white">
            {property.status === "sold" ? "Vendida" : property.status === "rented" ? "Arrendada" : "No disponible"}
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          {operationLabels[property.operation] ?? property.operation}
        </p>
        <h3 className="mt-1 truncate font-display text-lg font-semibold text-dark">
          {property.title}
        </h3>
        <p className="text-sm text-gray">
          {typeLabels[property.type] ?? property.type}
          {property.city ? ` · ${property.city}` : ""}
        </p>
        <p className="mt-2 text-lg font-semibold text-dark">
          ${(property.priceCents / 100).toLocaleString("es-CO")} {property.currency}
        </p>
        <div className="mt-2 flex gap-3 text-xs text-gray">
          {property.bedrooms != null && <span>{property.bedrooms} hab.</span>}
          {property.bathrooms != null && <span>{property.bathrooms} baños</span>}
          {property.areaM2 != null && <span>{property.areaM2} m²</span>}
        </div>
      </div>
    </a>
  );
}
