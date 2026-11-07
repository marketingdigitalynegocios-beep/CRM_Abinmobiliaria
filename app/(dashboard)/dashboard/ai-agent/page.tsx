import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getAiAgentConfigForTenant } from "@/lib/db/tenant-scope";
import { AiAgentForm } from "@/components/dashboard/AiAgentForm";
import { WhatsAppConnectButton } from "@/components/dashboard/WhatsAppConnectButton";

export const metadata: Metadata = { title: "Agente de WhatsApp" };

export default async function AiAgentPage() {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const db = getDb(env.DB);
  const config = await getAiAgentConfigForTenant(db, session.tenantId);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-dark">Agente de WhatsApp</h1>
      <p className="mt-1 text-sm text-gray">
        Conecta tu número y configura el agente de IA que responde a tus clientes 24/7.
      </p>

      <div className="mt-6 rounded-md border border-border bg-white p-4">
        <h2 className="text-sm font-semibold text-dark">Número de WhatsApp</h2>
        {config?.whatsappPhoneNumberId ? (
          <p className="mt-2 text-sm text-gray">
            Conectado: <span className="font-medium text-dark">{config.whatsappDisplayNumber ?? config.whatsappPhoneNumberId}</span>
          </p>
        ) : (
          <div className="mt-3">
            <WhatsAppConnectButton />
          </div>
        )}
      </div>

      <div className="mt-6">
        <AiAgentForm
          hasGeminiKey={Boolean(config?.geminiKeyEnc)}
          initialValues={{
            isActive: config?.isActive ?? false,
            systemPrompt: config?.systemPrompt ?? "",
            welcomeMessage: config?.welcomeMessage ?? "",
          }}
        />
      </div>
    </div>
  );
}
