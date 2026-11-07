"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  createManualLeadSchema,
  type CreateManualLeadInput,
} from "@/lib/validations/lead";

export function NewContactForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateManualLeadInput>({ resolver: zodResolver(createManualLeadSchema) as never });

  async function onSubmit(data: CreateManualLeadInput) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "No se pudo crear el contacto");
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
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light"
        onClick={() => setOpen(true)}
        type="button"
      >
        Nuevo contacto
      </button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-white p-4"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-gray" htmlFor="fullName">
          Nombre
        </label>
        <input className="rounded-md border border-border px-3 py-2 text-sm" id="fullName" {...register("fullName")} />
        {errors.fullName && <p className="text-xs text-danger">{errors.fullName.message}</p>}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray" htmlFor="phone">
          Teléfono
        </label>
        <input className="rounded-md border border-border px-3 py-2 text-sm" id="phone" {...register("phone")} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray" htmlFor="email">
          Email
        </label>
        <input className="rounded-md border border-border px-3 py-2 text-sm" id="email" {...register("email")} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray" htmlFor="preferredCity">
          Ciudad de interés
        </label>
        <input
          className="rounded-md border border-border px-3 py-2 text-sm"
          id="preferredCity"
          {...register("preferredCity")}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray" htmlFor="preferredType">
          Tipo de interés
        </label>
        <select
          className="rounded-md border border-border px-3 py-2 text-sm"
          id="preferredType"
          {...register("preferredType", { setValueAs: (v) => v || undefined })}
        >
          <option value="">Cualquiera</option>
          <option value="apartment">Apartamento</option>
          <option value="house">Casa</option>
          <option value="commercial">Comercial / Oficina</option>
          <option value="land">Lote / Terreno</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray" htmlFor="preferredOperation">
          Operación
        </label>
        <select
          className="rounded-md border border-border px-3 py-2 text-sm"
          id="preferredOperation"
          {...register("preferredOperation", { setValueAs: (v) => v || undefined })}
        >
          <option value="">Cualquiera</option>
          <option value="sale">Venta</option>
          <option value="rent">Arriendo</option>
          <option value="sale_rent">Venta / Arriendo</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray" htmlFor="budgetMinCents">
          Presupuesto mínimo (COP)
        </label>
        <Controller
          control={control}
          name="budgetMinCents"
          render={({ field }) => (
            <input
              className="rounded-md border border-border px-3 py-2 text-sm"
              id="budgetMinCents"
              inputMode="numeric"
              onChange={(e) => field.onChange(e.target.value ? Math.round(Number(e.target.value) * 100) : undefined)}
              type="number"
              value={field.value ? field.value / 100 : ""}
            />
          )}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray" htmlFor="budgetMaxCents">
          Presupuesto máximo (COP)
        </label>
        <Controller
          control={control}
          name="budgetMaxCents"
          render={({ field }) => (
            <input
              className="rounded-md border border-border px-3 py-2 text-sm"
              id="budgetMaxCents"
              inputMode="numeric"
              onChange={(e) => field.onChange(e.target.value ? Math.round(Number(e.target.value) * 100) : undefined)}
              type="number"
              value={field.value ? field.value / 100 : ""}
            />
          )}
        />
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <button
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "Guardando..." : "Guardar"}
      </button>
      <button
        className="rounded-md border border-border px-4 py-2 text-sm font-medium"
        onClick={() => setOpen(false)}
        type="button"
      >
        Cancelar
      </button>
    </form>
  );
}
