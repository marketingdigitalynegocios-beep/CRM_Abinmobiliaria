import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { markNotificationReadForUser } from "@/lib/db/tenant-scope";
import { jsonError } from "@/lib/http";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const { id } = await params;
  const db = getDb(env.DB);
  const notification = await markNotificationReadForUser(db, session.tenantId, session.user.id, id);
  if (!notification) return jsonError("Notificación no encontrada", 404);

  return Response.json({ notification });
}
