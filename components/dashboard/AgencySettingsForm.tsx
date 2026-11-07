"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateAgencySchema,
  type UpdateAgencyInput,
} from "@/lib/validations/agency";
import { ImageUploader, type UploadedImage } from "@/components/properties/ImageUploader";

interface AgencySettingsFormProps {
  initialValues: UpdateAgencyInput & {
    nit?: string;
    saleCommission?: number;
    rentCommission?: number;
    leadDistribution?: string;
  };
  logoImageId: string | null;
  slug: string;
}

export function AgencySettingsForm({
  initialValues,
  logoImageId,
  slug,
}: AgencySettingsFormProps) {
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
        setServerError(body.error ?? "No se pudo guardar la configuración");
        return;
      }
      setSaved(true);
    } catch {
      setServerError("Error al guardar la configuración");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {/* CARD 1: Perfil Corporativo & Branding */}
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-border bg-white px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            <h2 className="text-base font-semibold text-dark">
              Identidad &amp; Datos Corporativos
            </h2>
          </div>
          <span className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <span className="material-symbols-outlined text-[14px]">
              verified
            </span>
            NIT Verificado DIAN
          </span>
        </div>

        <div className="space-y-6 p-6">
          {/* Logo Section */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Logotipo Institucional de la Inmobiliaria
            </label>
            <ImageUploader
              context="agency_logo"
              images={logo}
              maxImages={1}
              onChange={setLogo}
            />
            <p className="mt-1 text-[11px] text-gray">
              Recomendado: PNG o SVG de alta resolución con fondo transparente (512×512px).
            </p>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="name">
                Razón Social / Nombre Comercial
              </label>
              <input
                id="name"
                className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs text-slate-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                {...register("name")}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                NIT &amp; Dígito de Verificación
              </label>
              <div className="relative">
                <input
                  defaultValue="901.452.883-1"
                  className="w-full h-9 rounded-lg border border-slate-300 pl-3 pr-8 text-xs text-slate-800 font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  type="text"
                />
                <span className="material-symbols-outlined absolute right-2.5 top-2 text-[16px] text-emerald-600">
                  verified_user
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Slug Web Pública
              </label>
              <div className="flex items-center">
                <span className="flex h-9 items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 px-2.5 text-[11px] text-gray select-none">
                  tuapp.com/
                </span>
                <input
                  readOnly
                  value={slug}
                  className="w-full h-9 rounded-r-lg border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-primary focus:outline-none"
                />
              </div>
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                <span className="material-symbols-outlined text-[13px]">
                  check_circle
                </span>
                URL Pública Activa &amp; Indexable ✓
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="whatsappNumber">
                WhatsApp Central (Atención y Botón Web)
              </label>
              <div className="relative">
                <input
                  id="whatsappNumber"
                  placeholder="+57 300 987 6543"
                  className="w-full h-9 rounded-lg border border-slate-300 pl-3 pr-8 text-xs text-slate-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  {...register("whatsappNumber")}
                />
                <span className="material-symbols-outlined absolute right-2.5 top-2 text-[16px] text-emerald-600">
                  chat
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="phone">
                Teléfono PBX
              </label>
              <input
                id="phone"
                placeholder="+57 (601) 745-8900"
                className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs text-slate-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                {...register("phone")}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="email">
                Email Corporativo
              </label>
              <input
                id="email"
                type="email"
                placeholder="contacto@inmoeliteprime.com"
                className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs text-slate-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                {...register("email")}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-danger">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="city">
                Ciudad Principal
              </label>
              <input
                id="city"
                placeholder="Bogotá D.C."
                className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs text-slate-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                {...register("city")}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="primaryColor">
                Color de Marca Institucional
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="primaryColor"
                  type="color"
                  className="h-9 w-14 cursor-pointer rounded border border-slate-300 p-0.5"
                  {...register("primaryColor")}
                />
                <span className="text-xs font-mono text-gray">Paleta Andean Blue</span>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="address">
                Dirección de la Sede Principal
              </label>
              <input
                id="address"
                placeholder="Calle 93B # 13-45, Of. 602, Chicó Norte"
                className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs text-slate-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                {...register("address")}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="description">
                Descripción Institucional (Meta descripción en web pública)
              </label>
              <textarea
                id="description"
                rows={3}
                placeholder="Inmobiliaria líder en inmuebles residenciales y comerciales de alta gama en Colombia..."
                className="w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                {...register("description")}
              />
            </div>
          </div>
        </div>
      </section>

      {/* CARD 2: Parámetros Comerciales & Comisiones */}
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-border bg-white px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[20px]">
              payments
            </span>
            <h2 className="text-base font-semibold text-dark">
              Políticas de Comisión y Distribución Comercial
            </h2>
          </div>
          <span className="text-xs text-gray font-medium">
            Régimen Inmobiliario Estándar
          </span>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Comisión Estándar por Venta
              </label>
              <div className="flex items-center">
                <input
                  defaultValue="3.0"
                  type="text"
                  className="w-full h-9 rounded-l-lg border border-r-0 border-slate-300 px-3 text-xs text-slate-800 font-mono focus:border-primary focus:outline-none"
                />
                <span className="flex h-9 items-center rounded-r-lg border border-slate-300 bg-slate-100 px-3 text-xs font-bold text-gray select-none">
                  %
                </span>
              </div>
              <span className="mt-1 block text-[11px] text-gray">
                Tarifa estándar sugerida por Lonja de Propiedad Raíz.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Comisión Estándar por Arriendo Mensual
              </label>
              <div className="flex items-center">
                <input
                  defaultValue="8.0"
                  type="text"
                  className="w-full h-9 rounded-l-lg border border-r-0 border-slate-300 px-3 text-xs text-slate-800 font-mono focus:border-primary focus:outline-none"
                />
                <span className="flex h-9 items-center rounded-r-lg border border-slate-300 bg-slate-100 px-3 text-xs font-bold text-gray select-none">
                  %
                </span>
              </div>
              <span className="mt-1 block text-[11px] text-gray">
                Calculado sobre el primer canon de arrendamiento.
              </span>
            </div>
          </div>

          {/* Lead Distribution Option */}
          <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">
                hub
              </span>
              <h3 className="text-xs font-bold text-dark">
                Asignación Automática de Leads de WhatsApp
              </h3>
            </div>
            <p className="mb-3 text-[11px] text-slate-600">
              Define cómo los prospectos cualificados por el Agente de IA son canalizados a los asesores activos.
            </p>
            <div className="space-y-2 text-xs">
              <label className="flex items-start gap-2.5 rounded-md border border-slate-200 bg-white p-2.5 cursor-pointer hover:border-primary transition-colors">
                <input
                  type="radio"
                  name="lead_dist"
                  defaultChecked
                  className="mt-0.5 text-primary focus:ring-primary"
                />
                <div>
                  <span className="font-semibold text-dark block">
                    Distribución Equitativa (Round Robin)
                  </span>
                  <span className="text-[11px] text-gray">
                    El sistema rota cada lead de forma sucesiva entre los asesores activos según su agenda.
                  </span>
                </div>
              </label>
              <label className="flex items-start gap-2.5 rounded-md border border-slate-200 bg-white p-2.5 cursor-pointer hover:border-primary transition-colors">
                <input
                  type="radio"
                  name="lead_dist"
                  className="mt-0.5 text-primary focus:ring-primary"
                />
                <div>
                  <span className="font-semibold text-dark block">
                    Por Zona Geográfica &amp; Tipo de Inmueble
                  </span>
                  <span className="text-[11px] text-gray">
                    Los prospectos se asignan al asesor especializado en la zona correspondiente.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Feedback Messages */}
      {serverError && (
        <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
          {serverError}
        </div>
      )}
      {saved && (
        <div className="rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-emerald-600">
            check_circle
          </span>
          <span>Configuración guardada exitosamente.</span>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-3 rounded-xl border border-border bg-white p-4 shadow-xs">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">save</span>
          <span>{submitting ? "Guardando..." : "Guardar Cambios"}</span>
        </button>
      </div>
    </form>
  );
}
