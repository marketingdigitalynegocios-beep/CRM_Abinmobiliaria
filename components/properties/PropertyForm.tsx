"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  createPropertySchema,
  type CreatePropertyInput,
} from "../../lib/validations/property";
import { ImageUploader, type UploadedImage } from "./ImageUploader";

const inputClass =
  "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "mb-1 block text-sm font-medium text-dark";
const errorClass = "mt-1 text-xs text-danger";

interface PropertyFormProps {
  propertyId?: string;
  initialValues?: Partial<CreatePropertyInput>;
  initialImages?: UploadedImage[];
  onSuccess?: () => void;
}

interface OwnerOption {
  id: string;
  fullName: string;
}

export function PropertyForm({
  propertyId,
  initialValues,
  initialImages = [],
  onSuccess,
}: PropertyFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [owners, setOwners] = useState<OwnerOption[]>([]);

  const [coverImage, setCoverImage] = useState<UploadedImage[]>(() => {
    if (initialValues?.coverImageId) {
      return [{ id: initialValues.coverImageId, url: initialValues.coverImageId }];
    }
    return [];
  });

  const [galleryImages, setGalleryImages] = useState<UploadedImage[]>(() => {
    return initialImages ?? [];
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreatePropertyInput>({
    resolver: zodResolver(createPropertySchema) as never,
    defaultValues: {
      type: "apartment",
      operation: "sale",
      currency: "COP",
      parkingSpots: 0,
      amenities: [],
      isFeatured: false,
      visibility: "published",
      listingType: "exclusive",
      ...initialValues,
    } as CreatePropertyInput,
  });

  const currentOperation = watch("operation") || "sale";
  const currentType = watch("type") || "apartment";

  useEffect(() => {
    fetch("/api/property-owners")
      .then((res) => res.json() as Promise<{ owners: OwnerOption[] }>)
      .then((data) => setOwners(data.owners ?? []))
      .catch(() => setOwners([]));
  }, []);

  async function onSubmit(data: CreatePropertyInput) {
    setServerError(null);
    setSubmitting(true);

    const coverId = coverImage[0]?.id || galleryImages[0]?.id;
    const additionalIds = galleryImages.map((img) => img.id);
    const allImages = Array.from(new Set([coverId, ...additionalIds].filter(Boolean))) as string[];

    const payload = {
      ...data,
      coverImageId: coverId,
      images: allImages,
    };

    try {
      const res = await fetch(propertyId ? `/api/properties/${propertyId}` : "/api/properties", {
        method: propertyId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setServerError(body.error ?? "No se pudo guardar la propiedad");
        return;
      }
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/dashboard/properties");
        router.refresh();
      }
    } catch {
      setServerError("Error de red al guardar la propiedad");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex max-w-3xl flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
      {/* 1. Información Básica */}
      <section className="grid gap-4 sm:grid-cols-2 rounded-xl border border-border bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="title">
            Título del Inmueble
          </label>
          <input className={inputClass} id="title" {...register("title")} />
          {errors.title && <p className={errorClass}>{errors.title.message}</p>}
        </div>

        {/* Etiquetas de Tipo de Operación: Venta vs Arriendo */}
        <div className="sm:col-span-2">
          <label className={labelClass}>Tipo de Operación (Etiquetas)</label>
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { value: "sale", label: "Venta", icon: "sell" },
              { value: "rent", label: "Arriendo", icon: "key" },
              { value: "sale_rent", label: "Venta o Arriendo", icon: "swap_horiz" },
            ].map((op) => {
              const isSelected = currentOperation === op.value;
              return (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setValue("operation", op.value as any, { shouldValidate: true })}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    isSelected
                      ? "border-primary bg-primary text-white shadow-xs"
                      : "border-border bg-white dark:bg-slate-800 text-dark dark:text-slate-200 hover:border-primary/50"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{op.icon}</span>
                  <span>{op.label}</span>
                </button>
              );
            })}
          </div>
          <input type="hidden" {...register("operation")} />
        </div>

        {/* Etiquetas de Tipo de Propiedad: Apartamento, Casa, etc */}
        <div className="sm:col-span-2">
          <label className={labelClass}>Tipo de Inmueble (Etiquetas)</label>
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { value: "apartment", label: "Apartamento", icon: "apartment" },
              { value: "house", label: "Casa", icon: "cottage" },
              { value: "commercial", label: "Comercial / Oficina", icon: "storefront" },
              { value: "land", label: "Lote / Terreno", icon: "landscape" },
            ].map((t) => {
              const isSelected = currentType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setValue("type", t.value as any, { shouldValidate: true })}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    isSelected
                      ? "border-primary bg-primary text-white shadow-xs"
                      : "border-border bg-white dark:bg-slate-800 text-dark dark:text-slate-200 hover:border-primary/50"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
          <input type="hidden" {...register("type")} />
        </div>

        <div>
          <label className={labelClass} htmlFor="priceCents">
            Precio ($ COP)
          </label>
          <Controller
            control={control}
            name="priceCents"
            render={({ field }) => (
              <input
                className={inputClass}
                id="priceCents"
                inputMode="numeric"
                onChange={(e) => field.onChange(Math.round(Number(e.target.value || 0) * 100))}
                type="number"
                value={field.value ? field.value / 100 : ""}
              />
            )}
          />
          {errors.priceCents && <p className={errorClass}>{errors.priceCents.message}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="areaM2">
            Área Construida (m²)
          </label>
          <input
            className={inputClass}
            id="areaM2"
            step="0.01"
            type="number"
            {...register("areaM2", { valueAsNumber: true })}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="bedrooms">
            Habitaciones
          </label>
          <input
            className={inputClass}
            id="bedrooms"
            type="number"
            {...register("bedrooms", { valueAsNumber: true })}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="bathrooms">
            Baños
          </label>
          <input
            className={inputClass}
            id="bathrooms"
            type="number"
            {...register("bathrooms", { valueAsNumber: true })}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="parkingSpots">
            Parqueaderos
          </label>
          <input
            className={inputClass}
            id="parkingSpots"
            type="number"
            {...register("parkingSpots", { valueAsNumber: true })}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="stratum">
            Estrato socioeconómico (1-6)
          </label>
          <input
            className={inputClass}
            id="stratum"
            type="number"
            {...register("stratum", { valueAsNumber: true })}
          />
        </div>
      </section>

      {/* 2. Ubicación */}
      <section className="grid gap-4 sm:grid-cols-2 rounded-xl border border-border bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div>
          <label className={labelClass} htmlFor="city">
            Ciudad
          </label>
          <input className={inputClass} id="city" placeholder="Medellín" {...register("city")} />
        </div>
        <div>
          <label className={labelClass} htmlFor="neighborhood">
            Barrio / Sector
          </label>
          <input className={inputClass} id="neighborhood" placeholder="El Poblado" {...register("neighborhood")} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="address">
            Dirección Exacta
          </label>
          <input className={inputClass} id="address" placeholder="Carrera 43A # 1-50" {...register("address")} />
        </div>
        <div>
          <label className={labelClass} htmlFor="latitude">
            Latitud GPS
          </label>
          <input
            className={inputClass}
            id="latitude"
            step="0.0000001"
            type="number"
            {...register("latitude", { valueAsNumber: true })}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="longitude">
            Longitud GPS
          </label>
          <input
            className={inputClass}
            id="longitude"
            step="0.0000001"
            type="number"
            {...register("longitude", { valueAsNumber: true })}
          />
        </div>
      </section>

      {/* 3. Descripción */}
      <section className="rounded-xl border border-border bg-white dark:bg-slate-900 p-5 shadow-xs">
        <label className={labelClass} htmlFor="description">
          Descripción del Inmueble
        </label>
        <textarea
          className={inputClass}
          id="description"
          rows={4}
          placeholder="Hermoso apartamento con vista panorámica, acabados de lujo, cocina integral..."
          {...register("description")}
        />
      </section>

      {/* 4. SECCIÓN MULTI-FOTOS: Portada + Galería Adicional */}
      <section className="rounded-xl border border-border bg-white dark:bg-slate-900 p-5 space-y-6 shadow-xs">
        {/* Foto de Portada Principal */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-[20px]">
              photo_camera
            </span>
            <h3 className="text-sm font-bold text-dark">
              Foto de Portada Principal
            </h3>
          </div>
          <p className="text-[11px] text-gray mb-3">
            Es la imagen destacada que se muestra en el listado, portada de ficha técnica y tarjetas de WhatsApp.
          </p>
          <ImageUploader
            context="property"
            images={coverImage}
            maxImages={1}
            onChange={setCoverImage}
          />
        </div>

        {/* Galería de Fotos Adicionales (Al menos 5 fotos más) */}
        <div className="pt-5 border-t border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">
                collections
              </span>
              <h3 className="text-sm font-bold text-dark">
                Galería de Fotos Adicionales (Al menos 5 fotos más)
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Recomendado: 5 a 15 fotos
            </span>
          </div>
          <p className="text-[11px] text-gray mb-3">
            Agrega fotos de las áreas internas (sala, habitaciones, cocina, baños, balcón, fachada, zonas sociales y parqueadero).
          </p>
          <ImageUploader
            context="property"
            images={galleryImages}
            maxImages={15}
            onChange={setGalleryImages}
          />
        </div>
      </section>

      {/* 5. Inventario y Asignación */}
      <section className="rounded-xl border border-border bg-light-gray/40 dark:bg-slate-900 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-dark flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[18px]">inventory_2</span>
          <span>Gestión de Inventario &amp; Mandato</span>
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="ownerId">
              Propietario Asignado
            </label>
            <select className={inputClass} id="ownerId" {...register("ownerId")}>
              <option value="">Sin asignar</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="internalCode">
              Código Interno
            </label>
            <input className={inputClass} id="internalCode" placeholder="AP-0042" {...register("internalCode")} />
          </div>
          <div>
            <label className={labelClass} htmlFor="listingType">
              Tipo de Mandato
            </label>
            <select className={inputClass} id="listingType" {...register("listingType")}>
              <option value="exclusive">Exclusivo</option>
              <option value="shared">Compartido</option>
              <option value="open">Captación abierta</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="commissionPercentage">
              Comisión Pactada (%)
            </label>
            <input
              className={inputClass}
              id="commissionPercentage"
              step="0.1"
              type="number"
              {...register("commissionPercentage", { valueAsNumber: true })}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="visibility">
              Visibilidad en la Página Pública
            </label>
            <select className={inputClass} id="visibility" {...register("visibility")}>
              <option value="published">Publicada</option>
              <option value="draft">Borrador (no visible)</option>
              <option value="archived">Archivada</option>
            </select>
          </div>
        </div>
      </section>

      {serverError && (
        <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-danger border border-red-200">
          {serverError}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          className="rounded-lg bg-primary px-5 py-2.5 text-xs font-semibold text-white hover:bg-primary-light disabled:opacity-60 transition-colors shadow-xs"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Guardando..." : propertyId ? "Guardar cambios" : "Crear propiedad"}
        </button>
      </div>
    </form>
  );
}
