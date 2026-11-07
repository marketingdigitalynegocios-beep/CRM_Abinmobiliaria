import { env } from "cloudflare:workers";
import { forbidden, requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getTenantForTenant, updateTenantForTenant } from "@/lib/db/tenant-scope";
import { jsonError, validationError } from "@/lib/http";
import { updateAgencySchema } from "@/lib/validations/agency";

export async function GET(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const db = getDb(env.DB);
  const tenant = await getTenantForTenant(db, session.tenantId);
  if (!tenant) return jsonError("Inmobiliaria no encontrada", 404);

  return Response.json({ tenant });
}

/** Solo admin (ver blueprint §9: /dashboard/settings/agency y /dashboard/website son "Sí (admin)"). */
export async function PATCH(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();
  if (session.role !== "admin") return forbidden();

  const body = await request.json();
  const parsed = updateAgencySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  const tenant = await updateTenantForTenant(db, session.tenantId, parsed.data);
  if (!tenant) return jsonError("Inmobiliaria no encontrada", 404);

  return Response.json({ tenant });
}
