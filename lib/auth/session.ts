import { getAuth } from "./auth";

/**
 * Resuelve la sesión autenticada a partir de los headers de la request (los
 * de un Route Handler, `request.headers`, o los de un Server Component vía
 * `headers()` de `next/headers` — ambos son `Headers`). El `tenantId` que
 * devuelve es el único que cualquier endpoint o página debe usar — nunca uno
 * que venga del body/query del request (ver blueprint §6, "Aislamiento
 * multitenant: sin RLS, forzado en código").
 */
export async function requireSession(headers: Headers) {
  const auth = getAuth();
  const result = await auth.api.getSession({ headers });

  if (!result?.session || !result.user) {
    return null;
  }

  const tenantId = (result.user as { tenantId?: string | null }).tenantId;
  if (!tenantId) {
    // Usuario autenticado pero sin tenant asignado todavía (no debería pasar
    // fuera del flujo de registro) — se trata igual que "sin sesión válida"
    // para no filtrar nada por accidente.
    return null;
  }

  return {
    user: result.user,
    session: result.session,
    tenantId,
    role: (result.user as { role?: string }).role ?? "advisor",
  };
}

export function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

export function forbidden() {
  return new Response("Forbidden", { status: 403 });
}
