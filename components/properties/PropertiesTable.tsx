"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import Link from "next/link";
import { buildImageUrl } from "@/lib/images/delivery-url";

export interface PropertyRow {
  id: string;
  title: string;
  internalCode: string | null;
  type: string;
  operation: string;
  priceCents: number;
  status: string;
  visibility: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaM2?: number | null;
  city?: string | null;
  neighborhood?: string | null;
  coverImageId?: string | null;
}

const statusBadges: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active: { label: "Disponible", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  inactive: { label: "En Negociación", bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800", text: "text-amber-800 dark:text-amber-400", dot: "bg-amber-500" },
  sold: { label: "Vendida", bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
  rented: { label: "Arrendada", bg: "bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800", text: "text-purple-700 dark:text-purple-400", dot: "bg-purple-500" },
};

const typeLabels: Record<string, string> = {
  apartment: "Apartamento",
  house: "Casa",
  commercial: "Comercial / Oficina",
  land: "Lote / Terreno",
};

const typeIcons: Record<string, string> = {
  apartment: "apartment",
  house: "cottage",
  commercial: "storefront",
  land: "landscape",
};

const operationLabels: Record<string, string> = {
  sale: "Venta",
  rent: "Arriendo",
  sale_rent: "Venta / Arriendo",
};

function PropertyImageThumbnail({
  src,
  alt,
  fallbackIcon,
}: {
  src?: string | null;
  alt: string;
  fallbackIcon: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-lg border border-border bg-slate-100 dark:bg-slate-800 text-gray/50">
        <span className="material-symbols-outlined text-[24px]">
          {fallbackIcon}
        </span>
      </div>
    );
  }

  return (
    <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-slate-100 dark:bg-slate-800 shadow-2xs">
      <img
        src={src}
        alt={alt}
        onError={() => setHasError(true)}
        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
        loading="lazy"
      />
    </div>
  );
}

export function PropertiesTable({
  properties,
  tenantSlug = "inmoelite-prime",
}: {
  properties: PropertyRow[];
  tenantSlug?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterOperation, setFilterOperation] = useState<"all" | "sale" | "rent">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "available" | "sold">("all");
  const [filterType, setFilterType] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  function getPublicPropertyUrl(propertyId: string) {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return `${origin}/${tenantSlug}/property/${propertyId}`;
  }

  async function handleCopyLink(property: PropertyRow) {
    const url = getPublicPropertyUrl(property.id);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(property.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      prompt("Copia este enlace para compartir por WhatsApp o redes:", url);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta propiedad? Esta acción no se puede deshacer.")) return;
    setPending(id);
    try {
      await fetch(`/api/properties/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  const saleCount = useMemo(
    () => properties.filter((p) => p.operation === "sale" || p.operation === "sale_rent").length,
    [properties]
  );
  const rentCount = useMemo(
    () => properties.filter((p) => p.operation === "rent" || p.operation === "sale_rent").length,
    [properties]
  );
  const activeCount = useMemo(
    () => properties.filter((p) => p.status === "active").length,
    [properties]
  );
  const soldCount = useMemo(
    () => properties.filter((p) => p.status === "sold" || p.status === "rented").length,
    [properties]
  );

  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      const matchesSearch =
        search === "" ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.internalCode && p.internalCode.toLowerCase().includes(search.toLowerCase())) ||
        (p.city && p.city.toLowerCase().includes(search.toLowerCase())) ||
        (p.neighborhood && p.neighborhood.toLowerCase().includes(search.toLowerCase()));

      const matchesOp =
        filterOperation === "all" ||
        p.operation === filterOperation ||
        p.operation === "sale_rent";

      const matchesType = filterType === "all" || p.type === filterType;

      const matchesStatus =
        filterStatus === "all"
          ? true
          : filterStatus === "available"
          ? p.status === "active"
          : p.status === "sold" || p.status === "rented";

      return matchesSearch && matchesOp && matchesType && matchesStatus;
    });
  }, [properties, search, filterOperation, filterType, filterStatus]);

  const propertyTypeTags = [
    { value: "all", label: "Todos", icon: "select_all" },
    { value: "apartment", label: "Apartamento", icon: "apartment" },
    { value: "house", label: "Casa", icon: "cottage" },
    { value: "commercial", label: "Comercial / Oficina", icon: "storefront" },
    { value: "land", label: "Lote / Terreno", icon: "landscape" },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Barra de Pestañas Principales (Venta vs Arriendo) & Filtro de Disponibilidad */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl border border-border shadow-xs">
        {/* Pestañas de Operación (Venta / Arriendo / Todas) */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setFilterOperation("all")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterOperation === "all"
                ? "bg-white dark:bg-slate-900 text-primary shadow-xs"
                : "text-gray hover:text-dark dark:hover:text-white"
            }`}
          >
            Todas ({properties.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterOperation("sale")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterOperation === "sale"
                ? "bg-white dark:bg-slate-900 text-primary shadow-xs"
                : "text-gray hover:text-dark dark:hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">sell</span>
            <span>En Venta</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-mono font-bold">
              {saleCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFilterOperation("rent")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterOperation === "rent"
                ? "bg-white dark:bg-slate-900 text-primary shadow-xs"
                : "text-gray hover:text-dark dark:hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">key</span>
            <span>En Arriendo</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-mono font-bold">
              {rentCount}
            </span>
          </button>
        </div>

        {/* Pestañas de Disponibilidad (Disponibles vs Vendidas/Arrendadas) */}
        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          <button
            type="button"
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              filterStatus === "all"
                ? "bg-dark text-white border-dark dark:bg-white dark:text-dark shadow-2xs"
                : "border-border bg-white dark:bg-slate-800 text-gray hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            Todas ({properties.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("available")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              filterStatus === "available"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 shadow-2xs"
                : "border-border bg-white dark:bg-slate-800 text-gray hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Disponibles ({activeCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("sold")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              filterStatus === "sold"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 shadow-2xs"
                : "border-border bg-white dark:bg-slate-800 text-gray hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Vendidas / Arrendadas ({soldCount})</span>
          </button>
        </div>
      </div>

      {/* 2. Filtro por Etiquetas de Tipo de Propiedad & Buscador */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl border border-border shadow-xs">
        {/* Etiquetas de Tipo de Inmueble (Pills) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-gray mr-1">Inmueble:</span>
          {propertyTypeTags.map((tag) => {
            const isSelected = filterType === tag.value;
            return (
              <button
                key={tag.value}
                type="button"
                onClick={() => setFilterType(tag.value)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  isSelected
                    ? "border-primary bg-primary text-white shadow-2xs font-semibold"
                    : "border-border bg-light-gray/40 dark:bg-slate-800 text-dark dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{tag.icon}</span>
                <span>{tag.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input & View Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray text-[17px]">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar código, sector..."
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-border bg-light-gray/40 dark:bg-slate-800 text-xs text-dark dark:text-white placeholder:text-gray focus:border-primary focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition-all"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-border p-0.5 bg-light-gray dark:bg-slate-800 shrink-0">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                viewMode === "table"
                  ? "bg-white dark:bg-slate-700 text-primary shadow-xs font-bold"
                  : "text-gray hover:text-dark"
              }`}
              title="Vista Tabla"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">table_rows</span>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                viewMode === "grid"
                  ? "bg-white dark:bg-slate-700 text-primary shadow-xs font-bold"
                  : "text-gray hover:text-dark"
              }`}
              title="Vista Cuadrícula"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Empty State */}
      {filteredProperties.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white dark:bg-slate-900 p-10 text-center text-sm text-gray space-y-3">
          <span className="material-symbols-outlined text-4xl text-gray/50">apartment</span>
          <p>No se encontraron propiedades con los filtros seleccionados.</p>
          <Link
            href="/dashboard/properties/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white hover:bg-primary-light"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Crear nueva propiedad
          </Link>
        </div>
      ) : viewMode === "table" ? (
        /* 3. Detailed Data Table with PROPERTY FIGURE / IMAGE */
        <div className="overflow-x-auto rounded-xl border border-border bg-white dark:bg-slate-900 shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-light-gray/70 dark:bg-slate-800/80 uppercase text-gray font-semibold">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Inmueble / Foto</th>
                <th className="px-4 py-3">Tipo &amp; Operación</th>
                <th className="px-4 py-3">Precio COP</th>
                <th className="px-4 py-3">Características</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Visibilidad</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredProperties.map((property) => {
                const badge = statusBadges[property.status] ?? statusBadges.active;
                const imageUrl = buildImageUrl(property.coverImageId, "thumbnail") || property.coverImageId;
                const fallbackIcon = typeIcons[property.type] ?? "apartment";

                return (
                  <tr key={property.id} className="hover:bg-light-gray/40 dark:hover:bg-slate-800/50 transition-colors">
                    {/* Código */}
                    <td className="px-4 py-3 font-mono font-semibold text-primary">
                      {property.internalCode ?? "—"}
                    </td>

                    {/* Inmueble con Foto / Figura */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Figura / Thumbnail de la Propiedad */}
                        <Link
                          href={`/dashboard/properties/${property.id}/edit`}
                          className="group block shrink-0"
                          title={`Editar ${property.title}`}
                        >
                          <PropertyImageThumbnail
                            src={imageUrl}
                            alt={property.title}
                            fallbackIcon={fallbackIcon}
                          />
                        </Link>

                        {/* Título & Ubicación */}
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/properties/${property.id}/edit`}
                            className="font-semibold text-dark text-xs hover:text-primary transition-colors line-clamp-1 block"
                            title={property.title}
                          >
                            {property.title}
                          </Link>
                          {(property.neighborhood || property.city) && (
                            <div className="text-[11px] text-gray flex items-center gap-1 mt-0.5">
                              <span className="material-symbols-outlined text-[13px] text-primary">
                                location_on
                              </span>
                              <span className="truncate max-w-[220px]">
                                {[property.neighborhood, property.city].filter(Boolean).join(", ")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Tipo & Operación */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-light-gray dark:bg-slate-800 text-dark">
                          {typeLabels[property.type] ?? property.type}
                        </span>
                        <span className="text-[11px] font-semibold text-primary">
                          {operationLabels[property.operation] ?? property.operation}
                        </span>
                      </div>
                    </td>

                    {/* Precio COP */}
                    <td className="px-4 py-3 font-mono font-bold text-dark whitespace-nowrap">
                      ${(property.priceCents / 100).toLocaleString("es-CO")}
                      <span className="text-[10px] text-gray ml-1 font-normal">COP</span>
                    </td>

                    {/* Características */}
                    <td className="px-4 py-3 text-gray text-[11px] whitespace-nowrap">
                      {property.areaM2 ? `${property.areaM2} m² · ` : ""}
                      {property.bedrooms ? `${property.bedrooms} hab · ` : ""}
                      {property.bathrooms ? `${property.bathrooms} baños` : ""}
                      {!property.areaM2 && !property.bedrooms && !property.bathrooms ? "—" : ""}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg} ${badge.text}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        {badge.label}
                      </span>
                    </td>

                    {/* Visibilidad Web */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          property.visibility === "published"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-gray/10 text-gray"
                        }`}
                      >
                        {property.visibility === "published" ? "Publicada en Web" : "Borrador"}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end items-center gap-1.5">
                        <Link
                          href={`/dashboard/properties/${property.id}/edit`}
                          className="px-2.5 py-1 rounded-md border border-border text-[11px] font-medium hover:bg-light-gray dark:hover:bg-slate-800 transition-colors"
                        >
                          Ficha
                        </Link>
                        {/* Botón Copiar Link / Compartir con meta tags */}
                        <button
                          type="button"
                          onClick={() => handleCopyLink(property)}
                          title="Copiar link con vista previa e imagen de portada para WhatsApp y redes"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-all ${
                            copiedId === property.id
                              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold shadow-2xs"
                              : "border-border hover:bg-light-gray dark:hover:bg-slate-800 text-dark dark:text-slate-200"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[13px] text-primary">
                            {copiedId === property.id ? "check" : "share"}
                          </span>
                          <span>{copiedId === property.id ? "¡Copiado!" : "Copiar link"}</span>
                        </button>
                        {/* Botón directo a WhatsApp */}
                        <a
                          href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                            `Hola, te comparto esta propiedad:\n\n*${property.title}*\n${getPublicPropertyUrl(
                              property.id
                            )}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                          title="Enviar directo a WhatsApp con vista previa"
                        >
                          <span className="material-symbols-outlined text-[16px]">chat</span>
                        </a>
                        <button
                          disabled={pending === property.id}
                          onClick={() => handleDelete(property.id)}
                          className="p-1 rounded text-gray hover:text-danger hover:bg-danger/10 transition-colors"
                          title="Eliminar"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* 4. Grid Cards View with HIGH-RES COVER PHOTO */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProperties.map((property) => {
            const badge = statusBadges[property.status] ?? statusBadges.active;
            const imageUrl = buildImageUrl(property.coverImageId, "public") || property.coverImageId;
            const fallbackIcon = typeIcons[property.type] ?? "apartment";

            return (
              <div
                key={property.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-border overflow-hidden shadow-xs hover:border-primary/50 hover:shadow-md transition-all flex flex-col justify-between group"
              >
                {/* Figura / Imagen de Portada de la Propiedad */}
                <div className="relative h-48 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={property.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray/40 bg-slate-100 dark:bg-slate-800">
                      <span className="material-symbols-outlined text-[40px]">
                        {fallbackIcon}
                      </span>
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                  {/* Internal Code Tag */}
                  <div className="absolute top-3 left-3">
                    <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-white font-mono font-bold text-[11px] shadow-sm">
                      {property.internalCode ?? "#INM"}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-xs ${
                        property.status === "active"
                          ? "bg-emerald-600/90 text-white"
                          : property.status === "sold"
                          ? "bg-blue-600/90 text-white"
                          : "bg-amber-600/90 text-white"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      {badge.label}
                    </span>
                  </div>

                  {/* Bottom Image Overlay: Price COP */}
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-baseline justify-between text-white">
                    <span className="text-lg font-bold font-mono tracking-tight drop-shadow-md">
                      ${(property.priceCents / 100).toLocaleString("es-CO")}{" "}
                      <span className="text-xs font-normal text-white/80">COP</span>
                    </span>
                    <span className="rounded bg-white/20 backdrop-blur-xs px-2 py-0.5 text-[10px] font-semibold uppercase">
                      {operationLabels[property.operation] ?? property.operation}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <Link
                      href={`/dashboard/properties/${property.id}/edit`}
                      className="font-semibold text-sm text-dark hover:text-primary transition-colors line-clamp-1 block"
                      title={property.title}
                    >
                      {property.title}
                    </Link>

                    {(property.neighborhood || property.city) && (
                      <p className="text-xs text-gray flex items-center gap-1 mt-1">
                        <span className="material-symbols-outlined text-[14px] text-primary">
                          location_on
                        </span>
                        <span>
                          {[property.neighborhood, property.city].filter(Boolean).join(", ")}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Characteristics Strip */}
                  <div className="flex items-center gap-2 text-xs text-gray pt-2 border-t border-border/50">
                    <span className="px-1.5 py-0.5 rounded bg-light-gray dark:bg-slate-800 font-medium text-dark text-[11px]">
                      {typeLabels[property.type] ?? property.type}
                    </span>
                    {property.areaM2 ? (
                      <>
                        <span>·</span>
                        <span className="font-medium">{property.areaM2} m²</span>
                      </>
                    ) : null}
                    {property.bedrooms ? (
                      <>
                        <span>·</span>
                        <span>{property.bedrooms} hab</span>
                      </>
                    ) : null}
                    {property.bathrooms ? (
                      <>
                        <span>·</span>
                        <span>{property.bathrooms} bñ</span>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="p-3 bg-light-gray/40 dark:bg-slate-800/50 border-t border-border flex items-center justify-between gap-1.5">
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `Hola, te comparto esta propiedad:\n\n*${property.title}*\n${getPublicPropertyUrl(
                        property.id
                      )}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 transition-colors"
                    title="Compartir por WhatsApp con vista previa"
                  >
                    <span className="material-symbols-outlined text-[15px]">chat</span>
                    <span>WhatsApp</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(property)}
                    className={`inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                      copiedId === property.id
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                        : "border-border hover:bg-white dark:hover:bg-slate-700 text-dark dark:text-slate-200"
                    }`}
                    title="Copiar enlace con vista previa"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {copiedId === property.id ? "check" : "share"}
                    </span>
                    <span>{copiedId === property.id ? "Copiado" : "Copiar"}</span>
                  </button>
                  <Link
                    href={`/dashboard/properties/${property.id}/edit`}
                    className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-white dark:hover:bg-slate-700 transition-colors"
                  >
                    Ficha
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Footer Count Indicator */}
      <div className="flex items-center justify-between text-xs text-gray px-1 pt-2">
        <span>Mostrando {filteredProperties.length} de {properties.length} propiedades</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {activeCount} disponibles
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            {soldCount} cerradas
          </span>
        </div>
      </div>
    </div>
  );
}
