import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  getLeadsForTenant,
  listPropertiesForTenant,
  listVisitsWithContextForTenant,
} from "@/lib/db/tenant-scope";
import { CalendarView } from "@/components/dashboard/CalendarView";
import { GoogleCalendarConnectButton } from "@/components/dashboard/GoogleCalendarConnectButton";
import { VisitScheduler } from "@/components/crm/VisitScheduler";

export const metadata: Metadata = { title: "Calendario" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ gcal_connected?: string; gcal_error?: string }>;
}) {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const { gcal_connected, gcal_error } = await searchParams;

  const db = getDb(env.DB);
  const [visits, leads, { properties }] = await Promise.all([
    listVisitsWithContextForTenant(db, session.tenantId),
    getLeadsForTenant(db, session.tenantId),
    listPropertiesForTenant(db, session.tenantId, { limit: 100 }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-dark">Calendario de Visitas</h1>
          <p className="mt-1 text-sm text-gray">
            Vista mensual y semanal de todas las visitas agendadas en tu CRM.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <VisitScheduler
            leads={leads}
            properties={properties.map((p) => ({ id: p.id, title: p.title }))}
            buttonLabel="+ Agendar Visita"
            buttonClassName="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-light px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors"
          />
          <GoogleCalendarConnectButton />
        </div>
      </div>

      {gcal_connected && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Tu Google Calendar quedó conectado. Las próximas visitas que agendes con tu usuario como
          asesor se sincronizarán automáticamente.
        </div>
      )}
      {gcal_error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-danger">
          No se pudo conectar Google Calendar: {gcal_error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-border shadow-xs p-5">
        <CalendarView visits={visits} />
      </div>
    </div>
  );
}
