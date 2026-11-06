import { getAuth } from "./auth";

/**
 * Resuelve la sesión autenticada de un request. El `tenantId` que devuelve es
 * el único que cualquier Route Handler debe usar — nunca uno que venga del
 * body o la query del request (ver blueprint-saas-inmobiliario.md §6,
 * "Aislamiento multitenant: sin RLS, forzado en código").
 */
export async function requireSession(request: Request) {
  const auth = getAuth();
  const result = await auth.api.getSession({ headers: request.headers });

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
