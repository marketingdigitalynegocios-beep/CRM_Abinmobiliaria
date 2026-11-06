import { env } from "cloudflare:workers";
import { z } from "zod";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { addLeadPropertyInterest } from "@/lib/db/tenant-scope";
import { jsonError, validationError } from "@/lib/http";

const addInterestSchema = z.object({ propertyId: z.string().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const parsed = addInterestSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  const result = await addLeadPropertyInterest(db, session.tenantId, id, parsed.data.propertyId);
  if (!result) return jsonError("Lead o propiedad no encontrados en este tenant", 404);

  return Response.json({ success: true });
}
