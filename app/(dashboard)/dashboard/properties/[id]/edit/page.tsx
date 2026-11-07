import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import Link from "next/link";
import { getPropertyForTenant, listPropertyImages } from "@/lib/db/tenant-scope";
import { buildImageUrl } from "@/lib/images/delivery-url";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { DocumentList } from "@/components/dashboard/DocumentList";

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

  const propertyImagesList = await listPropertyImages(db, property.id);
  const initialImages = propertyImagesList.map((img) => ({
    id: img.imageId,
    url: buildImageUrl(img.imageId) || img.imageId,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-dark">Editar propiedad</h1>
          <p className="text-xs text-gray mt-0.5">
            Actualiza datos, precios, foto de portada y galería de fotos adicionales.
          </p>
        </div>
        <Link
          href={`/dashboard/properties/${property.id}/sheet`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <span className="material-symbols-outlined text-[16px]">print</span>
          <span>Ver ficha PDF →</span>
        </Link>
      </div>

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
          initialImages={initialImages}
          propertyId={property.id}
        />
      </div>

      <div className="mt-8 rounded-xl border border-border bg-white dark:bg-slate-900 p-6 shadow-xs">
        <h2 className="font-display text-lg font-bold text-dark mb-1">
          Documentos Legales &amp; Certificados
        </h2>
        <p className="text-xs text-gray mb-4">
          Certificados de tradición y libertad, escrituras, paz y salvos de administración.
        </p>
        <DocumentList propertyId={property.id} />
      </div>
    </div>
  );
}
