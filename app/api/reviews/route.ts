import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { createReviewForTenant, listReviewsForTenant } from "@/lib/db/tenant-scope";
import { jsonError, validationError } from "@/lib/http";
import { createReviewSchema } from "@/lib/validations/review";

export async function GET(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const db = getDb(env.DB);
  const reviews = await listReviewsForTenant(db, session.tenantId);
  return Response.json({ reviews });
}

export async function POST(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = createReviewSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  const review = await createReviewForTenant(db, session.tenantId, parsed.data);
  if (!review) return jsonError("Propiedad no encontrada en este tenant", 404);

  return Response.json({ review }, { status: 201 });
}
