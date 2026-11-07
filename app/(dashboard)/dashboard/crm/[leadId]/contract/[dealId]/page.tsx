import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  getDealForTenant,
  getLeadForTenant,
  getPropertyForTenant,
  getPropertyOwnerForTenant,
  getTenantForTenant,
} from "@/lib/db/tenant-scope";
import { PrintButton } from "@/components/properties/PrintButton";

export const metadata: Metadata = { title: "Borrador de Contrato" };

const operationLabels: Record<string, string> = {
  sale: "compraventa",
  rent: "arrendamiento",
  sale_rent: "compraventa o arrendamiento",
};

export default async function ContractDraftPage({
  params,
}: {
  params: Promise<{ leadId: string; dealId: string }>;
}) {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const { leadId, dealId } = await params;
  const db = getDb(env.DB);

  const [lead, deal, tenant] = await Promise.all([
    getLeadForTenant(db, session.tenantId, leadId),
    getDealForTenant(db, session.tenantId, dealId),
    getTenantForTenant(db, session.tenantId),
  ]);
  if (!lead || !deal || deal.leadId !== lead.id) notFound();

  const property = await getPropertyForTenant(db, session.tenantId, deal.propertyId);
  if (!property) notFound();

  const owner = property.ownerId
    ? await getPropertyOwnerForTenant(db, session.tenantId, property.ownerId)
    : null;

  const today = new Date().toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 print:max-w-full">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-gray">
          Borrador generado con datos reales de esta oportunidad — requiere revisión de un abogado
          antes de firmarse. No reemplaza asesoría legal.
        </p>
        <PrintButton />
      </div>

      <div className="rounded-lg border border-border bg-white p-10 print:border-0 print:p-0 space-y-5 text-sm leading-relaxed text-dark">
        <div className="text-center print:block hidden text-[10px] uppercase tracking-wide text-gray">
          Documento interno — requiere revisión legal antes de firmarse
        </div>

        <h1 className="text-center text-lg font-bold uppercase">
          Borrador de contrato de {operationLabels[property.operation] ?? property.operation}
        </h1>

        <p>
          Entre los suscritos, por una parte <strong>{tenant?.name ?? "la inmobiliaria"}</strong>
          {owner ? (
            <>
              {" "}
              actuando en representación de <strong>{owner.fullName}</strong>
              {owner.documentId ? ` (identificado con documento ${owner.documentId})` : ""}, en
              calidad de propietario
            </>
          ) : (
            " en calidad de intermediario"
          )}
          , quien en adelante se denominará "EL VENDEDOR/ARRENDADOR", y por otra parte{" "}
          <strong>{lead.fullName}</strong>
          {lead.email ? ` (${lead.email})` : ""}
          {lead.phone ? `, teléfono de contacto ${lead.phone}` : ""}, quien en adelante se
          denominará "EL COMPRADOR/ARRENDATARIO", se celebra el presente contrato el día {today},
          sujeto a las siguientes cláusulas:
        </p>

        <div>
          <h2 className="font-bold">PRIMERA — Objeto</h2>
          <p>
            El presente contrato tiene por objeto el inmueble denominado{" "}
            <strong>{property.title}</strong>, ubicado en{" "}
            {property.address ?? "dirección a confirmar"}
            {property.city ? `, ${property.city}` : ""}
            {property.neighborhood ? `, ${property.neighborhood}` : ""}, con un área aproximada de{" "}
            {property.areaM2 ?? "—"} m².
          </p>
        </div>

        <div>
          <h2 className="font-bold">SEGUNDA — Valor</h2>
          <p>
            El valor acordado para esta operación es de{" "}
            <strong>
              ${Math.round((deal.dealValueCents ?? property.priceCents) / 100).toLocaleString("es-CO")}{" "}
              {property.currency}
            </strong>
            .
          </p>
        </div>

        <div>
          <h2 className="font-bold">TERCERA — Comisión</h2>
          <p>
            {property.commissionPercentage
              ? `La comisión de intermediación pactada es del ${property.commissionPercentage}% sobre el valor de la operación.`
              : "No se ha definido un porcentaje de comisión para esta propiedad."}
          </p>
        </div>

        <div className="pt-10 grid grid-cols-2 gap-10 text-center">
          <div className="border-t border-dark pt-2">
            <p className="font-semibold">EL VENDEDOR/ARRENDADOR</p>
          </div>
          <div className="border-t border-dark pt-2">
            <p className="font-semibold">EL COMPRADOR/ARRENDATARIO</p>
          </div>
        </div>
      </div>
    </div>
  );
}
