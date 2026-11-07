import { env } from "cloudflare:workers";
import { getDb } from "@/lib/db/client";
import { decrypt } from "@/lib/crypto";
import { generateAgentReply } from "@/lib/ai/agent";
import { findLeadByPhoneForTenant, getAiAgentConfigByPhoneNumberId, recordWhatsappMessage } from "@/lib/db/tenant-scope";
import { sendWhatsappMessage, verifyMetaWebhookSignature } from "@/lib/whatsapp/graph-client";

/**
 * Handshake de verificación que Meta exige al registrar la URL del webhook
 * (ver blueprint §7). Una sola URL a nivel de app cubre todos los tenants.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

interface WhatsappWebhookPayload {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: { from?: string; text?: { body?: string } }[];
      };
    }[];
  }[];
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureOk = await verifyMetaWebhookSignature(
    rawBody,
    request.headers.get("x-hub-signature-256"),
    env.META_APP_SECRET
  );
  if (!signatureOk) return new Response("Unauthorized", { status: 401 });

  const payload = JSON.parse(rawBody) as WhatsappWebhookPayload;
  const change = payload.entry?.[0]?.changes?.[0]?.value;
  const incomingMessage = change?.messages?.[0];

  // No es un mensaje de texto entrante (ej. un recibo de entrega/lectura) —
  // no hay nada que responder.
  if (!incomingMessage?.text?.body || !incomingMessage.from || !change?.metadata?.phone_number_id) {
    return new Response("OK", { status: 200 });
  }

  const phoneNumberId = change.metadata.phone_number_id;
  const from = incomingMessage.from;
  const message = incomingMessage.text.body;

  const db = getDb(env.DB);
  const config = await getAiAgentConfigByPhoneNumberId(db, phoneNumberId);

  // Sin config activa para este número — no se responde, pero igual se
  // confirma 200 (evitar que Meta reintente indefinidamente).
  if (!config?.isActive || !config.geminiKeyEnc) {
    return new Response("OK", { status: 200 });
  }

  // El lead es opcional: un número que escribe por primera vez no tiene lead
  // todavía, y el mensaje se guarda igual (ver plan-implementacion.md Fase 6,
  // `whatsapp_messages.lead_id` es nullable para este caso).
  const lead = await findLeadByPhoneForTenant(db, config.tenantId, from);

  await recordWhatsappMessage(db, config.tenantId, {
    leadId: lead?.id ?? null,
    phoneNumberId,
    direction: "inbound",
    body: message,
    status: "received",
  });

  try {
    const geminiKey = await decrypt(config.geminiKeyEnc, env.ENCRYPTION_KEY);
    const reply = await generateAgentReply(
      db,
      config.tenantId,
      config.systemPrompt ?? "Eres un asistente de atención al cliente de una inmobiliaria.",
      message,
      geminiKey
    );
    await sendWhatsappMessage(phoneNumberId, from, reply, env.META_SYSTEM_USER_TOKEN);
    await recordWhatsappMessage(db, config.tenantId, {
      leadId: lead?.id ?? null,
      phoneNumberId,
      direction: "outbound",
      body: reply,
      status: "sent",
    });
  } catch (error) {
    // Se loguea pero igual se responde 200 — un error acá no debe hacer que
    // Meta reintente el mismo mensaje en bucle.
    console.error("Error generando/enviando la respuesta del agente de WhatsApp:", error);
  }

  return new Response("OK", { status: 200 });
}
