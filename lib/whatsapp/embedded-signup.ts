const GRAPH_API_VERSION = "v21.0";

/**
 * Intercambia el `code` que devuelve el SDK de Embedded Signup por un access
 * token (de corta duración — no se guarda, ver blueprint §11). Se usa solo
 * para el siguiente paso: suscribir el WABA a los webhooks de la app.
 */
export async function exchangeEmbeddedSignupCode(
  code: string,
  appId: string,
  appSecret: string
): Promise<string> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);

  const res = await fetch(url);
  const json = (await res.json()) as { access_token?: string; error?: { message: string } };

  if (!res.ok || !json.access_token) {
    throw new Error(`No se pudo intercambiar el code de Embedded Signup: ${json.error?.message ?? res.statusText}`);
  }

  return json.access_token;
}

/**
 * Suscribe un WABA a los webhooks de la app Tech Provider — sin esto, Meta
 * nunca manda mensajes entrantes de ese número a `/api/webhooks/whatsapp`.
 */
export async function subscribeWabaToApp(wabaId: string, accessToken: string): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/subscribed_apps`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`No se pudo suscribir el WABA a la app: ${res.status} ${body}`);
  }
}
