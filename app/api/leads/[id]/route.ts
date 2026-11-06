import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  getLeadForTenant,
  listDealsForTenant,
  listLeadPropertyInterests,
  updateLeadForTenant,
} from "@/lib/db/tenant-scope";
import { jsonError, validationError } from "@/lib/http";
import { updateLeadSchema } from "@/lib/validations/lead";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const { id } = await params;
  const db = getDb(env.DB);
  const lead = await getLeadForTenant(db, session.tenantId, id);
  if (!lead) return jsonError("Lead no encontrado", 404);

  const [interests, dealsForLead] = await Promise.all([
    listLeadPropertyInterests(db, lead.id),
    listDealsForTenant(db, session.tenantId, { leadId: lead.id }),
  ]);

  return Response.json({ lead, interests, deals: dealsForLead });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const parsed = updateLeadSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  const lead = await updateLeadForTenant(db, session.tenantId, id, parsed.data);
  if (!lead) return jsonError("Lead no encontrado", 404);

  return Response.json({ lead });
}
