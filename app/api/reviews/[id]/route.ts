import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { deleteReviewForTenant, updateReviewForTenant } from "@/lib/db/tenant-scope";
import { jsonError, validationError } from "@/lib/http";
import { updateReviewSchema } from "@/lib/validations/review";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const parsed = updateReviewSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  const review = await updateReviewForTenant(db, session.tenantId, id, parsed.data);
  if (!review) return jsonError("Reseña no encontrada", 404);

  return Response.json({ review });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const { id } = await params;
  const db = getDb(env.DB);
  const deleted = await deleteReviewForTenant(db, session.tenantId, id);
  if (!deleted) return jsonError("Reseña no encontrada", 404);

  return new Response(null, { status: 204 });
}
