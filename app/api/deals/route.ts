import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { createDealForTenant, listDealsForTenant } from "@/lib/db/tenant-scope";
import { jsonError, validationError } from "@/lib/http";
import { createDealSchema } from "@/lib/validations/deal";

export async function GET(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const url = new URL(request.url);
  const db = getDb(env.DB);
  const dealsForTenant = await listDealsForTenant(db, session.tenantId, {
    stage: url.searchParams.get("stage") ?? undefined,
    leadId: url.searchParams.get("lead_id") ?? undefined,
    propertyId: url.searchParams.get("property_id") ?? undefined,
  });

  return Response.json({ deals: dealsForTenant, total: dealsForTenant.length });
}

export async function POST(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = createDealSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  const deal = await createDealForTenant(db, session.tenantId, parsed.data);
  if (!deal) return jsonError("El lead o la propiedad no existen en este tenant", 404);

  return Response.json({ deal }, { status: 201 });
}
