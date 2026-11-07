"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TEMPLATES = [
  {
    id: "modern" as const,
    label: "Moderno",
    description: "Grilla de 3 columnas, cards con hover. Referencia: portales tradicionales.",
  },
  {
    id: "classic" as const,
    label: "Clásico",
    description: "Header centrado, lista de propiedades con imagen a la izquierda.",
  },
  {
    id: "minimal" as const,
    label: "Minimalista",
    description: "Sin tarjetas, tipografía grande, fotos a sangre. Para inmobiliarias de lujo.",
  },
];

export function TemplatePicker({
  slug,
  currentTemplate,
}: {
  slug: string;
  currentTemplate: "modern" | "classic" | "minimal";
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentTemplate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/agency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: selected }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "No se pudo guardar");
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {TEMPLATES.map((t) => (
          <button
            className={`rounded-md border p-4 text-left text-sm transition ${
              selected === t.id ? "border-primary bg-primary-light/10" : "border-border bg-white"
            }`}
            key={t.id}
            onClick={() => setSelected(t.id)}
            type="button"
          >
            <p className="font-semibold text-dark">{t.label}</p>
            <p className="mt-1 text-xs text-gray">{t.description}</p>
          </button>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light disabled:opacity-60"
          disabled={submitting || selected === currentTemplate}
          onClick={handleSave}
          type="button"
        >
          {submitting ? "Guardando..." : "Usar este template"}
        </button>
        <a className="text-sm font-medium text-primary" href={`/${slug}`} rel="noreferrer" target="_blank">
          Ver página pública ↗
        </a>
      </div>
    </div>
  );
}
