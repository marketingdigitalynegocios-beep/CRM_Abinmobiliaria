import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  deleteGoogleCalendarConnectionForUser,
  getGoogleCalendarConnectionForUser,
} from "@/lib/db/tenant-scope";

export async function GET(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const db = getDb(env.DB);
  const connection = await getGoogleCalendarConnectionForUser(db, session.tenantId, session.user.id);

  return Response.json({ connected: Boolean(connection) });
}

export async function DELETE(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const db = getDb(env.DB);
  await deleteGoogleCalendarConnectionForUser(db, session.tenantId, session.user.id);

  return Response.json({ ok: true });
}
