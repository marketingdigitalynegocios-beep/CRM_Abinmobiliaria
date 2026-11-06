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
const labelClass = "mb-1 block text-sm font-medium text-slate-700";
const errorClass = "mt-1 text-xs text-danger";

interface PropertyFormProps {
  propertyId?: string;
  initialValues?: Partial<CreatePropertyInput>;
  onSuccess?: () => void;
}

interface OwnerOption {
  id: string;
  fullName: string;
}

export function PropertyForm({ propertyId, initialValues, onSuccess }: PropertyFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [coverImage, setCoverImage] = useState<UploadedImage[]>(
    initialValues?.coverImageId ? [{ id: initialValues.coverImageId, url: "" }] : []
  );

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreatePropertyInput>({
    // El cast es por una fricción de inferencia entre zod v4 (defaults
    // opcionales en el input, requeridos en el output) y los tipos genéricos
    // del resolver de react-hook-form — no oculta un error real.
    resolver: zodResolver(createPropertySchema) as never,
    defaultValues: {
      currency: "COP",
      parkingSpots: 0,
      amenities: [],
      isFeatured: false,
      visibility: "published",
      listingType: "exclusive",
      ...initialValues,
    } as CreatePropertyInput,
  });

  useEffect(() => {
    fetch("/api/property-owners")
      .then((res) => res.json() as Promise<{ owners: OwnerOption[] }>)
      .then((data) => setOwners(data.owners ?? []))
      .catch(() => setOwners([]));
  }, []);

  async function onSubmit(data: CreatePropertyInput) {
    setServerError(null);
    setSubmitting(true);
    const payload = { ...data, coverImageId: coverImage[0]?.id };
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
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex max-w-3xl flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="title">
            Título
          </label>
          <input className={inputClass} id="title" {...register("title")} />
          {errors.title && <p className={errorClass}>{errors.title.message}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="type">
            Tipo
          </label>
          <select className={inputClass} id="type" {...register("type")}>
            <option value="apartment">Apartamento</option>
            <option value="house">Casa</option>
            <option value="commercial">Local comercial</option>
            <option value="land">Lote</option>
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="operation">
            Operación
          </label>
          <select className={inputClass} id="operation" {...register("operation")}>
            <option value="sale">Venta</option>
            <option value="rent">Arriendo</option>
            <option value="sale_rent">Venta o arriendo</option>
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="priceCents">
            Precio (COP)
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
            Área (m²)
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
            Estrato
          </label>
          <input
            className={inputClass}
            id="stratum"
            type="number"
            {...register("stratum", { valueAsNumber: true })}
          />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="city">
            Ciudad
          </label>
          <input className={inputClass} id="city" {...register("city")} />
        </div>
        <div>
          <label className={labelClass} htmlFor="neighborhood">
            Barrio
          </label>
          <input className={inputClass} id="neighborhood" {...register("neighborhood")} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="address">
            Dirección
          </label>
          <input className={inputClass} id="address" {...register("address")} />
        </div>
        <div>
          <label className={labelClass} htmlFor="latitude">
            Latitud
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
            Longitud
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

      <section>
        <label className={labelClass} htmlFor="description">
          Descripción
        </label>
        <textarea className={inputClass} id="description" rows={4} {...register("description")} />
      </section>

      <section>
        <label className={labelClass}>Foto de portada</label>
        <ImageUploader context="property" images={coverImage} maxImages={1} onChange={setCoverImage} />
      </section>

      <section className="rounded-md border border-border bg-light-gray/50 p-4">
        <h3 className="text-sm font-semibold text-dark">Inventario</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="ownerId">
              Propietario
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
              Código interno
            </label>
            <input className={inputClass} id="internalCode" placeholder="AP-0042" {...register("internalCode")} />
          </div>
          <div>
            <label className={labelClass} htmlFor="listingType">
              Tipo de mandato
            </label>
            <select className={inputClass} id="listingType" {...register("listingType")}>
              <option value="exclusive">Exclusivo</option>
              <option value="shared">Compartido</option>
              <option value="open">Captación abierta</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="commissionPercentage">
              Comisión (%)
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
              Visibilidad en la página pública
            </label>
            <select className={inputClass} id="visibility" {...register("visibility")}>
              <option value="published">Publicada</option>
              <option value="draft">Borrador (no visible)</option>
              <option value="archived">Archivada</option>
            </select>
          </div>
        </div>
      </section>

      {serverError && <p className="text-sm text-danger">{serverError}</p>}

      <div className="flex gap-3">
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Guardando..." : propertyId ? "Guardar cambios" : "Crear propiedad"}
        </button>
      </div>
    </form>
  );
}
