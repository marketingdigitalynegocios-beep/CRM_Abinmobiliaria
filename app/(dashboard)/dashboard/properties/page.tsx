import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getTenantForTenant, listPropertiesForTenant } from "@/lib/db/tenant-scope";
import { PropertiesTable } from "@/components/properties/PropertiesTable";

export const metadata: Metadata = { title: "Inventario de Propiedades" };

export default async function PropertiesPage() {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const db = getDb(env.DB);
  const [tenant, { properties }] = await Promise.all([
    getTenantForTenant(db, session.tenantId),
    listPropertiesForTenant(db, session.tenantId, { limit: 100 }),
  ]);
  const tenantSlug = tenant?.slug || "inmoelite-prime";

  const activeCount = properties.filter((p) => p.status === "active").length;
  const soldCount = properties.filter((p) => p.status === "sold" || p.status === "rented").length;

  return (
    <div className="space-y-5">
      {/* Top Header & Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-dark">
              Inventario de Propiedades
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {properties.length} registradas
            </span>
          </div>
          <p className="text-xs text-gray mt-1">
            Gestiona la cartera de inmuebles, filtra por venta o arriendo y visibilidad en tu web pública.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/properties/owners"
            className="flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-2 text-xs font-medium text-dark hover:bg-light-gray transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-gray">vpn_key</span>
            <span>Propietarios</span>
          </Link>
          <Link
            href="/dashboard/properties/new"
            className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-white hover:bg-primary-light shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            <span>Nueva Propiedad</span>
          </Link>
        </div>
      </div>

      {/* Properties Table & Cards con Pestañas y Filtros */}
      <PropertiesTable properties={properties} tenantSlug={tenantSlug} />
    </div>
  );
}
