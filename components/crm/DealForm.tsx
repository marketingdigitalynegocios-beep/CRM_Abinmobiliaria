"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";

interface PropertyOption {
  id: string;
  title: string;
}

interface DealFormInput {
  propertyId: string;
  dealValueCents?: number;
  nextAction?: string;
}

/**
 * Abre una oportunidad (deal) sobre una propiedad concreta para este lead —
 * ver blueprint §8/§14 "Separar Lead de Deal".
 */
export function DealForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset } = useForm<DealFormInput>();

  useEffect(() => {
    if (!open) return;
    fetch("/api/properties?limit=100")
      .then((res) => res.json() as Promise<{ properties: PropertyOption[] }>)
      .then((data) => setProperties(data.properties ?? []))
      .catch(() => setProperties([]));
  }, [open]);

  async function onSubmit(data: DealFormInput) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          propertyId: data.propertyId,
          dealValueCents: data.dealValueCents ? Math.round(Number(data.dealValueCents) * 100) : undefined,
          nextAction: data.nextAction || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "No se pudo abrir la oportunidad");
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
        Abrir oportunidad
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
      <div>
        <label className="mb-1 block text-xs font-medium text-gray" htmlFor="dealValueCents">
          Valor esperado (COP)
        </label>
        <input
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          id="dealValueCents"
          type="number"
          {...register("dealValueCents")}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray" htmlFor="nextAction">
          Próxima acción
        </label>
        <input
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          id="nextAction"
          placeholder="Llamar, enviar propuesta..."
          {...register("nextAction")}
        />
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-light disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Creando..." : "Crear oportunidad"}
        </button>
        <button
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
          onClick={() => setOpen(false)}
          type="button"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
