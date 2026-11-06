"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  createPropertyOwnerSchema,
  type CreatePropertyOwnerInput,
} from "../../lib/validations/property-owner";

const inputClass =
  "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";
const errorClass = "mt-1 text-xs text-danger";

interface PropertyOwnerFormProps {
  ownerId?: string;
  initialValues?: Partial<CreatePropertyOwnerInput>;
}

export function PropertyOwnerForm({ ownerId, initialValues }: PropertyOwnerFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreatePropertyOwnerInput>({
    resolver: zodResolver(createPropertyOwnerSchema),
    defaultValues: initialValues,
  });

  async function onSubmit(data: CreatePropertyOwnerInput) {
    setServerError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        ownerId ? `/api/property-owners/${ownerId}` : "/api/property-owners",
        {
          method: ownerId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setServerError(body.error ?? "No se pudo guardar el propietario");
        return;
      }
      router.push("/dashboard/properties/owners");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex max-w-lg flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className={labelClass} htmlFor="fullName">
          Nombre completo
        </label>
        <input className={inputClass} id="fullName" {...register("fullName")} />
        {errors.fullName && <p className={errorClass}>{errors.fullName.message}</p>}
      </div>

      <div>
        <label className={labelClass} htmlFor="documentId">
          Cédula / NIT
        </label>
        <input className={inputClass} id="documentId" {...register("documentId")} />
      </div>

      <div>
        <label className={labelClass} htmlFor="phone">
          Teléfono
        </label>
        <input className={inputClass} id="phone" {...register("phone")} />
      </div>

      <div>
        <label className={labelClass} htmlFor="email">
          Email
        </label>
        <input className={inputClass} id="email" type="email" {...register("email")} />
        {errors.email && <p className={errorClass}>{errors.email.message}</p>}
      </div>

      <div>
        <label className={labelClass} htmlFor="notes">
          Notas
        </label>
        <textarea className={inputClass} id="notes" rows={3} {...register("notes")} />
      </div>

      {serverError && <p className="text-sm text-danger">{serverError}</p>}

      <div>
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Guardando..." : ownerId ? "Guardar cambios" : "Crear propietario"}
        </button>
      </div>
    </form>
  );
}
