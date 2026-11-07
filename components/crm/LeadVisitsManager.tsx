"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VisitScheduler } from "./VisitScheduler";

export interface VisitItemData {
  id: string;
  scheduledAt: string;
  status: "scheduled" | "completed" | "cancelled";
  notes?: string | null;
  propertyTitle?: string | null;
  propertyId: string;
}

interface LeadVisitsManagerProps {
  leadId: string;
  visits: VisitItemData[];
  properties: { id: string; title: string }[];
  deals: { id: string; title: string | null }[];
}

const statusConfig: Record<
  VisitItemData["status"],
  { label: string; badge: string; icon: string }
> = {
  scheduled: {
    label: "Programada",
    badge:
      "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
    icon: "event",
  },
  completed: {
    label: "Realizada",
    badge:
      "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
    icon: "check_circle",
  },
  cancelled: {
    label: "Cancelada",
    badge:
      "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400",
    icon: "cancel",
  },
};

export function LeadVisitsManager({
  leadId,
  visits,
  properties,
  deals,
}: LeadVisitsManagerProps) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleUpdateStatus(visitId: string, status: "completed" | "cancelled") {
    setUpdatingId(visitId);
    try {
      const res = await fetch(`/api/visits/${visitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Error al actualizar visita:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Header con botón para agendar */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-dark dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">
            calendar_clock
          </span>
          <span>Visitas &amp; Citas Agendadas ({visits.length})</span>
        </h2>

        <VisitScheduler
          leadId={leadId}
          properties={properties}
          deals={deals}
          buttonLabel="+ Agendar Nueva Visita"
          buttonClassName="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-light px-3.5 py-1.5 text-xs font-semibold text-white transition-colors shadow-2xs"
        />
      </div>

      {visits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-6 text-center">
          <span className="material-symbols-outlined text-3xl text-gray dark:text-slate-500 mb-1">
            event_busy
          </span>
          <p className="text-xs font-medium text-gray dark:text-slate-400">
            Sin visitas agendadas todavía para este cliente.
          </p>
          <p className="text-[11px] text-gray dark:text-slate-500 mt-0.5">
            Usa el botón de arriba para programar un recorrido a una de las propiedades de interés.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {visits.map((visit) => {
            const meta = statusConfig[visit.status] || statusConfig.scheduled;
            const visitDate = new Date(visit.scheduledAt);

            return (
              <li
                key={visit.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex flex-col items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold leading-none">
                      {visitDate.toLocaleDateString("es-CO", { day: "numeric" })}
                    </span>
                    <span className="text-[9px] uppercase font-semibold text-primary/80">
                      {visitDate.toLocaleDateString("es-CO", { month: "short" })}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-dark dark:text-white">
                        {visit.propertyTitle || "Inmueble asignado"}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.badge}`}
                      >
                        <span className="material-symbols-outlined text-[12px]">{meta.icon}</span>
                        <span>{meta.label}</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray dark:text-slate-400 mt-1">
                      <span className="flex items-center gap-1 font-mono">
                        <span className="material-symbols-outlined text-[13px] text-primary">
                          schedule
                        </span>
                        <span>
                          {visitDate.toLocaleTimeString("es-CO", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                      </span>
                      {visit.notes && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[260px] italic">
                            &quot;{visit.notes}&quot;
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acciones para la visita */}
                {visit.status === "scheduled" && (
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      disabled={updatingId === visit.id}
                      onClick={() => handleUpdateStatus(visit.id, "completed")}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 px-2.5 py-1.5 text-xs font-semibold transition-colors shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[15px]">done</span>
                      <span>Realizada</span>
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === visit.id}
                      onClick={() => handleUpdateStatus(visit.id, "cancelled")}
                      className="inline-flex items-center gap-1 rounded-lg border border-border dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-gray hover:text-danger px-2.5 py-1.5 text-xs font-medium transition-colors shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[15px]">close</span>
                      <span>Cancelar</span>
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
