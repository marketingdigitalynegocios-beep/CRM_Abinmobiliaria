import { env } from "cloudflare:workers";
import { requireSession, unauthorized } from "@/lib/auth/session";
import { buildGoogleAuthUrl } from "@/lib/google-calendar";

/** Redirige al consentimiento OAuth2 real de Google — ver lib/google-calendar.ts. */
export async function GET(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) return unauthorized();

  const state = crypto.randomUUID();
  const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar/callback`;
  const authUrl = buildGoogleAuthUrl(env.GOOGLE_CLIENT_ID, redirectUri, state);

  const response = Response.redirect(authUrl, 302);
  const headers = new Headers(response.headers);
  headers.append(
    "Set-Cookie",
    `gcal_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );
  return new Response(null, { status: 302, headers });
}
