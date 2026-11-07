import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { createTaskForTenant, listTasksForTenant } from "@/lib/db/tenant-scope";
import { validationError } from "@/lib/http";
import { createTaskSchema } from "@/lib/validations/task";

export async function GET(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const url = new URL(request.url);
  const db = getDb(env.DB);
  const taskList = await listTasksForTenant(db, session.tenantId, {
    leadId: url.searchParams.get("leadId") ?? undefined,
    dealId: url.searchParams.get("dealId") ?? undefined,
    status: (url.searchParams.get("status") as "pending" | "done" | null) ?? undefined,
  });

  return Response.json({ tasks: taskList, total: taskList.length });
}

export async function POST(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const body = await request.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const db = getDb(env.DB);
  const task = await createTaskForTenant(db, session.tenantId, parsed.data);

  return Response.json({ task }, { status: 201 });
}
