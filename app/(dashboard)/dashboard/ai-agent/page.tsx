import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getAiAgentConfigForTenant, getLeadsForTenant, getTenantForTenant } from "@/lib/db/tenant-scope";
import { AiAgentForm } from "@/components/dashboard/AiAgentForm";
import { WhatsAppChatSimulator } from "@/components/dashboard/WhatsAppChatSimulator";
import { WhatsAppConnectButton } from "@/components/dashboard/WhatsAppConnectButton";

export const metadata: Metadata = {
  title: "Agente de IA WhatsApp | InmoElite",
};

export default async function AiAgentPage() {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const db = getDb(env.DB);
  const [config, leads, tenant] = await Promise.all([
    getAiAgentConfigForTenant(db, session.tenantId),
    getLeadsForTenant(db, session.tenantId),
    getTenantForTenant(db, session.tenantId),
  ]);
  const isConnected = Boolean(config?.whatsappPhoneNumberId);
  const isActive = isConnected && Boolean(config?.isActive);

  const whatsappLeads = leads.filter((l) => l.source === "whatsapp");
  const whatsappQualified = whatsappLeads.filter((l) => l.stage === "contacted").length;
  const qualificationRate =
    whatsappLeads.length > 0 ? Math.round((whatsappQualified / whatsappLeads.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header & Page Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-dark">
              Agente de Inteligencia Artificial para WhatsApp
            </h1>
            <span className="inline-flex items-center rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 border border-sky-300">
              Gemini 1.5 Pro
            </span>
          </div>
          <p className="mt-1 text-sm text-gray">
            Atención, cualificación y agendamiento inmobiliario 24/7 con integración de inventario sincronizado.
          </p>
        </div>
      </div>

      {/* WhatsApp Cloud API Connection Status Banner */}
      <section
        className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs ${
          isConnected
            ? "border-emerald-300/80 bg-emerald-50/80"
            : "border-amber-300/80 bg-amber-50/80"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            {isConnected && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-3 w-3 rounded-full ${
                isConnected ? "bg-emerald-600" : "bg-amber-500"
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-bold ${isConnected ? "text-emerald-950" : "text-amber-950"}`}
              >
                WhatsApp Business Cloud API:{" "}
                {isConnected ? "Conectado & Operativo" : "Sin conectar"}
              </span>
            </div>
            <span
              className={`text-xs font-medium ${isConnected ? "text-emerald-800" : "text-amber-800"}`}
            >
              {isConnected
                ? `Línea activa: ${config!.whatsappDisplayNumber ?? config!.whatsappPhoneNumberId}`
                : "Conecta tu número de WhatsApp Business para activar el agente."}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isConnected && (
            <div className="flex items-center">
              <WhatsAppConnectButton />
            </div>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold border ${
              isActive
                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                : "bg-gray/10 text-gray border-border"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-gray"}`}
            />
            {isActive ? "Bot Activo 24/7" : "Bot Inactivo"}
          </span>
        </div>
      </section>

      {/* Key Metrics Ribbon — solo datos reales del tenant */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-start justify-between rounded-xl border border-border bg-white p-4 shadow-xs">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray">
              Leads por WhatsApp
            </p>
            <h3 className="mt-1 text-xl font-bold text-dark font-mono">{whatsappLeads.length}</h3>
            <p className="mt-1 text-xs font-medium text-gray">
              de {leads.length} leads totales
            </p>
          </div>
          <div className="rounded-lg bg-blue-50 p-2.5 text-primary border border-blue-100">
            <span className="material-symbols-outlined text-[20px]">chat</span>
          </div>
        </div>

        <div className="flex items-start justify-between rounded-xl border border-border bg-white p-4 shadow-xs">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray">
              Tasa de Contacto (WhatsApp)
            </p>
            <h3 className="mt-1 text-xl font-bold text-dark font-mono">{qualificationRate}%</h3>
            <p className="mt-1 text-xs font-medium text-gray">
              {whatsappQualified} de {whatsappLeads.length} contactados
            </p>
          </div>
          <div className="rounded-lg bg-sky-50 p-2.5 text-sky-700 border border-sky-100">
            <span className="material-symbols-outlined text-[20px]">smart_toy</span>
          </div>
        </div>
      </section>

      <p className="text-xs text-gray -mt-2">
        Métricas de volumen de mensajes, tiempo de respuesta y satisfacción requieren registrar el
        historial de conversaciones del webhook — pendiente, ver plan-implementacion.md.
      </p>

      {/* 2-Column Split: Form (60%) & Live Simulator (40%) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Config Form (7 cols) */}
        <div className="lg:col-span-7">
          <AiAgentForm
            hasGeminiKey={Boolean(config?.geminiKeyEnc)}
            initialValues={{
              isActive: config?.isActive ?? true,
              systemPrompt:
                config?.systemPrompt ||
                `Eres el asistente virtual de ${tenant?.name ?? "la inmobiliaria"}. Tu objetivo es perfilar al cliente (presupuesto, zona, número de habitaciones, compra o arriendo) y recomendar máximo 2 propiedades de nuestro inventario activo. Si el cliente tiene intención alta de compra, solicita agendar visita presencial.`,
              welcomeMessage:
                config?.welcomeMessage ||
                `¡Hola! Soy el asistente virtual de ${tenant?.name ?? "la inmobiliaria"}. ¿En qué tipo de inmueble estás interesado hoy?`,
            }}
          />
        </div>

        {/* Right Column: Live WhatsApp Simulator (5 cols) */}
        <div className="lg:col-span-5">
          <WhatsAppChatSimulator />
        </div>
      </div>
    </div>
  );
}
