import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listDealsWithContextForTenant } from "@/lib/db/tenant-scope";
import { KanbanBoard } from "@/components/crm/KanbanBoard";

export default async function CrmKanbanPage() {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const db = getDb(env.DB);
  const deals = await listDealsWithContextForTenant(db, session.tenantId);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-dark">Oportunidades</h1>
        <a className="text-sm font-medium text-primary" href="/dashboard/crm/contacts">
          Ver contactos
        </a>
      </div>
      <p className="mt-1 text-sm text-gray">
        Arrastra una tarjeta para mover la oportunidad de etapa.
      </p>

      <div className="mt-6">
        <KanbanBoard deals={deals} />
      </div>
    </div>
  );
}
