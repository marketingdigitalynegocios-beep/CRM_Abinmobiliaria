import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  countUnreadNotificationsForUser,
  listNotificationsForUser,
  markAllNotificationsReadForUser,
} from "@/lib/db/tenant-scope";

export async function GET(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const db = getDb(env.DB);
  const [items, unread] = await Promise.all([
    listNotificationsForUser(db, session.tenantId, session.user.id),
    countUnreadNotificationsForUser(db, session.tenantId, session.user.id),
  ]);

  return Response.json({ notifications: items, unread });
}

/** Marca todas las notificaciones del usuario como leídas de una vez. */
export async function POST(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const db = getDb(env.DB);
  await markAllNotificationsReadForUser(db, session.tenantId, session.user.id);

  return Response.json({ ok: true });
}
