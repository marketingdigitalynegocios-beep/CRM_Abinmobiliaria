import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { deleteTaskForTenant, updateTaskForTenant } from "@/lib/db/tenant-scope";
import { jsonError, validationError } from "@/lib/http";
import { updateTaskSchema } from "@/lib/validations/task";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  const task = await updateTaskForTenant(db, session.tenantId, id, parsed.data);
  if (!task) return jsonError("Tarea no encontrada", 404);

  return Response.json({ task });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const { id } = await params;
  const db = getDb(env.DB);
  const deleted = await deleteTaskForTenant(db, session.tenantId, id);
  if (!deleted) return jsonError("Tarea no encontrada", 404);

  return new Response(null, { status: 204 });
}
