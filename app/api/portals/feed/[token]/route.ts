import { env } from "cloudflare:workers";
import { getDb } from "@/lib/db/client";
import {
  getTenantByPortalFeedToken,
  listPropertiesForTenant,
  listPropertyImages,
} from "@/lib/db/tenant-scope";
import { buildImageUrl } from "@/lib/images/delivery-url";

const typeLabels: Record<string, string> = {
  apartment: "Apartamento",
  house: "Casa",
  commercial: "Comercial",
  land: "Lote",
};

const operationLabels: Record<string, string> = {
  sale: "Venta",
  rent: "Arriendo",
  sale_rent: "Venta/Arriendo",
};

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Feed XML genérico de propiedades para portales externos (Fincaraíz,
 * Metrocuadrado, Properati — Fase 12, ver plan-implementacion.md §1-bis).
 * Investigación previa (ver bitácora): Fincaraíz y Metrocuadrado exigen
 * credenciales de integrador propias (API key / usuario-contraseña) que el
 * usuario debe solicitar directamente a cada portal — no hay forma de
 * autenticarse en nombre suyo sin esas credenciales. Este feed es la pieza
 * que SÍ se puede construir y verificar sin ellas: un XML con el inventario
 * real y publicado del tenant, en un formato genérico común a varios
 * portales latinoamericanos, listo para registrar la URL en el panel de
 * integrador de cualquiera de ellos una vez el usuario tenga acceso.
 *
 * Público (sin sesión) a propósito — lo consume el crawler del portal, no un
 * usuario logueado — protegido por el token impredecible en la URL.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb(env.DB);

  const tenant = await getTenantByPortalFeedToken(db, token);
  if (!tenant) return new Response("Not found", { status: 404 });

  const { properties } = await listPropertiesForTenant(db, tenant.id, {
    status: "active",
    visibility: "published",
    limit: 500,
  });

  const items = await Promise.all(
    properties.map(async (p) => {
      const images = await listPropertyImages(db, p.id);
      const imageUrls = images
        .map((img) => buildImageUrl(img.imageId))
        .filter((url): url is string => Boolean(url));

      return `
  <property>
    <id>${xmlEscape(p.internalCode ?? p.id)}</id>
    <title>${xmlEscape(p.title)}</title>
    <type>${xmlEscape(typeLabels[p.type] ?? p.type)}</type>
    <operation>${xmlEscape(operationLabels[p.operation] ?? p.operation)}</operation>
    <price currency="${xmlEscape(p.currency)}">${Math.round(p.priceCents / 100)}</price>
    <area_m2>${p.areaM2 ?? ""}</area_m2>
    <bedrooms>${p.bedrooms ?? ""}</bedrooms>
    <bathrooms>${p.bathrooms ?? ""}</bathrooms>
    <parking_spots>${p.parkingSpots}</parking_spots>
    <city>${xmlEscape(p.city ?? "")}</city>
    <neighborhood>${xmlEscape(p.neighborhood ?? "")}</neighborhood>
    <address>${xmlEscape(p.address ?? "")}</address>
    <latitude>${p.latitude ?? ""}</latitude>
    <longitude>${p.longitude ?? ""}</longitude>
    <description>${xmlEscape(p.description ?? "")}</description>
    <images>${imageUrls.map((url) => `<image>${xmlEscape(url)}</image>`).join("")}</images>
    <url>${xmlEscape(`${env.NEXT_PUBLIC_APP_URL}/${tenant.slug}/property/${p.id}`)}</url>
  </property>`;
    })
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<listings agency="${xmlEscape(tenant.name)}" generated_at="${new Date().toISOString()}">${items.join("")}
</listings>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
