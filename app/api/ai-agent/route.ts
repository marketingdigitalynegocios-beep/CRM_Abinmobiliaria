import { env } from "cloudflare:workers";
import { forbidden, requireSession, unauthorized } from "@/lib/auth/session";
import { encrypt } from "@/lib/crypto";
import { getDb } from "@/lib/db/client";
import { getAiAgentConfigForTenant, upsertAiAgentConfigForTenant } from "@/lib/db/tenant-scope";
import { validationError } from "@/lib/http";
import { updateAiAgentConfigSchema } from "@/lib/validations/whatsapp";

/** Solo admin (ver blueprint §9). `geminiKeyEnc` nunca se devuelve al cliente. */
export async function GET(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();
  if (session.role !== "admin") return forbidden();

  const db = getDb(env.DB);
  const config = await getAiAgentConfigForTenant(db, session.tenantId);

  return Response.json({
    config: config
      ? {
          isActive: config.isActive,
          systemPrompt: config.systemPrompt,
          welcomeMessage: config.welcomeMessage,
          hasGeminiKey: Boolean(config.geminiKeyEnc),
          whatsappWabaId: config.whatsappWabaId,
          whatsappPhoneNumberId: config.whatsappPhoneNumberId,
          whatsappDisplayNumber: config.whatsappDisplayNumber,
        }
      : null,
  });
}

export async function PUT(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();
  if (session.role !== "admin") return forbidden();

  const body = await request.json();
  const parsed = updateAiAgentConfigSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { geminiKey, ...rest } = parsed.data;
  const db = getDb(env.DB);

  const config = await upsertAiAgentConfigForTenant(db, session.tenantId, {
    ...rest,
    ...(geminiKey ? { geminiKeyEnc: await encrypt(geminiKey, env.ENCRYPTION_KEY) } : {}),
  });

  return Response.json({
    config: {
      isActive: config.isActive,
      systemPrompt: config.systemPrompt,
      welcomeMessage: config.welcomeMessage,
      hasGeminiKey: Boolean(config.geminiKeyEnc),
    },
  });
}
