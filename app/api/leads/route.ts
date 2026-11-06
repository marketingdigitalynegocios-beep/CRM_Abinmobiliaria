import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { createLeadForTenant, getLeadsForTenant, getTenantBySlug } from "@/lib/db/tenant-scope";
import { jsonError, validationError } from "@/lib/http";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { createLeadSchema, createManualLeadSchema } from "@/lib/validations/lead";

export async function GET(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const url = new URL(request.url);
  const db = getDb(env.DB);
  const leads = await getLeadsForTenant(db, session.tenantId, url.searchParams.get("stage") ?? undefined);

  return Response.json({ leads, total: leads.length });
}

/**
 * Dos caminos (ver blueprint §7):
 * - Con sesión: alta manual desde el dashboard (`source: 'manual'`), sin Turnstile.
 * - Sin sesión: formulario público de contacto, protegido con Turnstile.
 *   `tenantSlug` solo sirve para resolver el `tenant_id` server-side; nunca
 *   se confía en un `tenant_id` directo del body.
 */
export async function POST(request: Request) {
  const session = await requireSession(request.headers);
  const body = await request.json();
  const db = getDb(env.DB);

  if (session) {
    const parsed = createManualLeadSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const lead = await createLeadForTenant(db, session.tenantId, {
      ...parsed.data,
      source: "manual",
    });
    return Response.json({ lead }, { status: 201 });
  }

  const parsed = createLeadSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const turnstileOk = await verifyTurnstileToken(
    parsed.data.turnstileToken,
    env.TURNSTILE_SECRET_KEY,
    request.headers.get("cf-connecting-ip") ?? undefined
  );
  if (!turnstileOk) return jsonError("Verificación anti-spam inválida", 403);

  const tenant = await getTenantBySlug(db, parsed.data.tenantSlug);
  if (!tenant) return jsonError("Inmobiliaria no encontrada", 404);

  const lead = await createLeadForTenant(
    db,
    tenant.id,
    {
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      whatsapp: parsed.data.whatsapp,
      source: parsed.data.source,
    },
    parsed.data.propertyId
  );

  return Response.json({ lead }, { status: 201 });
}
