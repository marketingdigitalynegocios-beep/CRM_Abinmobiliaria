const GRAPH_API_VERSION = "v21.0";

/**
 * Envía un mensaje de texto con la WhatsApp Cloud API. Usa el System User
 * Token único a nivel de app (`env.META_SYSTEM_USER_TOKEN`), no un token por
 * tenant — ver blueprint §11/§14, riesgo 10 (v1.7).
 */
export async function sendWhatsappMessage(
  phoneNumberId: string,
  to: string,
  text: string,
  systemUserToken: string
) {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${systemUserToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        text: { body: text },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp Cloud API respondió ${res.status}: ${body}`);
  }
}

/**
 * Verifica la firma `X-Hub-Signature-256` de un webhook de Meta con Web
 * Crypto (HMAC-SHA256), no con el módulo 'crypto' de Node — ver blueprint §7.
 */
export async function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): Promise<boolean> {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expectedHex = signatureHeader.slice("sha256=".length);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody)
  );
  const computedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computedHex.length !== expectedHex.length) return false;
  // Comparación en tiempo constante — evitar timing attacks sobre la firma.
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) {
    diff |= computedHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}
