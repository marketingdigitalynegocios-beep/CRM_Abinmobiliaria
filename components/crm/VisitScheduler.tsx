"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";

interface VisitSchedulerProps {
  leadId: string;
  properties: { id: string; title: string }[];
  deals: { id: string; title: string | null }[];
}

interface VisitFormInput {
  propertyId: string;
  dealId?: string;
  scheduledAt: string;
  notes?: string;
}

export function VisitScheduler({ leadId, properties, deals }: VisitSchedulerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset } = useForm<VisitFormInput>();

  async function onSubmit(data: VisitFormInput) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
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
        className="rounded-md border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
        onClick={() => setOpen(true)}
        type="button"
      >
        Agendar visita
      </button>
    );
  }

  return (
    <form className="flex flex-col gap-3 rounded-md border border-border bg-light-gray/50 p-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray" htmlFor="propertyId">
          Propiedad
        </label>
        <select className="w-full rounded-md border border-border px-3 py-2 text-sm" id="propertyId" required {...register("propertyId")}>
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
          <label className="mb-1 block text-xs font-medium text-gray" htmlFor="dealId">
            Oportunidad (opcional)
          </label>
          <select className="w-full rounded-md border border-border px-3 py-2 text-sm" id="dealId" {...register("dealId")}>
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
        <label className="mb-1 block text-xs font-medium text-gray" htmlFor="scheduledAt">
          Fecha y hora
        </label>
        <input
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          id="scheduledAt"
          required
          type="datetime-local"
          {...register("scheduledAt")}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray" htmlFor="notes">
          Notas
        </label>
        <textarea className="w-full rounded-md border border-border px-3 py-2 text-sm" id="notes" rows={2} {...register("notes")} />
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-light disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Agendando..." : "Agendar"}
        </button>
        <button className="rounded-md border border-border px-3 py-1.5 text-xs font-medium" onClick={() => setOpen(false)} type="button">
          Cancelar
        </button>
      </div>
    </form>
  );
}
