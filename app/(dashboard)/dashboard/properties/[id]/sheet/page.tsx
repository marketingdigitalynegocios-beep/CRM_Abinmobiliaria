import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  getPropertyForTenant,
  getTenantForTenant,
  listPropertyImages,
} from "@/lib/db/tenant-scope";
import { buildImageUrl } from "@/lib/images/delivery-url";
import { PrintButton } from "@/components/properties/PrintButton";

export const metadata: Metadata = { title: "Ficha de Propiedad" };

const typeLabels: Record<string, string> = {
  apartment: "Apartamento",
  house: "Casa",
  commercial: "Comercial / Oficina",
  land: "Lote / Terreno",
};

const operationLabels: Record<string, string> = {
  sale: "Venta",
  rent: "Arriendo",
  sale_rent: "Venta / Arriendo",
};

export default async function PropertySheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const { id } = await params;
  const db = getDb(env.DB);

  const [property, tenant] = await Promise.all([
    getPropertyForTenant(db, session.tenantId, id),
    getTenantForTenant(db, session.tenantId),
  ]);
  if (!property) notFound();

  const images = await listPropertyImages(db, property.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6 print:max-w-full">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-gray">
          Ficha lista para imprimir o guardar como PDF desde el diálogo de impresión del navegador.
        </p>
        <PrintButton />
      </div>

      <div className="rounded-lg border border-border bg-white p-8 print:border-0 print:p-0 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-xl font-bold text-dark">{tenant?.name ?? "Inmobiliaria"}</h1>
            {tenant?.phone && <p className="text-xs text-gray">{tenant.phone}</p>}
            {tenant?.email && <p className="text-xs text-gray">{tenant.email}</p>}
          </div>
          <p className="text-xs text-gray">
            Ficha generada el {new Date().toLocaleDateString("es-CO")}
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-dark">{property.title}</h2>
          <p className="text-sm text-gray mt-1">
            {typeLabels[property.type] ?? property.type} ·{" "}
            {operationLabels[property.operation] ?? property.operation}
            {property.city ? ` · ${property.city}` : ""}
            {property.neighborhood ? `, ${property.neighborhood}` : ""}
          </p>
          <p className="text-2xl font-bold text-primary font-mono mt-2">
            ${Math.round(property.priceCents / 100).toLocaleString("es-CO")} {property.currency}
          </p>
        </div>

        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {images.slice(0, 4).map((img) => {
              const url = buildImageUrl(img.imageId);
              return url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img.id}
                  src={url}
                  alt={img.altText ?? property.title}
                  className="h-40 w-full rounded object-cover"
                />
              ) : null;
            })}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-y border-border py-4 text-sm">
          <div>
            <p className="text-gray text-xs uppercase">Área</p>
            <p className="font-semibold text-dark">{property.areaM2 ?? "—"} m²</p>
          </div>
          <div>
            <p className="text-gray text-xs uppercase">Habitaciones</p>
            <p className="font-semibold text-dark">{property.bedrooms ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray text-xs uppercase">Baños</p>
            <p className="font-semibold text-dark">{property.bathrooms ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray text-xs uppercase">Parqueaderos</p>
            <p className="font-semibold text-dark">{property.parkingSpots}</p>
          </div>
        </div>

        {property.description && (
          <div>
            <h3 className="text-sm font-bold text-dark mb-1">Descripción</h3>
            <p className="text-sm text-gray whitespace-pre-wrap">{property.description}</p>
          </div>
        )}

        {property.address && (
          <div>
            <h3 className="text-sm font-bold text-dark mb-1">Dirección</h3>
            <p className="text-sm text-gray">{property.address}</p>
          </div>
        )}

        <p className="text-[10px] text-gray border-t border-border pt-3">
          Código interno: {property.internalCode ?? property.id}
        </p>
      </div>
    </div>
  );
}
