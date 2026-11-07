import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import {
  getPublishedPropertyForTenant,
  getTenantBySlug,
  listPropertyImages,
} from "@/lib/db/tenant-scope";
import { buildImageUrl } from "@/lib/images/delivery-url";
import { AgencyHeader } from "@/components/public/AgencyHeader";
import { ContactForm } from "@/components/public/ContactForm";
import { PropertyGallery } from "@/components/public/PropertyGallery";
import { PropertyMap } from "@/components/public/PropertyMap";
import { WhatsAppButton } from "@/components/public/WhatsAppButton";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

const typeLabels: Record<string, string> = {
  apartment: "Apartamento",
  house: "Casa",
  commercial: "Local comercial",
  land: "Lote",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, id } = await params;
  const db = getDb(env.DB);
  const tenant = await getTenantBySlug(db, slug);
  if (!tenant) return {};
  const property = await getPublishedPropertyForTenant(db, tenant.id, id);
  if (!property) return {};

  let imageUrl = buildImageUrl(property.coverImageId, "public");
  if (!imageUrl) {
    const images = await listPropertyImages(db, property.id);
    if (images.length > 0) {
      imageUrl = buildImageUrl(images[0].imageId, "public") || images[0].imageId;
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const absoluteImageUrl = imageUrl
    ? imageUrl.startsWith("http://") || imageUrl.startsWith("https://")
      ? imageUrl
      : `${baseUrl}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`
    : undefined;

  const formattedPrice = `$${(property.priceCents / 100).toLocaleString("es-CO")} ${property.currency || "COP"}`;
  const operationText = property.operation === "sale" ? "Venta" : "Arriendo";
  const typeText = typeLabels[property.type] ?? property.type;
  const locationText = [property.neighborhood, property.city].filter(Boolean).join(", ");
  const featuresText = [
    `${typeText} en ${operationText}`,
    formattedPrice,
    locationText || null,
    property.areaM2 ? `${property.areaM2} m²` : null,
    property.bedrooms ? `${property.bedrooms} hab` : null,
    property.bathrooms ? `${property.bathrooms} baños` : null,
  ].filter(Boolean).join(" · ");

  const metaDescription = property.description
    ? `${featuresText}. ${property.description.slice(0, 160)}`
    : featuresText;

  const pageUrl = `${baseUrl}/${slug}/property/${property.id}`;
  const metaTitle = `${property.title} · ${formattedPrice}`;

  return {
    title: { absolute: `${metaTitle} — ${tenant.name}` },
    description: metaDescription,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      url: pageUrl,
      siteName: tenant.name,
      locale: "es_CO",
      type: "article",
      images: absoluteImageUrl
        ? [
            {
              url: absoluteImageUrl,
              width: 1200,
              height: 630,
              alt: property.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description: metaDescription,
      images: absoluteImageUrl ? [absoluteImageUrl] : undefined,
    },
    other: {
      "og:price:amount": String(property.priceCents / 100),
      "og:price:currency": property.currency || "COP",
    },
  };
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { slug, id } = await params;
  const db = getDb(env.DB);

  const tenant = await getTenantBySlug(db, slug);
  if (!tenant) notFound();

  const property = await getPublishedPropertyForTenant(db, tenant.id, id);
  if (!property) notFound();

  const images = await listPropertyImages(db, property.id);
  const galleryImages = [
    ...(property.coverImageId
      ? [{ id: property.coverImageId, url: buildImageUrl(property.coverImageId, "public") ?? "" }]
      : []),
    ...images.map((img) => ({ id: img.imageId, url: buildImageUrl(img.imageId, "public") ?? "" })),
  ];

  const whatsappMessage = `Hola, estoy interesado/a en "${property.title}" que vi en su página.`;

  return (
    <div className={`min-h-screen ${tenant.template === "minimal" ? "bg-white" : "bg-light-gray"}`}>
      <AgencyHeader tenant={tenant} />

      <main className="mx-auto max-w-4xl px-6 py-8">
        <a className="text-sm text-primary" href={`/${slug}`}>
          ← Volver al catálogo
        </a>

        <h1 className="mt-3 font-display text-3xl font-semibold text-dark">{property.title}</h1>
        <p className="mt-1 text-sm text-gray">
          {typeLabels[property.type] ?? property.type}
          {property.city ? ` · ${property.city}` : ""}
          {property.neighborhood ? ` · ${property.neighborhood}` : ""}
        </p>
        <p className="mt-2 text-2xl font-semibold text-dark">
          ${(property.priceCents / 100).toLocaleString("es-CO")} {property.currency}
        </p>

        <div className="mt-6">
          <PropertyGallery images={galleryImages} />
        </div>

        <div className="mt-6 flex gap-6 text-sm text-gray">
          {property.bedrooms != null && <span>{property.bedrooms} habitaciones</span>}
          {property.bathrooms != null && <span>{property.bathrooms} baños</span>}
          {property.areaM2 != null && <span>{property.areaM2} m²</span>}
          {property.parkingSpots > 0 && <span>{property.parkingSpots} parqueaderos</span>}
        </div>

        {property.description && (
          <p className="mt-6 whitespace-pre-line text-sm leading-6 text-dark">
            {property.description}
          </p>
        )}

        {property.latitude != null && property.longitude != null && (
          <div className="mt-8">
            <h2 className="mb-2 font-display text-lg font-semibold text-dark">Ubicación</h2>
            <PropertyMap latitude={property.latitude} longitude={property.longitude} />
          </div>
        )}

        <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start">
          <WhatsAppButton message={whatsappMessage} whatsappNumber={tenant.whatsappNumber} />
          <div className="w-full sm:max-w-sm">
            <ContactForm propertyId={property.id} tenantSlug={slug} />
          </div>
        </div>
      </main>
    </div>
  );
}
