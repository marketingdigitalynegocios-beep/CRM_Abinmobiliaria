import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { encrypt } from "@/lib/crypto";
import { getDb } from "@/lib/db/client";
import { saveGoogleCalendarConnectionForUser } from "@/lib/db/tenant-scope";
import { exchangeGoogleAuthCode } from "@/lib/google-calendar";

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function GET(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readCookie(request, "gcal_oauth_state");

  const settingsUrl = `${env.NEXT_PUBLIC_APP_URL}/dashboard/calendar`;

  if (!code || !state || !expectedState || state !== expectedState) {
    return Response.redirect(`${settingsUrl}?gcal_error=estado_invalido`, 302);
  }

  const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar/callback`;

  try {
    const tokens = await exchangeGoogleAuthCode(
      code,
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    if (!tokens.refresh_token) {
      return Response.redirect(`${settingsUrl}?gcal_error=sin_refresh_token`, 302);
    }

    const db = getDb(env.DB);
    await saveGoogleCalendarConnectionForUser(db, session.tenantId, session.user.id, {
      accessTokenEnc: await encrypt(tokens.access_token, env.ENCRYPTION_KEY),
      refreshTokenEnc: await encrypt(tokens.refresh_token, env.ENCRYPTION_KEY),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    });

    return Response.redirect(`${settingsUrl}?gcal_connected=1`, 302);
  } catch (error) {
    return Response.redirect(
      `${settingsUrl}?gcal_error=${encodeURIComponent(String(error))}`,
      302
    );
  }
}
