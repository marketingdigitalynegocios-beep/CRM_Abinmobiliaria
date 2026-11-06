import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getLeadsForTenant } from "@/lib/db/tenant-scope";
import { LeadsTable } from "@/components/crm/LeadsTable";
import { NewContactForm } from "@/components/crm/NewContactForm";

export default async function ContactsPage() {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const db = getDb(env.DB);
  const leads = await getLeadsForTenant(db, session.tenantId);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-dark">Contactos</h1>
        <a className="text-sm font-medium text-primary" href="/dashboard/crm">
          Ver pipeline
        </a>
      </div>

      <div className="mt-4">
        <NewContactForm />
      </div>

      <div className="mt-6">
        <LeadsTable leads={leads} />
      </div>
    </div>
  );
}
