import { env } from "cloudflare:workers";
import { forbidden, requireSession, unauthorized } from "@/lib/auth/session";
import { generateAgentReply } from "@/lib/ai/agent";
import { decrypt } from "@/lib/crypto";
import { getDb } from "@/lib/db/client";
import { getAiAgentConfigForTenant, recordWhatsappMessage } from "@/lib/db/tenant-scope";
import { jsonError, validationError } from "@/lib/http";
import { testAiAgentSchema } from "@/lib/validations/whatsapp";

/**
 * Prueba el agente sin tocar WhatsApp — solo llama a Gemini y devuelve la
 * respuesta, para que el admin pueda ajustar el `system_prompt` antes de
 * activarlo (ver blueprint §8, `AIAgentConfig.tsx`: `testMessage`/`testResponse`).
 */
export async function POST(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();
  if (session.role !== "admin") return forbidden();

  const body = await request.json();
  const parsed = testAiAgentSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  const config = await getAiAgentConfigForTenant(db, session.tenantId);
  if (!config?.geminiKeyEnc) {
    return jsonError("Configura tu Gemini key antes de probar el agente", 400);
  }

  // Sin número de WhatsApp conectado todavía, el simulador usa un
  // `phoneNumberId` fijo para que sus mensajes igual queden en el historial
  // (la columna es NOT NULL, ver lib/db/schema/domain.ts).
  const phoneNumberId = config.whatsappPhoneNumberId ?? "simulador";

  try {
    const geminiKey = await decrypt(config.geminiKeyEnc, env.ENCRYPTION_KEY);
    await recordWhatsappMessage(db, session.tenantId, {
      phoneNumberId,
      direction: "inbound",
      body: parsed.data.message,
      status: "received",
    });

    const reply = await generateAgentReply(
      db,
      session.tenantId,
      config.systemPrompt ?? "Eres un asistente de atención al cliente de una inmobiliaria.",
      parsed.data.message,
      geminiKey
    );

    await recordWhatsappMessage(db, session.tenantId, {
      phoneNumberId,
      direction: "outbound",
      body: reply,
      status: "sent",
    });

    return Response.json({ reply });
  } catch (error) {
    return jsonError("No se pudo generar la respuesta", 502, String(error));
  }
}
