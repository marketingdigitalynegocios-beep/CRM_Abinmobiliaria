"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";

interface VisitSchedulerProps {
  leadId?: string;
  leads?: { id: string; fullName: string }[];
  properties: { id: string; title: string }[];
  deals?: { id: string; title: string | null }[];
  buttonLabel?: string;
  buttonClassName?: string;
}

interface VisitFormInput {
  leadId?: string;
  propertyId: string;
  dealId?: string;
  scheduledAt: string;
  notes?: string;
}

export function VisitScheduler({
  leadId: initialLeadId,
  leads = [],
  properties,
  deals = [],
  buttonLabel = "Agendar visita",
  buttonClassName,
}: VisitSchedulerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset } = useForm<VisitFormInput>({
    defaultValues: {
      leadId: initialLeadId,
    },
  });

  async function onSubmit(data: VisitFormInput) {
    const targetLeadId = initialLeadId || data.leadId;
    if (!targetLeadId) {
      setError("Debes seleccionar un cliente");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: targetLeadId,
          propertyId: data.propertyId,
          dealId: data.dealId || undefined,
          scheduledAt: new Date(data.scheduledAt).toISOString(),
          notes: data.notes || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "No se pudo agendar la visita");
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        className={
          buttonClassName ??
          "inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors shadow-2xs"
        }
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="material-symbols-outlined text-[16px]">calendar_month</span>
        <span>{buttonLabel}</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl border border-border bg-white dark:bg-slate-900 p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              event_available
            </span>
            <h3 className="font-semibold text-sm text-dark dark:text-white">
              Agendar Visita Inmobiliaria
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-gray hover:text-dark dark:hover:text-white p-1 rounded"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)}>
          {/* Si no viene un leadId fijo, mostrar selector de cliente */}
          {!initialLeadId && (
            <div>
              <label className="mb-1 block text-xs font-medium text-dark dark:text-slate-300">
                Cliente / Lead
              </label>
              <select
                className="w-full rounded-lg border border-border dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-dark dark:text-slate-200 focus:border-primary focus:outline-none"
                required
                {...register("leadId")}
              >
                <option value="">Selecciona un cliente</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-dark dark:text-slate-300" htmlFor="propertyId">
              Propiedad
            </label>
            <select
              className="w-full rounded-lg border border-border dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-dark dark:text-slate-200 focus:border-primary focus:outline-none"
              id="propertyId"
              required
              {...register("propertyId")}
            >
              <option value="">Selecciona una propiedad</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          {deals.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-dark dark:text-slate-300" htmlFor="dealId">
                Oportunidad (opcional)
              </label>
              <select
                className="w-full rounded-lg border border-border dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-dark dark:text-slate-200 focus:border-primary focus:outline-none"
                id="dealId"
                {...register("dealId")}
              >
                <option value="">Sin asociar</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title || d.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-dark dark:text-slate-300" htmlFor="scheduledAt">
              Fecha y Hora de la Visita
            </label>
            <input
              className="w-full rounded-lg border border-border dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-dark dark:text-slate-200 focus:border-primary focus:outline-none"
              id="scheduledAt"
              required
              type="datetime-local"
              {...register("scheduledAt")}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-dark dark:text-slate-300" htmlFor="notes">
              Notas adicionales
            </label>
            <textarea
              className="w-full rounded-lg border border-border dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-dark dark:text-slate-200 focus:border-primary focus:outline-none"
              id="notes"
              rows={2}
              placeholder="Instrucciones de llegada, requerimientos del cliente..."
              {...register("notes")}
            />
          </div>

          {error && (
            <p className="text-xs text-danger flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">error</span>
              <span>{error}</span>
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-gray hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => setOpen(false)}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="rounded-lg bg-primary hover:bg-primary-light px-4 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-60 shadow-2xs"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Guardando..." : "Confirmar Visita"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
