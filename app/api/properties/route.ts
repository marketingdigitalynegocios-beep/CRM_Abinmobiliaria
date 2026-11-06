import { env } from "cloudflare:workers";
import { forbidden, requireSession, unauthorized } from "../../../lib/auth/session";
import { getDb } from "../../../lib/db/client";
import { createPropertyForTenant, listPropertiesForTenant } from "../../../lib/db/tenant-scope";
import { jsonError, validationError } from "../../../lib/http";
import { createPropertySchema } from "../../../lib/validations/property";

export async function GET(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const url = new URL(request.url);
  const db = getDb(env.DB);

  const result = await listPropertiesForTenant(db, session.tenantId, {
    type: url.searchParams.get("type") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    operation: url.searchParams.get("operation") ?? undefined,
    ownerId: url.searchParams.get("owner_id") ?? undefined,
    visibility: url.searchParams.get("visibility") ?? undefined,
    internalCode: url.searchParams.get("internal_code") ?? undefined,
    page: Number(url.searchParams.get("page") ?? "1"),
    limit: Number(url.searchParams.get("limit") ?? "20"),
  });

  return Response.json(result);
}

export async function POST(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();
  if (session.role !== "admin" && session.role !== "advisor") return forbidden();

  const body = await request.json();
  const parsed = createPropertySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  try {
    const property = await createPropertyForTenant(db, session.tenantId, parsed.data);
    return Response.json({ property }, { status: 201 });
  } catch (error) {
    // UNIQUE(tenant_id, internal_code) — ver blueprint §6
    if (String(error).includes("UNIQUE") || String(error).includes("constraint")) {
      return jsonError("El código interno ya está en uso en esta inmobiliaria", 409);
    }
    throw error;
  }
}
