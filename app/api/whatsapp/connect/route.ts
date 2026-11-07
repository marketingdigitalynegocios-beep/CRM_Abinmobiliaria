import { env } from "cloudflare:workers";
import { forbidden, requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { saveWhatsappConnectionForTenant } from "@/lib/db/tenant-scope";
import { jsonError, validationError } from "@/lib/http";
import { exchangeEmbeddedSignupCode, subscribeWabaToApp } from "@/lib/whatsapp/embedded-signup";
import { connectWhatsappSchema } from "@/lib/validations/whatsapp";

/**
 * Conecta el número de WhatsApp de un tenant (ver blueprint §7/§11). Solo
 * obtiene `waba_id`/`phone_number_id` y suscribe el webhook — no guarda
 * ningún token por tenant (se usa el System User Token único, ver §15
 * riesgo 10).
 */
export async function POST(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();
  if (session.role !== "admin") return forbidden();

  const body = await request.json();
  const parsed = connectWhatsappSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { code, wabaId, phoneNumberId, displayPhoneNumber } = parsed.data;

  try {
    // NEXT_PUBLIC_META_APP_ID es una var de build-time (igual que en el
    // cliente), no un binding de cloudflare.config.ts — por eso se lee de
    // process.env y no de `env` (cloudflare:workers).
    const accessToken = await exchangeEmbeddedSignupCode(
      code,
      process.env.NEXT_PUBLIC_META_APP_ID!,
      env.META_APP_SECRET
    );
    await subscribeWabaToApp(wabaId, accessToken);
  } catch (error) {
    return jsonError("No se pudo completar la conexión con Meta", 502, String(error));
  }

  const db = getDb(env.DB);
  const config = await saveWhatsappConnectionForTenant(db, session.tenantId, {
    whatsappWabaId: wabaId,
    whatsappPhoneNumberId: phoneNumberId,
    whatsappDisplayNumber: displayPhoneNumber,
  });

  return Response.json({
    whatsapp_phone_number_id: config?.whatsappPhoneNumberId,
    whatsapp_display_number: config?.whatsappDisplayNumber,
  });
}
