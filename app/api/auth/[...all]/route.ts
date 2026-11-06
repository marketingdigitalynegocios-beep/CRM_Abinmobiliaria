import { getAuth } from "../../../../lib/auth/auth";

/**
 * Catch-all de Better Auth (sign-up, sign-in, session, magic-link, etc.).
 * `getAuth()` se llama dentro del handler, no a nivel de módulo, porque
 * necesita el binding D1 vía `cloudflare:workers`, que solo existe dentro del
 * contexto de un request — ver lib/auth/auth.ts.
 */
export async function GET(request: Request) {
  return getAuth().handler(request);
}

export async function POST(request: Request) {
  return getAuth().handler(request);
}
