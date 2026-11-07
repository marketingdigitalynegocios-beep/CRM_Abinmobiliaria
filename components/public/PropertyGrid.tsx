import { PropertyCard, type PublicPropertySummary } from "./PropertyCard";
import { PropertyListRow } from "./PropertyListRow";
import type { PublicTemplate } from "./AgencyHeader";

export function PropertyGrid({
  tenantSlug,
  properties,
  template = "modern",
}: {
  tenantSlug: string;
  properties: PublicPropertySummary[];
  template?: PublicTemplate;
}) {
  if (properties.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-white p-10 text-center text-sm text-gray">
        No hay propiedades que coincidan con esos filtros.
      </div>
    );
  }

  if (template === "classic") {
    return (
      <div className="flex flex-col">
        {properties.map((property) => (
          <PropertyListRow key={property.id} property={property} tenantSlug={tenantSlug} />
        ))}
      </div>
    );
  }

  if (template === "minimal") {
    return (
      <div className="grid gap-10 sm:grid-cols-2">
        {properties.map((property) => (
          <PropertyCard bleed key={property.id} property={property} tenantSlug={tenantSlug} />
        ))}
      </div>
    );
  }

  // modern (default): grilla de 3 columnas, cards con borde y hover elevation
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} tenantSlug={tenantSlug} />
      ))}
    </div>
  );
}
