import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  getLeadForTenant,
  listDealsForTenant,
  listLeadPropertyInterests,
  listPropertiesForTenant,
  listVisitsForLead,
} from "@/lib/db/tenant-scope";
import { DealForm } from "@/components/crm/DealForm";
import { VisitScheduler } from "@/components/crm/VisitScheduler";

const stageLabels: Record<string, string> = {
  new: "Nuevo",
  meeting_scheduled: "Reunión agendada",
  qualified: "Calificado",
  proposal_sent: "Propuesta enviada",
  negotiation: "Negociación",
  closed_won: "Cerrado ganado",
  closed_lost: "Cerrado perdido",
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const { leadId } = await params;
  const db = getDb(env.DB);

  const lead = await getLeadForTenant(db, session.tenantId, leadId);
  if (!lead) notFound();

  const [interests, dealsForLead, visitsForLead, { properties: allProperties }] = await Promise.all([
    listLeadPropertyInterests(db, lead.id),
    listDealsForTenant(db, session.tenantId, { leadId: lead.id }),
    listVisitsForLead(db, session.tenantId, lead.id),
    listPropertiesForTenant(db, session.tenantId, { limit: 100 }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-dark">{lead.fullName}</h1>
      <p className="mt-1 text-sm text-gray">
        {lead.email ?? "—"} · {lead.phone ?? "—"} · origen: {lead.source}
      </p>

      {lead.notes && <p className="mt-3 text-sm text-dark">{lead.notes}</p>}

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-dark">Propiedades de interés</h2>
        {interests.length === 0 ? (
          <p className="mt-2 text-sm text-gray">Sin propiedades asociadas todavía.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {interests.map((i) => (
              <li key={i.property.id}>
                <a className="text-primary" href={`/dashboard/properties/${i.property.id}/edit`}>
                  {i.property.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-dark">Oportunidades</h2>
          <DealForm leadId={lead.id} />
        </div>
        {dealsForLead.length === 0 ? (
          <p className="mt-2 text-sm text-gray">Todavía no hay oportunidades abiertas para este lead.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {dealsForLead.map((deal) => (
              <div className="rounded-md border border-border bg-white p-3 text-sm" key={deal.id}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-dark">{deal.title || deal.id}</span>
                  <span className="text-xs text-primary">{stageLabels[deal.stage] ?? deal.stage}</span>
                </div>
                {deal.dealValueCents != null && (
                  <p className="text-gray">${(deal.dealValueCents / 100).toLocaleString("es-CO")}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-dark">Visitas</h2>
          <VisitScheduler
            deals={dealsForLead.map((d) => ({ id: d.id, title: d.title }))}
            leadId={lead.id}
            properties={allProperties.map((p) => ({ id: p.id, title: p.title }))}
          />
        </div>
        {visitsForLead.length === 0 ? (
          <p className="mt-2 text-sm text-gray">Sin visitas agendadas.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {visitsForLead.map((visit) => (
              <li className="rounded-md border border-border bg-white p-3" key={visit.id}>
                {new Date(visit.scheduledAt).toLocaleString("es-CO")} — {visit.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
