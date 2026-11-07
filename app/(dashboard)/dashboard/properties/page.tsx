import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listPropertiesForTenant } from "@/lib/db/tenant-scope";
import { PropertiesTable } from "@/components/properties/PropertiesTable";

export const metadata: Metadata = { title: "Propiedades" };

export default async function PropertiesPage() {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const db = getDb(env.DB);
  const { properties } = await listPropertiesForTenant(db, session.tenantId, { limit: 100 });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-dark">Propiedades</h1>
        <a
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light"
          href="/dashboard/properties/new"
        >
          Nueva propiedad
        </a>
      </div>

      <div className="mt-6">
        <PropertiesTable properties={properties} />
      </div>
    </div>
  );
}
