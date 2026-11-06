"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface PropertyRow {
  id: string;
  title: string;
  internalCode: string | null;
  type: string;
  operation: string;
  priceCents: number;
  status: string;
  visibility: string;
}

const statusLabels: Record<string, string> = {
  active: "Activa",
  inactive: "Inactiva",
  sold: "Vendida",
  rented: "Arrendada",
};

export function PropertiesTable({ properties }: { properties: PropertyRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

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

  async function handleMarkSold(id: string) {
    setPending(id);
    try {
      await fetch("/api/properties/bulk-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyIds: [id], status: "sold" }),
      });
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  if (properties.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-white p-10 text-center text-sm text-gray">
        Todavía no tienes propiedades.{" "}
        <a className="font-medium text-primary" href="/dashboard/properties/new">
          Crea la primera
        </a>
        .
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-light-gray text-xs uppercase text-gray">
          <tr>
            <th className="px-4 py-3">Código</th>
            <th className="px-4 py-3">Título</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Precio</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Visibilidad</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {properties.map((property) => (
            <tr className="border-b border-border last:border-0" key={property.id}>
              <td className="px-4 py-3 text-gray">{property.internalCode ?? "—"}</td>
              <td className="px-4 py-3 font-medium text-dark">{property.title}</td>
              <td className="px-4 py-3 text-gray">{property.type}</td>
              <td className="px-4 py-3 text-gray">
                ${(property.priceCents / 100).toLocaleString("es-CO")}
              </td>
              <td className="px-4 py-3 text-gray">
                {statusLabels[property.status] ?? property.status}
              </td>
              <td className="px-4 py-3 text-gray">{property.visibility}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <a
                    className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-light-gray"
                    href={`/dashboard/properties/${property.id}/edit`}
                  >
                    Editar
                  </a>
                  <button
                    className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-light-gray disabled:opacity-50"
                    disabled={pending === property.id}
                    onClick={() => handleMarkSold(property.id)}
                    type="button"
                  >
                    Marcar vendida
                  </button>
                  <button
                    className="rounded-md border border-border px-2 py-1 text-xs font-medium text-danger hover:bg-danger/5 disabled:opacity-50"
                    disabled={pending === property.id}
                    onClick={() => handleDelete(property.id)}
                    type="button"
                  >
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
