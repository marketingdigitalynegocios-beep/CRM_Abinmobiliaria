/**
 * Validación server-side de Cloudflare Turnstile (ver blueprint §7/§11,
 * "nuevo en v1.2" — protección del formulario público de leads). Las claves
 * de prueba de Cloudflare (`1x00000000000000000000AA` / secreto
 * `1x0000000000000000000000000000000AA`) siempre pasan, sin necesitar una
 * cuenta real — eso es lo que se usa en `.dev.vars` mientras no se
 * aprovisiona Cloudflare de verdad.
 */
export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
  remoteIp?: string
): Promise<boolean> {
  const form = new FormData();
  form.set("secret", secretKey);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });

  const json = (await res.json()) as { success: boolean };
  return json.success === true;
}
