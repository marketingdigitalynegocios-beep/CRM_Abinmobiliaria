"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
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
    formState: { errors },
  } = useForm<CreateManualLeadInput>({ resolver: zodResolver(createManualLeadSchema) });

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
