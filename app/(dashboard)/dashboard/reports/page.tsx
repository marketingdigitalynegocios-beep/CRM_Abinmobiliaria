import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  getAdvisorRankingForTenant,
  getAverageClosingDaysForTenant,
  getCommissionsReportForTenant,
  getConversionBySourceForTenant,
} from "@/lib/db/tenant-scope";
import { CsvExportButton } from "@/components/dashboard/CsvExportButton";

export const metadata: Metadata = { title: "Reportes" };

const sourceLabels: Record<string, string> = {
  website: "Página web",
  whatsapp: "WhatsApp",
  referral: "Referido",
  manual: "Manual",
};

function formatCOP(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString("es-CO")}`;
}

export default async function ReportsPage() {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const db = getDb(env.DB);
  const [commissions, conversion, avgClosingDays, ranking] = await Promise.all([
    getCommissionsReportForTenant(db, session.tenantId),
    getConversionBySourceForTenant(db, session.tenantId),
    getAverageClosingDaysForTenant(db, session.tenantId),
    getAdvisorRankingForTenant(db, session.tenantId),
  ]);

  const commissionRows = commissions.byAdvisor.map((a) => ({
    Asesor: a.advisorName ?? "Sin asesor asignado",
    "Oportunidades cerradas": a.dealCount,
    "Comisión (COP)": Math.round(a.commissionCents / 100),
  }));

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-dark">Reportes</h1>
        <p className="mt-1 text-sm text-gray">
          Comisiones, conversión por canal y velocidad de cierre, calculados sobre tus datos reales.
        </p>
      </div>

      {/* Comisiones por asesor */}
      <section className="bg-white rounded-lg border border-border shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-dark">Comisiones por Asesor</h2>
            <p className="text-xs text-gray mt-0.5">
              Total de comisión sobre oportunidades cerradas:{" "}
              <strong className="text-dark">{formatCOP(commissions.totalCommissionCents)} COP</strong>
            </p>
          </div>
          <CsvExportButton rows={commissionRows} filename="comisiones.csv" />
        </div>

        {commissions.byAdvisor.length === 0 ? (
          <p className="text-sm text-gray py-4">
            Aún no hay oportunidades cerradas para calcular comisiones.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-gray border-b border-border">
                <th className="pb-2 font-semibold">Asesor</th>
                <th className="pb-2 font-semibold text-right">Cerradas</th>
                <th className="pb-2 font-semibold text-right">Comisión</th>
              </tr>
            </thead>
            <tbody>
              {commissions.byAdvisor.map((a) => (
                <tr key={a.advisorId ?? "sin-asesor"} className="border-b border-border/50">
                  <td className="py-2 text-dark">{a.advisorName ?? "Sin asesor asignado"}</td>
                  <td className="py-2 text-right text-dark">{a.dealCount}</td>
                  <td className="py-2 text-right font-mono font-semibold text-dark">
                    {formatCOP(a.commissionCents)} COP
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversión por canal */}
        <section className="bg-white rounded-lg border border-border shadow-xs p-5 space-y-4">
          <h2 className="text-base font-bold text-dark">Conversión por Canal de Origen</h2>
          {conversion.length === 0 ? (
            <p className="text-sm text-gray">Aún no hay leads registrados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray border-b border-border">
                  <th className="pb-2 font-semibold">Canal</th>
                  <th className="pb-2 font-semibold text-right">Leads</th>
                  <th className="pb-2 font-semibold text-right">Ganados</th>
                  <th className="pb-2 font-semibold text-right">Conversión</th>
                </tr>
              </thead>
              <tbody>
                {conversion.map((c) => (
                  <tr key={c.source} className="border-b border-border/50">
                    <td className="py-2 text-dark">{sourceLabels[c.source] ?? c.source}</td>
                    <td className="py-2 text-right text-dark">{c.total}</td>
                    <td className="py-2 text-right text-dark">{c.won}</td>
                    <td className="py-2 text-right font-semibold text-primary">{c.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Velocidad de cierre + ranking de asesores */}
        <section className="bg-white rounded-lg border border-border shadow-xs p-5 space-y-4">
          <h2 className="text-base font-bold text-dark">Velocidad de Cierre</h2>
          {avgClosingDays === null ? (
            <p className="text-sm text-gray">Aún no hay oportunidades cerradas.</p>
          ) : (
            <p className="text-2xl font-bold text-dark font-mono">
              {avgClosingDays} <span className="text-sm font-normal text-gray">días en promedio</span>
            </p>
          )}

          <h3 className="text-sm font-bold text-dark pt-2 border-t border-border/60">
            Ranking de Asesores
          </h3>
          {ranking.length === 0 ? (
            <p className="text-sm text-gray">Sin datos todavía.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {ranking.map((a) => (
                <li
                  key={a.advisorId ?? "sin-asesor"}
                  className="flex items-center justify-between"
                >
                  <span className="text-dark">{a.advisorName ?? "Sin asesor asignado"}</span>
                  <span className="font-mono text-gray">{a.dealCount} cerradas</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
