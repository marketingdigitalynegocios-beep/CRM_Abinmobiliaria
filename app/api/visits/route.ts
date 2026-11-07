import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { decrypt, encrypt } from "@/lib/crypto";
import { getDb, type Db } from "@/lib/db/client";
import {
  createVisitForTenant,
  getGoogleCalendarConnectionForUser,
  getLeadForTenant,
  getPropertyForTenant,
  listVisitsForTenant,
  saveGoogleCalendarConnectionForUser,
} from "@/lib/db/tenant-scope";
import { createGoogleCalendarEvent, refreshGoogleAccessToken } from "@/lib/google-calendar";
import { jsonError, validationError } from "@/lib/http";
import { createVisitSchema } from "@/lib/validations/visit";

export async function GET(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const db = getDb(env.DB);
  const visitsForTenant = await listVisitsForTenant(db, session.tenantId);
  return Response.json({ visits: visitsForTenant, total: visitsForTenant.length });
}

/**
 * Mejor esfuerzo: si el asesor de la visita conectó su Google Calendar (Fase
 * 10), se crea el evento allá. Un fallo acá nunca tumba la creación de la
 * visita — mismo criterio que el agente de WhatsApp en el webhook.
 */
async function trySyncVisitToGoogleCalendar(
  db: Db,
  tenantId: string,
  advisorId: string,
  visit: { scheduledAt: string; leadId: string; propertyId: string }
) {
  const connection = await getGoogleCalendarConnectionForUser(db, tenantId, advisorId);
  if (!connection) return;

  try {
    let accessToken = await decrypt(connection.accessTokenEnc, env.ENCRYPTION_KEY);
    if (new Date(connection.expiresAt).getTime() <= Date.now()) {
      const refreshToken = await decrypt(connection.refreshTokenEnc, env.ENCRYPTION_KEY);
      const refreshed = await refreshGoogleAccessToken(
        refreshToken,
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET
      );
      accessToken = refreshed.access_token;
      await saveGoogleCalendarConnectionForUser(db, tenantId, advisorId, {
        accessTokenEnc: await encrypt(accessToken, env.ENCRYPTION_KEY),
        refreshTokenEnc: connection.refreshTokenEnc,
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      });
    }

    const [lead, property] = await Promise.all([
      getLeadForTenant(db, tenantId, visit.leadId),
      getPropertyForTenant(db, tenantId, visit.propertyId),
    ]);

    const start = new Date(visit.scheduledAt);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    await createGoogleCalendarEvent(accessToken, connection.calendarId, {
      summary: `Visita: ${property?.title ?? "propiedad"} — ${lead?.fullName ?? "cliente"}`,
      description: `Visita agendada desde el CRM con ${lead?.fullName ?? "el cliente"}.`,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    });
  } catch (error) {
    console.error("No se pudo sincronizar la visita con Google Calendar:", error);
  }
}

export async function POST(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = createVisitSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  const visit = await createVisitForTenant(db, session.tenantId, parsed.data);

  if (visit === null) return jsonError("Lead, propiedad o deal no encontrados en este tenant", 404);
  if (visit === "conflict") return jsonError("El asesor ya tiene una visita en esa franja", 409);

  if (visit.advisorId) {
    await trySyncVisitToGoogleCalendar(db, session.tenantId, visit.advisorId, visit);
  }

  return Response.json({ visit }, { status: 201 });
}
