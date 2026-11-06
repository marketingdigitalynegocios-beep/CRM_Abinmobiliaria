import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "../../../../lib/auth/session";
import { getDb } from "../../../../lib/db/client";
import { bulkUpdatePropertyStatusForTenant } from "../../../../lib/db/tenant-scope";
import { validationError } from "../../../../lib/http";
import { bulkStatusSchema } from "../../../../lib/validations/property";

export async function PATCH(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = bulkStatusSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  const updated = await bulkUpdatePropertyStatusForTenant(
    db,
    session.tenantId,
    parsed.data.propertyIds,
    { status: parsed.data.status, visibility: parsed.data.visibility }
  );

  return Response.json({ updated });
}
