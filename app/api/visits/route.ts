import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { createVisitForTenant, listVisitsForTenant } from "@/lib/db/tenant-scope";
import { jsonError, validationError } from "@/lib/http";
import { createVisitSchema } from "@/lib/validations/visit";

export async function GET(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const db = getDb(env.DB);
  const visitsForTenant = await listVisitsForTenant(db, session.tenantId);
  return Response.json({ visits: visitsForTenant, total: visitsForTenant.length });
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

  return Response.json({ visit }, { status: 201 });
}
