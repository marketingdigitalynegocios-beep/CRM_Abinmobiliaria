"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateAgencySchema,
  type UpdateAgencyInput,
} from "@/lib/validations/agency";
import { ImageUploader, type UploadedImage } from "@/components/properties/ImageUploader";

const inputClass =
  "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "mb-1 block text-sm font-medium text-dark";
const errorClass = "mt-1 text-xs text-danger";

interface AgencySettingsFormProps {
  initialValues: UpdateAgencyInput;
  logoImageId: string | null;
}

export function AgencySettingsForm({ initialValues, logoImageId }: AgencySettingsFormProps) {
  const [logo, setLogo] = useState<UploadedImage[]>(
    logoImageId ? [{ id: logoImageId, url: "" }] : []
  );
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateAgencyInput>({
    resolver: zodResolver(updateAgencySchema) as never,
    defaultValues: initialValues,
  });

  async function onSubmit(data: UpdateAgencyInput) {
    setSubmitting(true);
    setServerError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/agency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, logoImageId: logo[0]?.id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setServerError(body.error ?? "No se pudo guardar");
        return;
      }
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex max-w-2xl flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className={labelClass}>Logo</label>
        <ImageUploader context="agency_logo" images={logo} maxImages={1} onChange={setLogo} />
      </div>

      <div>
        <label className={labelClass} htmlFor="name">
          Nombre de la inmobiliaria
        </label>
        <input className={inputClass} id="name" {...register("name")} />
        {errors.name && <p className={errorClass}>{errors.name.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="phone">
            Teléfono
          </label>
          <input className={inputClass} id="phone" {...register("phone")} />
        </div>
        <div>
          <label className={labelClass} htmlFor="whatsappNumber">
            WhatsApp (botón de contacto público)
          </label>
          <input className={inputClass} id="whatsappNumber" placeholder="+57..." {...register("whatsappNumber")} />
        </div>
        <div>
          <label className={labelClass} htmlFor="email">
            Email
          </label>
          <input className={inputClass} id="email" type="email" {...register("email")} />
          {errors.email && <p className={errorClass}>{errors.email.message}</p>}
        </div>
        <div>
          <label className={labelClass} htmlFor="website">
            Sitio web
          </label>
          <input className={inputClass} id="website" placeholder="https://..." {...register("website")} />
          {errors.website && <p className={errorClass}>{errors.website.message}</p>}
        </div>
        <div>
          <label className={labelClass} htmlFor="city">
            Ciudad
          </label>
          <input className={inputClass} id="city" {...register("city")} />
        </div>
        <div>
          <label className={labelClass} htmlFor="primaryColor">
            Color de marca
          </label>
          <input className="h-10 w-full rounded-md border border-border" id="primaryColor" type="color" {...register("primaryColor")} />
          {errors.primaryColor && <p className={errorClass}>{errors.primaryColor.message}</p>}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="address">
          Dirección
        </label>
        <input className={inputClass} id="address" {...register("address")} />
      </div>

      <div>
        <label className={labelClass} htmlFor="description">
          Descripción (aparece como meta descripción en tu página pública)
        </label>
        <textarea className={inputClass} id="description" rows={3} {...register("description")} />
      </div>

      {serverError && <p className="text-sm text-danger">{serverError}</p>}
      {saved && <p className="text-sm text-success">Guardado.</p>}

      <div>
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
