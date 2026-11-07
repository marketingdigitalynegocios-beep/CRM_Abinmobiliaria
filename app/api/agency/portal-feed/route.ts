import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getOrCreatePortalFeedToken } from "@/lib/db/tenant-scope";

export async function GET(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const db = getDb(env.DB);
  const token = await getOrCreatePortalFeedToken(db, session.tenantId);

  return Response.json({
    feedUrl: token ? `${env.NEXT_PUBLIC_APP_URL}/api/portals/feed/${token}` : null,
  });
}
