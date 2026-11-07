/**
 * Integración con Google Calendar vía OAuth2 (Fase 10, ver
 * plan-implementacion.md §1-bis) — `fetch` directo a las APIs reales de
 * Google, mismo patrón que `lib/whatsapp/embedded-signup.ts` y
 * `lib/ai/agent.ts` (nunca un SDK pesado, para no arriesgar compatibilidad
 * con el runtime de Workers).
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export function buildGoogleAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

export async function exchangeGoogleAuthCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as GoogleTokenResponse;
  if (!res.ok) {
    throw new Error(`Google respondió ${res.status}: ${json.error_description ?? json.error ?? "error desconocido"}`);
  }
  return json;
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as GoogleTokenResponse;
  if (!res.ok) {
    throw new Error(`Google respondió ${res.status}: ${json.error_description ?? json.error ?? "error desconocido"}`);
  }
  return json;
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  input: { summary: string; description?: string; startIso: string; endIso: string }
): Promise<{ id: string; htmlLink: string }> {
  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.startIso },
        end: { dateTime: input.endIso },
      }),
    }
  );
  const json = (await res.json()) as { id: string; htmlLink: string; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(`Google Calendar respondió ${res.status}: ${json.error?.message ?? "error desconocido"}`);
  }
  return json;
}
