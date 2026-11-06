import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { updateVisitForTenant } from "@/lib/db/tenant-scope";
import { jsonError, validationError } from "@/lib/http";
import { updateVisitSchema } from "@/lib/validations/visit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const parsed = updateVisitSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  const visit = await updateVisitForTenant(db, session.tenantId, id, parsed.data);
  if (!visit) return jsonError("Visita no encontrada", 404);

  return Response.json({ visit });
}
