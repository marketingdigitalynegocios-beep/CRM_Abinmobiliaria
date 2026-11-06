import { PropertyCard, type PublicPropertySummary } from "./PropertyCard";

export function PropertyGrid({
  tenantSlug,
  properties,
}: {
  tenantSlug: string;
  properties: PublicPropertySummary[];
}) {
  if (properties.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-white p-10 text-center text-sm text-gray">
        No hay propiedades que coincidan con esos filtros.
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} tenantSlug={tenantSlug} />
      ))}
    </div>
  );
}
