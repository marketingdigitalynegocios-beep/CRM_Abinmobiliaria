import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  getLeadsForTenant,
  listDealsWithContextForTenant,
  listPropertiesForTenant,
  listVisitsWithContextForTenant,
} from "@/lib/db/tenant-scope";
import { TaskList } from "@/components/dashboard/TaskList";

export const metadata: Metadata = { title: "Resumen General" };

const DEAL_STAGES = [
  { key: "new", label: "Nuevos Leads", color: "bg-sky-400", border: "border-sky-400" },
  { key: "qualified", label: "Calificados", color: "bg-blue-500", border: "border-blue-500" },
  { key: "proposal_sent", label: "Propuestas", color: "bg-primary", border: "border-primary" },
  { key: "negotiation", label: "Negociación", color: "bg-indigo-500", border: "border-indigo-500" },
  { key: "closed_won", label: "Cerrados", color: "bg-emerald-500", border: "border-emerald-500" },
] as const;

function formatCOP(cents: number) {
  const value = Math.round(cents / 100);
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  return `$${value.toLocaleString("es-CO")}`;
}

export default async function DashboardHomePage() {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const userName = session.user.name.split(" ")[0] || session.user.name;

  const db = getDb(env.DB);
  const [leads, deals, { properties }, visits] = await Promise.all([
    getLeadsForTenant(db, session.tenantId),
    listDealsWithContextForTenant(db, session.tenantId),
    listPropertiesForTenant(db, session.tenantId, { limit: 500 }),
    listVisitsWithContextForTenant(db, session.tenantId),
  ]);

  const activeProperties = properties.filter((p) => p.status === "active").length;

  const now = Date.now();
  const upcomingVisits = visits
    .filter((v) => v.status === "scheduled" && new Date(v.scheduledAt).getTime() >= now)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const visitsToday = upcomingVisits.filter((v) => {
    const d = new Date(v.scheduledAt);
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  });

  const activeDeals = deals.filter((d) => d.stage !== "closed_lost");
  const totalPipelineCents = activeDeals.reduce((acc, d) => acc + (d.dealValueCents || 0), 0);
  const closedWonCents = deals
    .filter((d) => d.stage === "closed_won")
    .reduce((acc, d) => acc + (d.dealValueCents || 0), 0);

  const stageBreakdown = DEAL_STAGES.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage.key);
    return {
      ...stage,
      count: stageDeals.length,
      valueCents: stageDeals.reduce((acc, d) => acc + (d.dealValueCents || 0), 0),
    };
  });
  const totalStageCount = stageBreakdown.reduce((acc, s) => acc + s.count, 0) || 1;

  const newLeadsThisWeek = leads.filter((l) => {
    const created = new Date(l.createdAt).getTime();
    return now - created <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const recentLeads = leads.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* 1. Header Greeting */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-lg border border-border shadow-xs">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-dark">
            Buenos días, {userName} 👋
          </h1>
          <p className="text-xs md:text-sm text-gray mt-1">
            {visitsToday.length > 0 ? (
              <>
                Tienes <span className="font-semibold text-primary">{visitsToday.length} visita{visitsToday.length === 1 ? "" : "s"} hoy</span>
                {newLeadsThisWeek > 0 && ` y ${newLeadsThisWeek} nuevo${newLeadsThisWeek === 1 ? "" : "s"} lead${newLeadsThisWeek === 1 ? "" : "s"} esta semana.`}
              </>
            ) : newLeadsThisWeek > 0 ? (
              <>Tienes <span className="font-semibold text-primary">{newLeadsThisWeek} nuevo{newLeadsThisWeek === 1 ? "" : "s"} lead{newLeadsThisWeek === 1 ? "" : "s"}</span> esta semana.</>
            ) : (
              "No tienes visitas agendadas para hoy."
            )}
          </p>
        </div>
      </section>

      {/* 2. KPI Metric Cards Grid — valores reales del tenant */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-gray uppercase tracking-wider">
              Propiedades Activas
            </span>
            <span className="material-symbols-outlined text-primary text-[18px]">apartment</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-dark font-mono">{activeProperties}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-gray">
            <span>Total en cartera</span>
            <span className="font-semibold text-dark">{properties.length}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-gray uppercase tracking-wider">
              Leads
            </span>
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">trending_up</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-dark font-mono">{leads.length}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-gray">
            <span>Nuevos esta semana</span>
            <span className="font-semibold text-dark">{newLeadsThisWeek}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-gray uppercase tracking-wider">
              Pipeline Comercial
            </span>
            <span className="material-symbols-outlined text-primary text-[18px]">monetization_on</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl md:text-2xl font-bold text-dark font-mono tracking-tight">
              {formatCOP(totalPipelineCents)}
            </span>
            <span className="text-[10px] font-bold text-gray">COP</span>
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-gray">
            <span>Negocios activos</span>
            <span className="font-semibold text-dark">{activeDeals.length}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-gray uppercase tracking-wider">
              Visitas Próximas
            </span>
            <span className="material-symbols-outlined text-amber-500 text-[18px]">calendar_today</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-dark font-mono">{upcomingVisits.length}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-gray">
            <span>Hoy</span>
            <span className="font-semibold text-dark">{visitsToday.length}</span>
          </div>
        </div>
      </section>

      {/* 3. Pipeline por etapa */}
      <section className="bg-white p-5 rounded-lg border border-border shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-border/60 pb-3">
          <div>
            <h2 className="text-base md:text-lg font-bold text-dark">Pipeline Comercial</h2>
            <p className="text-xs text-gray mt-0.5">
              {deals.length} oportunidades totales · {formatCOP(closedWonCents)} COP cerrados
            </p>
          </div>
          <Link
            href="/dashboard/crm"
            className="text-xs font-semibold text-primary hover:underline self-start md:self-auto"
          >
            Ver Kanban completo →
          </Link>
        </div>

        {deals.length === 0 ? (
          <p className="text-sm text-gray py-4">Aún no hay oportunidades registradas.</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <div className="w-full h-3 rounded-full bg-light-gray overflow-hidden flex shadow-inner">
                {stageBreakdown.map((stage) => (
                  <div
                    key={stage.key}
                    className={`h-full ${stage.color} transition-all`}
                    style={{ width: `${(stage.count / totalStageCount) * 100}%` }}
                    title={`${stage.label}: ${stage.count}`}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
              {stageBreakdown.map((stage) => (
                <div
                  key={stage.key}
                  className={`p-3 rounded-md bg-light-gray/50 border-l-4 ${stage.border} border-t border-r border-b border-border/50`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-dark">{stage.label}</span>
                    <span className="font-bold text-gray">{stage.count}</span>
                  </div>
                  <p className="text-sm font-bold text-dark font-mono mt-1">
                    {formatCOP(stage.valueCents)} COP
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* 4. Two-Column Split: Próximas Visitas & Leads Recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-white p-5 rounded-lg border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">event_available</span>
              <h3 className="text-base font-bold text-dark">Próximas Visitas a Inmuebles</h3>
            </div>
            <Link href="/dashboard/crm" className="text-xs font-semibold text-primary hover:underline">
              Ver agenda →
            </Link>
          </div>

          {upcomingVisits.length === 0 ? (
            <p className="text-sm text-gray py-4">No hay visitas agendadas próximamente.</p>
          ) : (
            <div className="space-y-3">
              {upcomingVisits.slice(0, 4).map((visit) => (
                <div
                  key={visit.id}
                  className="p-3.5 rounded-lg border border-border hover:border-primary/50 transition-all bg-white"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold text-xs font-mono">
                      {new Date(visit.scheduledAt).toLocaleString("es-CO", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-dark">{visit.propertyTitle}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray pt-2 mt-2 border-t border-border/40">
                    <p>Cliente: <strong className="text-dark font-medium">{visit.leadName}</strong></p>
                    <p>Asesor: <strong className="text-dark font-medium">{visit.advisorName ?? "Sin asignar"}</strong></p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-5 bg-white p-5 rounded-lg border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">person_add</span>
              <h3 className="text-base font-bold text-dark">Leads Recientes</h3>
            </div>
            <Link href="/dashboard/crm/contacts" className="text-xs font-semibold text-primary hover:underline">
              Ver todos →
            </Link>
          </div>

          {recentLeads.length === 0 ? (
            <p className="text-sm text-gray py-4">Aún no hay leads registrados.</p>
          ) : (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="p-3 rounded-lg border border-border bg-light-gray/20 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-dark">{lead.fullName}</span>
                    <span className="text-[11px] font-bold text-gray bg-light-gray px-1.5 py-0.5 rounded border border-border capitalize">
                      {lead.stage}
                    </span>
                  </div>
                  {lead.notes && (
                    <p className="text-xs text-gray leading-relaxed line-clamp-2">{lead.notes}</p>
                  )}
                  <div className="flex items-center justify-between pt-1 text-[11px] text-gray border-t border-border/30">
                    <span>{new Date(lead.createdAt).toLocaleDateString("es-CO")}</span>
                    <Link href="/dashboard/crm/contacts" className="text-primary font-semibold hover:underline">
                      Ver lead →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="bg-white p-5 rounded-lg border border-border shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border/60">
          <span className="material-symbols-outlined text-primary text-[20px]">checklist</span>
          <h3 className="text-base font-bold text-dark">Tareas Pendientes</h3>
        </div>
        <TaskList emptyLabel="No tienes tareas pendientes." />
      </section>
    </div>
  );
}
