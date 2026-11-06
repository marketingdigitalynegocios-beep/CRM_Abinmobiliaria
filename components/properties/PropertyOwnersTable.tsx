"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface OwnerRow {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
}

export function PropertyOwnersTable({ owners }: { owners: OwnerRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este propietario?")) return;
    setPending(id);
    setError(null);
    try {
      const res = await fetch(`/api/property-owners/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "No se pudo eliminar");
        return;
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  if (owners.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-white p-10 text-center text-sm text-gray">
        Todavía no tienes propietarios registrados.{" "}
        <a className="font-medium text-primary" href="/dashboard/properties/owners/new">
          Crea el primero
        </a>
        .
      </div>
    );
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      <div className="overflow-x-auto rounded-md border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-light-gray text-xs uppercase text-gray">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {owners.map((owner) => (
              <tr className="border-b border-border last:border-0" key={owner.id}>
                <td className="px-4 py-3 font-medium text-dark">{owner.fullName}</td>
                <td className="px-4 py-3 text-gray">{owner.phone ?? "—"}</td>
                <td className="px-4 py-3 text-gray">{owner.email ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <a
                      className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-light-gray"
                      href={`/dashboard/properties/owners/${owner.id}/edit`}
                    >
                      Editar
                    </a>
                    <button
                      className="rounded-md border border-border px-2 py-1 text-xs font-medium text-danger hover:bg-danger/5 disabled:opacity-50"
                      disabled={pending === owner.id}
                      onClick={() => handleDelete(owner.id)}
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
    </div>
  );
}
