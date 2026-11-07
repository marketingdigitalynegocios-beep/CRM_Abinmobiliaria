"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

interface AiAgentFormValues {
  isActive: boolean;
  systemPrompt: string;
  welcomeMessage: string;
  geminiKey: string;
}

interface AiAgentFormProps {
  initialValues: {
    isActive: boolean;
    systemPrompt: string;
    welcomeMessage: string;
  };
  hasGeminiKey: boolean;
}

export function AiAgentForm({ initialValues, hasGeminiKey }: AiAgentFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit } = useForm<AiAgentFormValues>({
    defaultValues: {
      ...initialValues,
      geminiKey: "",
    },
  });

  async function onSubmit(data: AiAgentFormValues) {
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/ai-agent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: data.isActive,
          systemPrompt: data.systemPrompt,
          welcomeMessage: data.welcomeMessage,
          ...(data.geminiKey ? { geminiKey: data.geminiKey } : {}),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "No se pudo guardar la configuración");
        return;
      }
      setSaved(true);
    } catch {
      setError("Error de red al guardar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {/* Card 1: Instrucciones del Sistema (System Prompt) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">code_blocks</span>
            <h2 className="text-base font-semibold text-dark">
              Instrucciones del Sistema (System Prompt)
            </h2>
          </div>
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
            Gemini 1.5 Flash
          </span>
        </div>

        <p className="text-xs text-slate-600">
          Define la personalidad y directrices de cualificación. El agente recibe este texto más el
          listado real de tus propiedades activas en cada conversación — no hace falta referenciarlas
          manualmente.
        </p>

        <textarea
          className="w-full rounded-lg border border-slate-300 bg-slate-50/60 p-3 font-mono text-xs text-slate-800 focus:bg-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
          rows={6}
          {...register("systemPrompt")}
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Mensaje de Bienvenida Automático
          </label>
          <input
            className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs text-slate-800 placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            type="text"
            {...register("welcomeMessage")}
          />
        </div>
      </div>

      {/* Card 2: Gemini API Key & Bot State */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">vpn_key</span>
            <h2 className="text-base font-semibold text-dark">
              Credenciales de Inteligencia Artificial (Google Gemini)
            </h2>
          </div>
          {hasGeminiKey && (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
              Configurada
            </span>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="geminiKey">
            Google Gemini API Key
          </label>
          <input
            id="geminiKey"
            type="password"
            placeholder={
              hasGeminiKey ? "••••••••••••••••  (déjalo vacío para no cambiarla)" : "AIzaSy..."
            }
            className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs text-slate-800 placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            {...register("geminiKey")}
          />
          <p className="mt-1 text-[11px] text-gray">
            Se obtiene gratis en{" "}
            <a
              className="font-medium text-primary hover:underline"
              href="https://aistudio.google.com/apikey"
              rel="noreferrer"
              target="_blank"
            >
              aistudio.google.com/apikey
            </a>
            . Se cifra de forma segura antes de persistirse.
          </p>
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded text-primary focus:ring-primary border-slate-300"
              {...register("isActive")}
            />
            <span>Activar Agente de WhatsApp (responder automáticamente 24/7)</span>
          </label>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
          <span>Configuración guardada.</span>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">save</span>
          <span>{submitting ? "Guardando..." : "Guardar Configuración"}</span>
        </button>
      </div>
    </form>
  );
}
