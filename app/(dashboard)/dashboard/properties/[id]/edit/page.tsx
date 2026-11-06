import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getPropertyForTenant } from "@/lib/db/tenant-scope";
import { PropertyForm } from "@/components/properties/PropertyForm";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const { id } = await params;
  const db = getDb(env.DB);
  const property = await getPropertyForTenant(db, session.tenantId, id);
  if (!property) notFound();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-dark">Editar propiedad</h1>
      <div className="mt-6">
        <PropertyForm
          initialValues={{
            title: property.title,
            type: property.type as any,
            operation: property.operation as any,
            priceCents: property.priceCents,
            currency: property.currency,
            areaM2: property.areaM2 ?? undefined,
            bedrooms: property.bedrooms ?? undefined,
            bathrooms: property.bathrooms ?? undefined,
            parkingSpots: property.parkingSpots,
            stratum: property.stratum ?? undefined,
            city: property.city ?? undefined,
            neighborhood: property.neighborhood ?? undefined,
            address: property.address ?? undefined,
            latitude: property.latitude ?? undefined,
            longitude: property.longitude ?? undefined,
            description: property.description ?? undefined,
            coverImageId: property.coverImageId ?? undefined,
            isFeatured: property.isFeatured,
            ownerId: property.ownerId ?? undefined,
            internalCode: property.internalCode ?? undefined,
            visibility: property.visibility as any,
            listingType: property.listingType as any,
            commissionPercentage: property.commissionPercentage ?? undefined,
            amenities: JSON.parse(property.amenitiesJson) as string[],
          }}
          propertyId={property.id}
        />
      </div>
    </div>
  );
}
