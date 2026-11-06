interface PropertyFiltersProps {
  tenantSlug: string;
  defaultType?: string;
  defaultOperation?: string;
}

/**
 * Form GET plano, sin JavaScript de cliente: al enviar, navega a la misma
 * página con query params y el Server Component vuelve a renderizar
 * filtrado. Más simple que un combobox client-side para el MVP.
 */
export function PropertyFilters({ tenantSlug, defaultType, defaultOperation }: PropertyFiltersProps) {
  return (
    <form action={`/${tenantSlug}`} className="flex flex-wrap items-end gap-3" method="get">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray" htmlFor="type">
          Tipo
        </label>
        <select
          className="rounded-md border border-border px-3 py-2 text-sm"
          defaultValue={defaultType ?? ""}
          id="type"
          name="type"
        >
          <option value="">Todos</option>
          <option value="apartment">Apartamento</option>
          <option value="house">Casa</option>
          <option value="commercial">Local comercial</option>
          <option value="land">Lote</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray" htmlFor="operation">
          Operación
        </label>
        <select
          className="rounded-md border border-border px-3 py-2 text-sm"
          defaultValue={defaultOperation ?? ""}
          id="operation"
          name="operation"
        >
          <option value="">Todas</option>
          <option value="sale">Venta</option>
          <option value="rent">Arriendo</option>
          <option value="sale_rent">Venta o arriendo</option>
        </select>
      </div>

      <button
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light"
        type="submit"
      >
        Filtrar
      </button>
    </form>
  );
}
