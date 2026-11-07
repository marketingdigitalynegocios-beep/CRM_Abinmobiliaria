import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { deleteDocumentForTenant } from "@/lib/db/tenant-scope";
import { jsonError } from "@/lib/http";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const { id } = await params;
  const db = getDb(env.DB);
  const deleted = await deleteDocumentForTenant(db, session.tenantId, id);
  if (!deleted) return jsonError("Documento no encontrado", 404);

  await env.DOCUMENTS.delete(deleted.storageKey);
  return new Response(null, { status: 204 });
}
