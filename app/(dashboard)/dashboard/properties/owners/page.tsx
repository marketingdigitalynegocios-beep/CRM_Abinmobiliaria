import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listPropertyOwnersForTenant } from "@/lib/db/tenant-scope";
import { PropertyOwnersTable } from "@/components/properties/PropertyOwnersTable";

export default async function PropertyOwnersPage() {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const db = getDb(env.DB);
  const owners = await listPropertyOwnersForTenant(db, session.tenantId);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-dark">Propietarios</h1>
        <a
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light"
          href="/dashboard/properties/owners/new"
        >
          Nuevo propietario
        </a>
      </div>

      <div className="mt-6">
        <PropertyOwnersTable owners={owners} />
      </div>
    </div>
  );
}
