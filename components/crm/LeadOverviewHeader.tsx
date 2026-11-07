"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LeadOverviewHeaderProps {
  lead: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    source: string;
    stage: string;
    notes: string | null;
    budgetMinCents?: number | null;
    budgetMaxCents?: number | null;
    preferredCity?: string | null;
    preferredType?: string | null;
    preferredOperation?: string | null;
  };
}

const stageConfig: Record<
  string,
  { label: string; bg: string; text: string; dot: string; border: string }
> = {
  new: {
    label: "Nuevo",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500",
    border: "border-blue-200 dark:border-blue-800",
  },
  contacted: {
    label: "Contactado",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
    border: "border-amber-200 dark:border-amber-800",
  },
  disqualified: {
    label: "Descartado",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-400",
    dot: "bg-rose-500",
    border: "border-rose-200 dark:border-rose-800",
  },
};

const typeLabels: Record<string, string> = {
  apartment: "Apartamento",
  house: "Casa",
  commercial: "Comercial / Oficina",
  land: "Lote / Terreno",
};

export function LeadOverviewHeader({ lead }: LeadOverviewHeaderProps) {
  const router = useRouter();
  const [stage, setStage] = useState(lead.stage || "new");
  const [savingStage, setSavingStage] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState(lead.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);

  async function handleStageChange(newStage: string) {
    setSavingStage(true);
    setStage(newStage);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error("Error al actualizar etapa:", err);
    } finally {
      setSavingStage(false);
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        setIsEditingNotes(false);
        router.refresh();
      }
    } catch (err) {
      console.error("Error al guardar notas:", err);
    } finally {
      setSavingNotes(false);
    }
  }

  const cleanPhone = (lead.whatsapp || lead.phone || "").replace(/\D/g, "");
  const currentStageMeta = stageConfig[stage] || stageConfig.new;

  return (
    <div className="rounded-xl border border-border bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
      {/* Top row: Nombre, Etapa interactiva & Acciones directas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-dark dark:text-white tracking-tight">
              {lead.fullName}
            </h1>

            {/* Selector interactivo de Etapa del Lead */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="leadStageSelect" className="text-xs font-medium text-gray">
                Etapa:
              </label>
              <div className="relative inline-flex items-center">
                <select
                  id="leadStageSelect"
                  value={stage}
                  disabled={savingStage}
                  onChange={(e) => handleStageChange(e.target.value)}
                  className={`h-8 rounded-lg pl-3 pr-8 text-xs font-semibold border ${currentStageMeta.border} ${currentStageMeta.bg} ${currentStageMeta.text} focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs`}
                >
                  <option value="new">🔵 Nuevo</option>
                  <option value="contacted">🟡 Contactado</option>
                  <option value="disqualified">🔴 Descartado</option>
                </select>
                {savingStage && (
                  <span className="material-symbols-outlined text-[14px] text-gray animate-spin absolute right-2 pointer-events-none">
                    progress_activity
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Subtítulo: Contacto & Origen */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray dark:text-slate-400 mt-1.5">
            {lead.phone && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-primary">phone</span>
                <span>{lead.phone}</span>
              </span>
            )}
            {lead.email && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-primary">mail</span>
                <span>{lead.email}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize text-[11px]">
              <span className="material-symbols-outlined text-[13px]">input</span>
              <span>Origen: {lead.source}</span>
            </span>
          </div>
        </div>

        {/* Acciones Rápidas: WhatsApp, Llamar, Correo */}
        <div className="flex items-center gap-2 flex-wrap">
          {cleanPhone && (
            <a
              href={`https://wa.me/${cleanPhone}?text=Hola%20${encodeURIComponent(
                lead.fullName
              )}%2C%20un%20gusto%20saludarte.`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 px-3 py-1.5 text-xs font-semibold transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px]">chat</span>
              <span>WhatsApp</span>
            </a>
          )}
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white dark:bg-slate-800 hover:bg-slate-50 text-dark dark:text-slate-200 px-3 py-1.5 text-xs font-semibold transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px]">call</span>
              <span>Llamar</span>
            </a>
          )}
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white dark:bg-slate-800 hover:bg-slate-50 text-dark dark:text-slate-200 px-3 py-1.5 text-xs font-semibold transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px]">email</span>
              <span>Email</span>
            </a>
          )}
        </div>
      </div>

      {/* Preferencias del Cliente si existen */}
      {(lead.preferredType ||
        lead.preferredOperation ||
        lead.preferredCity ||
        lead.budgetMaxCents) && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60 text-xs">
          <span className="font-semibold text-gray text-[11px]">Busca:</span>
          {lead.preferredOperation && (
            <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">
              {lead.preferredOperation === "sale" ? "Venta" : "Arriendo"}
            </span>
          )}
          {lead.preferredType && (
            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
              {typeLabels[lead.preferredType] ?? lead.preferredType}
            </span>
          )}
          {lead.preferredCity && (
            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
              📍 {lead.preferredCity}
            </span>
          )}
          {lead.budgetMaxCents != null && lead.budgetMaxCents > 0 && (
            <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-mono font-medium">
              Hasta ${(lead.budgetMaxCents / 100).toLocaleString("es-CO")} COP
            </span>
          )}
        </div>
      )}

      {/* Notas del Lead (Interactivas y Editables) */}
      <div className="pt-2 border-t border-border/60">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-dark dark:text-slate-200 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-amber-500">sticky_note_2</span>
            <span>Notas &amp; Observaciones del Asesor</span>
          </span>
          {!isEditingNotes && (
            <button
              type="button"
              onClick={() => setIsEditingNotes(true)}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">edit</span>
              <span>{notes ? "Editar notas" : "Agregar notas"}</span>
            </button>
          )}
        </div>

        {isEditingNotes ? (
          <div className="space-y-2 mt-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Escribe notas sobre intereses del cliente, requerimientos especiales, presupuesto..."
              className="w-full rounded-lg border border-border dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-dark dark:text-white focus:border-primary focus:outline-none"
              rows={3}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNotes(lead.notes || "");
                  setIsEditingNotes(false);
                }}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-gray hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-light text-white text-xs font-semibold shadow-2xs disabled:opacity-60 transition-colors"
              >
                {savingNotes ? "Guardando..." : "Guardar Notas"}
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setIsEditingNotes(true)}
            role="button"
            tabIndex={0}
            className="group cursor-pointer rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-3 text-xs text-dark dark:text-slate-200 transition-colors hover:border-slate-300"
          >
            {notes ? (
              <p className="whitespace-pre-line leading-relaxed">{notes}</p>
            ) : (
              <p className="text-gray italic">
                Sin notas registradas. Haz clic aquí para añadir observaciones sobre este cliente.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
