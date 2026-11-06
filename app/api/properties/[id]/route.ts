import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "../../../../lib/auth/session";
import { getDb } from "../../../../lib/db/client";
import {
  deletePropertyForTenant,
  getPropertyForTenant,
  updatePropertyForTenant,
} from "../../../../lib/db/tenant-scope";
import { jsonError, validationError } from "../../../../lib/http";
import { updatePropertySchema } from "../../../../lib/validations/property";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(request);
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const parsed = updatePropertySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  try {
    const property = await updatePropertyForTenant(db, session.tenantId, id, parsed.data);
    if (!property) return jsonError("Propiedad no encontrada", 404);
    return Response.json({ property });
  } catch (error) {
    if (String(error).includes("UNIQUE") || String(error).includes("constraint")) {
      return jsonError("El código interno ya está en uso en esta inmobiliaria", 409);
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(request);
  if (!session) return unauthorized();

  const { id } = await params;
  const db = getDb(env.DB);

  const existing = await getPropertyForTenant(db, session.tenantId, id);
  if (!existing) return jsonError("Propiedad no encontrada", 404);

  await deletePropertyForTenant(db, session.tenantId, id);
  return Response.json({ success: true });
}
