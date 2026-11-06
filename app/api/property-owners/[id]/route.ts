import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "../../../../lib/auth/session";
import { getDb } from "../../../../lib/db/client";
import {
  deletePropertyOwnerForTenant,
  updatePropertyOwnerForTenant,
} from "../../../../lib/db/tenant-scope";
import { jsonError, validationError } from "../../../../lib/http";
import { updatePropertyOwnerSchema } from "../../../../lib/validations/property-owner";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(request);
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const parsed = updatePropertyOwnerSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  const owner = await updatePropertyOwnerForTenant(db, session.tenantId, id, parsed.data);
  if (!owner) return jsonError("Propietario no encontrado", 404);
  return Response.json({ owner });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(request);
  if (!session) return unauthorized();

  const { id } = await params;
  const db = getDb(env.DB);
  const result = await deletePropertyOwnerForTenant(db, session.tenantId, id);

  if (!result.deleted) {
    if (result.reason === "has_properties") {
      return jsonError("No se puede borrar: todavía tiene propiedades asociadas", 409);
    }
    return jsonError("Propietario no encontrado", 404);
  }

  return Response.json({ success: true });
}
