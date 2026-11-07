import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  getLeadForTenant,
  getMatchingPropertiesForLead,
  listDealsForTenant,
  listLeadActivitiesForTenant,
  listLeadPropertyInterests,
  listPropertiesForTenant,
  listVisitsForLead,
  listWhatsappMessagesForLead,
} from "@/lib/db/tenant-scope";
import { DealForm } from "@/components/crm/DealForm";
import { QuickDealButton } from "@/components/crm/QuickDealButton";
import { LeadOverviewHeader } from "@/components/crm/LeadOverviewHeader";
import { LeadVisitsManager } from "@/components/crm/LeadVisitsManager";
import { TaskList } from "@/components/dashboard/TaskList";
import { DocumentList } from "@/components/dashboard/DocumentList";

const stageLabels: Record<string, string> = {
  new: "Nuevo",
  meeting_scheduled: "Reunión agendada",
  qualified: "Calificado",
  proposal_sent: "Propuesta enviada",
  negotiation: "Negociación",
  closed_won: "Cerrado ganado",
  closed_lost: "Cerrado perdido",
};

const activityTypeLabels: Record<string, string> = {
  stage_change: "Cambio de etapa",
  note: "Nota",
  call: "Llamada",
  deal_created: "Oportunidad",
  visit_scheduled: "Visita",
  whatsapp_message: "WhatsApp",
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

  const [
    interests,
    dealsForLead,
    visitsForLead,
    { properties: allProperties },
    activities,
    messages,
    matches,
  ] = await Promise.all([
    listLeadPropertyInterests(db, lead.id),
    listDealsForTenant(db, session.tenantId, { leadId: lead.id }),
    listVisitsForLead(db, session.tenantId, lead.id),
    listPropertiesForTenant(db, session.tenantId, { limit: 100 }),
    listLeadActivitiesForTenant(db, session.tenantId, lead.id),
    listWhatsappMessagesForLead(db, session.tenantId, lead.id),
    getMatchingPropertiesForLead(db, session.tenantId, lead.id),
  ]);

  const visitsWithPropertyTitle = visitsForLead.map((v) => ({
    ...v,
    propertyTitle:
      allProperties.find((p) => p.id === v.propertyId)?.title ?? "Propiedad asignada",
  }));

  return (
    <div className="space-y-6">
      {/* Botones de navegación superior */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <Link
          href="/dashboard/crm/contacts"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Volver a Contactos</span>
        </Link>
        <Link
          href="/dashboard/crm"
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray hover:text-dark dark:hover:text-white transition-colors"
        >
          <span>Ver Pipeline Kanban →</span>
        </Link>
      </div>

      {/* Ficha Principal del Lead: Etapa interactiva, Notas editables, Acciones */}
      <LeadOverviewHeader lead={lead} />

      {/* Tareas */}
      <section className="rounded-xl border border-border bg-white dark:bg-slate-900 p-5 shadow-xs">
        <h2 className="font-display text-lg font-bold text-dark dark:text-white mb-2">
          Tareas de Seguimiento
        </h2>
        <TaskList leadId={lead.id} emptyLabel="Sin tareas pendientes para este lead." />
      </section>

      {/* Visitas & Citas (Citas todo revisado y funcional) */}
      <section className="rounded-xl border border-border bg-white dark:bg-slate-900 p-5 shadow-xs">
        <LeadVisitsManager
          leadId={lead.id}
          visits={visitsWithPropertyTitle as any}
          properties={allProperties.map((p) => ({ id: p.id, title: p.title }))}
          deals={dealsForLead.map((d) => ({ id: d.id, title: d.title }))}
        />
      </section>

      {/* Propiedades de Interés */}
      <section className="rounded-xl border border-border bg-white dark:bg-slate-900 p-5 shadow-xs">
        <h2 className="font-display text-lg font-bold text-dark dark:text-white mb-2">
          Propiedades de Interés
        </h2>
        {interests.length === 0 ? (
          <p className="text-xs text-gray">Sin propiedades asociadas todavía.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-xs">
            {interests.map((i) => (
              <li
                key={i.property.id}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800"
              >
                <a
                  className="font-medium text-primary hover:underline"
                  href={`/dashboard/properties/${i.property.id}/edit`}
                >
                  {i.property.title}
                </a>
                <span className="text-gray text-[11px] font-mono">
                  ${(i.property.priceCents / 100).toLocaleString("es-CO")} COP
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Propiedades Sugeridas */}
      <section className="rounded-xl border border-border bg-white dark:bg-slate-900 p-5 shadow-xs">
        <h2 className="font-display text-lg font-bold text-dark dark:text-white mb-2">
          Propiedades Sugeridas por el Sistema
        </h2>
        {matches.length === 0 ? (
          <p className="text-xs text-gray">
            Sin sugerencias — captura presupuesto, ciudad o tipo de interés en las notas del cliente y aquí aparecerán las opciones compatibles.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {matches.map((property) => (
              <div
                key={property.id}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-xs"
              >
                <div>
                  <p className="font-semibold text-dark dark:text-white">{property.title}</p>
                  <p className="text-gray text-[11px] mt-0.5">
                    {property.city ?? "—"} · ${Math.round(property.priceCents / 100).toLocaleString("es-CO")}{" "}
                    {property.currency}
                  </p>
                </div>
                <QuickDealButton leadId={lead.id} propertyId={property.id} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Oportunidades & Contratos */}
      <section className="rounded-xl border border-border bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold text-dark dark:text-white">
            Oportunidades Comerciales
          </h2>
          <DealForm leadId={lead.id} />
        </div>
        {dealsForLead.length === 0 ? (
          <p className="text-xs text-gray">Todavía no hay oportunidades abiertas para este lead.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {dealsForLead.map((deal) => (
              <div
                className="rounded-lg border border-border bg-slate-50 dark:bg-slate-800 p-3 text-xs"
                key={deal.id}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-dark dark:text-white">
                    {deal.title || deal.id}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
                    {stageLabels[deal.stage] ?? deal.stage}
                  </span>
                </div>
                {deal.dealValueCents != null && (
                  <p className="text-gray font-mono font-bold mt-1">
                    ${(deal.dealValueCents / 100).toLocaleString("es-CO")} COP
                  </p>
                )}
                <a
                  href={`/dashboard/crm/${lead.id}/contract/${deal.id}`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <span className="material-symbols-outlined text-[14px]">description</span>
                  <span>Generar borrador de contrato →</span>
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Conversación de WhatsApp */}
      <section className="rounded-xl border border-border bg-white dark:bg-slate-900 p-5 shadow-xs">
        <h2 className="font-display text-lg font-bold text-dark dark:text-white mb-2">
          Historial de WhatsApp
        </h2>
        {messages.length === 0 ? (
          <p className="text-xs text-gray">Sin mensajes registrados todavía para este lead.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[80%] rounded-lg border p-3 text-xs ${
                  msg.direction === "inbound"
                    ? "self-start border-border bg-white dark:bg-slate-800"
                    : "self-end border-primary/30 bg-primary/5 text-primary"
                }`}
              >
                <p className="text-dark dark:text-slate-100">{msg.body}</p>
                <p className="mt-1 text-[10px] text-gray">
                  {msg.direction === "inbound" ? "Cliente" : "Agente"} ·{" "}
                  {new Date(msg.createdAt).toLocaleString("es-CO")}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Historial de Actividades */}
      <section className="rounded-xl border border-border bg-white dark:bg-slate-900 p-5 shadow-xs">
        <h2 className="font-display text-lg font-bold text-dark dark:text-white mb-2">
          Línea de Tiempo &amp; Actividad
        </h2>
        {activities.length === 0 ? (
          <p className="text-xs text-gray">Sin actividad registrada todavía.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-xs">
            {activities.map((activity) => (
              <li
                className="rounded-lg border border-border bg-white dark:bg-slate-800 p-3"
                key={activity.id}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary">
                    {activityTypeLabels[activity.type] ?? activity.type}
                  </span>
                  <span className="text-[10px] text-gray">
                    {new Date(activity.createdAt).toLocaleString("es-CO")}
                  </span>
                </div>
                <p className="mt-1 text-dark dark:text-slate-200">{activity.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Documentos del Lead */}
      <section className="rounded-xl border border-border bg-white dark:bg-slate-900 p-5 shadow-xs">
        <h2 className="font-display text-lg font-bold text-dark dark:text-white mb-2">
          Documentos Adjuntos
        </h2>
        <DocumentList leadId={lead.id} />
      </section>
    </div>
  );
}
