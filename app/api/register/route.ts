import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getAuth } from "../../../lib/auth/auth";
import { getDb } from "../../../lib/db/client";
import { tenants } from "../../../lib/db/schema";
import { jsonError, validationError } from "../../../lib/http";
import { registerSchema } from "../../../lib/validations/agency";

/**
 * Registro combinado (ver blueprint §2): crea el tenant y el usuario admin en
 * el mismo request. El tenant se crea primero y se revierte si Better Auth
 * rechaza el sign-up (ej. email duplicado) — D1 no soporta transacciones
 * interactivas (ver lib/auth/auth.ts), así que esto es un rollback manual de
 * dos pasos, no atómico a nivel de motor. Aceptable para el MVP; si falla
 * justo el DELETE de rollback, queda un tenant huérfano sin usuarios — raro,
 * pero documentado acá en vez de ignorado.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { fullName, email, password, agencyName, slug } = parsed.data;
  const db = getDb(env.DB);

  const existingTenant = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (existingTenant.length > 0) {
    return jsonError("Ese slug ya está en uso", 409);
  }

  const tenantId = crypto.randomUUID();
  await db.insert(tenants).values({ id: tenantId, slug, name: agencyName });

  const auth = getAuth();
  let signUpResponse: Response;
  try {
    signUpResponse = await auth.api.signUpEmail({
      body: { email, password, name: fullName, tenantId, role: "admin" },
      asResponse: true,
    });
  } catch (error) {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    return jsonError("No se pudo crear la cuenta", 400, String(error));
  }

  if (!signUpResponse.ok) {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }

  return signUpResponse;
}
