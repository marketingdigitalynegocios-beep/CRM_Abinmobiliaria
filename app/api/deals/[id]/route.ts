import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { updateDealForTenant } from "@/lib/db/tenant-scope";
import { jsonError, validationError } from "@/lib/http";
import { updateDealSchema } from "@/lib/validations/deal";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const parsed = updateDealSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  const deal = await updateDealForTenant(db, session.tenantId, id, parsed.data);
  if (!deal) return jsonError("Deal no encontrado", 404);

  return Response.json({ deal });
}
