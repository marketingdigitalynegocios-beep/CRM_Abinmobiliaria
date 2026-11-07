import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { createDocumentForTenant, listDocumentsForTenant } from "@/lib/db/tenant-scope";
import { jsonError, validationError } from "@/lib/http";
import { uploadDocumentMetaSchema } from "@/lib/validations/document";

const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export async function GET(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const url = new URL(request.url);
  const db = getDb(env.DB);
  const docs = await listDocumentsForTenant(db, session.tenantId, {
    leadId: url.searchParams.get("leadId") ?? undefined,
    dealId: url.searchParams.get("dealId") ?? undefined,
    propertyId: url.searchParams.get("propertyId") ?? undefined,
  });

  return Response.json({
    documents: docs.map((d) => ({ ...d, storageKey: undefined })),
  });
}

/**
 * Subida real: `multipart/form-data` con el archivo + metadata. El archivo
 * se guarda en R2 (`env.DOCUMENTS`), nunca en D1 — la tabla `documents` solo
 * guarda la referencia (ver lib/db/tenant-scope.ts).
 */
export async function POST(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Falta el archivo", 400);
  if (file.size > MAX_SIZE_BYTES) return jsonError("El archivo supera 15MB", 413);

  const parsed = uploadDocumentMetaSchema.safeParse({
    type: form.get("type") ?? undefined,
    leadId: form.get("leadId") ?? undefined,
    dealId: form.get("dealId") ?? undefined,
    propertyId: form.get("propertyId") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  const storageKey = `${session.tenantId}/${crypto.randomUUID()}-${file.name}`;
  const buffer = await file.arrayBuffer();

  // D1 no soporta transacciones interactivas (ver drizzle adapter) — se sube
  // a R2 primero; si la fila falla, se limpia el objeto subido más abajo.
  await env.DOCUMENTS.put(storageKey, buffer, {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  const db = getDb(env.DB);
  const row = await createDocumentForTenant(db, session.tenantId, {
    ...parsed.data,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    storageKey,
    uploadedBy: session.user.id,
  });

  if (!row) {
    // El lead/deal/propiedad referenciado no es de este tenant — no se deja
    // el objeto huérfano en R2.
    await env.DOCUMENTS.delete(storageKey);
    return jsonError("Lead, oportunidad o propiedad no encontrados en este tenant", 404);
  }

  return Response.json({ document: { ...row, storageKey: undefined } }, { status: 201 });
}
