import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listDealsWithContextForTenant } from "@/lib/db/tenant-scope";
import { KanbanBoard } from "@/components/crm/KanbanBoard";

export const metadata: Metadata = {
  title: "Pipeline de Oportunidades | InmoElite",
};

export default async function CrmKanbanPage() {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const db = getDb(env.DB);
  const deals = await listDealsWithContextForTenant(db, session.tenantId);

  // Compute metrics
  const activeDeals = deals.filter(
    (d) => d.stage !== "closed_lost"
  );
  const totalVolumeCents = activeDeals.reduce(
    (acc, d) => acc + (d.dealValueCents || 0),
    0
  );
  const totalVolumeCOP = Math.round(totalVolumeCents / 100);
  const projectedCommissionCOP = Math.round(totalVolumeCOP * 0.03); // 3% average commission in Colombia
  const closedWonCount = deals.filter((d) => d.stage === "closed_won").length;

  return (
    <div className="space-y-6">
      {/* Header & Page Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-dark">
              Pipeline Comercial de Inmuebles
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {activeDeals.length} activas
            </span>
          </div>
          <p className="mt-1 text-sm text-gray">
            Negociación activa, seguimiento de leads y embudo de conversión inmobiliaria.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/crm/contacts"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-dark shadow-xs hover:bg-slate-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-gray">
              contacts
            </span>
            <span>Ver Contactos</span>
          </Link>
          <Link
            href="/dashboard/crm/contacts"
            title="Elige un contacto para abrirle una oportunidad"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">
              add_circle
            </span>
            <span>+ Nueva Oportunidad</span>
          </Link>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-xl border border-border bg-white p-4 shadow-xs">
        {/* Metric 1: Pipeline Value */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-[22px]">
              account_balance_wallet
            </span>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray">
              Valor Total Pipeline
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-dark font-mono">
                ${totalVolumeCOP.toLocaleString("es-CO")}
              </span>
              <span className="text-xs text-gray font-medium">COP</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Projected Commission */}
        <div className="flex items-center gap-3 sm:border-l sm:border-border sm:pl-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <span className="material-symbols-outlined text-[22px]">
              monetization_on
            </span>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray">
              Comisión Proyectada (3% prom.)
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-dark font-mono">
                ${projectedCommissionCOP.toLocaleString("es-CO")}
              </span>
              <span className="text-xs text-gray font-medium">COP</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Closed Deals */}
        <div className="flex items-center gap-3 sm:border-l sm:border-border sm:pl-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <span className="material-symbols-outlined text-[22px]">
              verified
            </span>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray">
              Cierres Exitosos
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-dark">
                {closedWonCount}
              </span>
              <span className="inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                Ganados
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board with Drag & Drop */}
      <div className="rounded-xl border border-border bg-white p-4 shadow-xs">
        <div className="mb-4 flex items-center justify-between text-xs text-gray">
          <span className="flex items-center gap-1 font-medium">
            <span className="material-symbols-outlined text-[16px] text-primary">
              drag_indicator
            </span>
            Arrastra una tarjeta entre columnas para actualizar la etapa de la negociación en tiempo real.
          </span>
          <span className="hidden sm:inline-block text-[11px] text-gray">
            Desplaza horizontalmente para ver todas las etapas →
          </span>
        </div>
        <KanbanBoard deals={deals} />
      </div>
    </div>
  );
}
