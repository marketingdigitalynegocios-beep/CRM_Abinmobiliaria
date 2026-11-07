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
  initialValues: { isActive: boolean; systemPrompt: string; welcomeMessage: string };
  hasGeminiKey: boolean;
}

const inputClass =
  "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "mb-1 block text-sm font-medium text-dark";

export function AiAgentForm({ initialValues, hasGeminiKey }: AiAgentFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const { register, handleSubmit } = useForm<AiAgentFormValues>({
    defaultValues: { ...initialValues, geminiKey: "" },
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
        setError(body.error ?? "No se pudo guardar");
        return;
      }
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTest() {
    if (!testMessage) return;
    setIsTesting(true);
    setTestError(null);
    setTestResponse(null);
    try {
      const res = await fetch("/api/ai-agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: testMessage }),
      });
      const body = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (!res.ok) {
        setTestError(body.error ?? "No se pudo probar el agente");
        return;
      }
      setTestResponse(body.reply ?? "");
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <label className="flex items-center gap-2 text-sm font-medium text-dark">
          <input type="checkbox" {...register("isActive")} />
          Agente activo (responde mensajes entrantes de WhatsApp)
        </label>

        <div>
          <label className={labelClass} htmlFor="geminiKey">
            Gemini API key {hasGeminiKey && <span className="text-xs text-success">(ya configurada)</span>}
          </label>
          <input
            className={inputClass}
            id="geminiKey"
            placeholder={hasGeminiKey ? "••••••••  (déjalo vacío para no cambiarla)" : "AIza..."}
            type="password"
            {...register("geminiKey")}
          />
          <p className="mt-1 text-xs text-gray">
            Se obtiene gratis en{" "}
            <a className="text-primary" href="https://aistudio.google.com/apikey" rel="noreferrer" target="_blank">
              aistudio.google.com/apikey
            </a>
            .
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="systemPrompt">
            Instrucciones del agente
          </label>
          <textarea
            className={inputClass}
            id="systemPrompt"
            placeholder="Eres el asistente de atención de [inmobiliaria]. Responde preguntas sobre las propiedades disponibles..."
            rows={5}
            {...register("systemPrompt")}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="welcomeMessage">
            Mensaje de bienvenida
          </label>
          <input className={inputClass} id="welcomeMessage" {...register("welcomeMessage")} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {saved && <p className="text-sm text-success">Guardado.</p>}

        <div>
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>

      <div className="rounded-md border border-border bg-light-gray/50 p-4">
        <h3 className="text-sm font-semibold text-dark">Probar el agente</h3>
        <p className="mt-1 text-xs text-gray">
          Simula un mensaje de cliente — esto no manda nada por WhatsApp, solo prueba la respuesta de Gemini.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            className={inputClass}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="¿Tienen apartamentos en venta en Laureles?"
            value={testMessage}
          />
          <button
            className="shrink-0 rounded-md bg-dark px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            disabled={isTesting || !testMessage}
            onClick={handleTest}
            type="button"
          >
            {isTesting ? "Probando..." : "Probar"}
          </button>
        </div>
        {testError && <p className="mt-2 text-sm text-danger">{testError}</p>}
        {testResponse && (
          <p className="mt-3 rounded-md border border-border bg-white p-3 text-sm text-dark">{testResponse}</p>
        )}
      </div>
    </div>
  );
}
