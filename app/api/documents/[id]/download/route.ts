import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getDocumentForTenant } from "@/lib/db/tenant-scope";
import { jsonError } from "@/lib/http";

/**
 * Streamea el objeto de R2 de vuelta solo si el documento pertenece al tenant
 * de la sesión — nunca hay una URL pública directa del bucket (ver
 * cloudflare.config.ts).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const { id } = await params;
  const db = getDb(env.DB);
  const document = await getDocumentForTenant(db, session.tenantId, id);
  if (!document) return jsonError("Documento no encontrado", 404);

  const object = await env.DOCUMENTS.get(document.storageKey);
  if (!object) return jsonError("El archivo ya no está disponible en el almacenamiento", 410);

  return new Response(object.body, {
    headers: {
      "Content-Type": document.contentType,
      "Content-Disposition": `attachment; filename="${document.fileName}"`,
      "Content-Length": String(document.sizeBytes),
    },
  });
}
