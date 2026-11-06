import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "../../../lib/auth/session";
import { getDb } from "../../../lib/db/client";
import { createPropertyOwnerForTenant, listPropertyOwnersForTenant } from "../../../lib/db/tenant-scope";
import { validationError } from "../../../lib/http";
import { createPropertyOwnerSchema } from "../../../lib/validations/property-owner";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorized();

  const url = new URL(request.url);
  const db = getDb(env.DB);
  const owners = await listPropertyOwnersForTenant(
    db,
    session.tenantId,
    url.searchParams.get("search") ?? undefined
  );

  return Response.json({ owners, total: owners.length });
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = createPropertyOwnerSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  const owner = await createPropertyOwnerForTenant(db, session.tenantId, parsed.data);
  return Response.json({ owner }, { status: 201 });
}
