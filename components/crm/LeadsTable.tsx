"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface LeadRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  stage: string;
  source: string;
}

const stageLabels: Record<string, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  disqualified: "Descartado",
};

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function handleStageChange(id: string, stage: string) {
    setPending(id);
    try {
      await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-white p-10 text-center text-sm text-gray">
        Todavía no tienes contactos. Aparecerán acá cuando alguien escriba desde tu página pública.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-light-gray text-xs uppercase text-gray">
          <tr>
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Contacto</th>
            <th className="px-4 py-3">Origen</th>
            <th className="px-4 py-3">Etapa</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr className="border-b border-border last:border-0" key={lead.id}>
              <td className="px-4 py-3 font-medium text-dark">{lead.fullName}</td>
              <td className="px-4 py-3 text-gray">{lead.email ?? lead.phone ?? "—"}</td>
              <td className="px-4 py-3 text-gray">{lead.source}</td>
              <td className="px-4 py-3">
                <select
                  className="rounded-md border border-border px-2 py-1 text-xs"
                  disabled={pending === lead.id}
                  onChange={(e) => handleStageChange(lead.id, e.target.value)}
                  value={lead.stage}
                >
                  {Object.entries(stageLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 text-right">
                <a className="text-xs font-medium text-primary" href={`/dashboard/crm/${lead.id}`}>
                  Ver detalle
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
