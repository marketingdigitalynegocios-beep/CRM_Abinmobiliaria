import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { getDb } from "../db/client";
import * as schema from "../db/schema";

export interface AuthEnv {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  NEXT_PUBLIC_APP_URL: string;
}

/**
 * Better Auth se construye por request, nunca como singleton a nivel de
 * módulo: el binding D1 (`env.DB`) solo existe dentro del contexto de un
 * request de Workers — no se puede capturar en una variable de módulo creada
 * al cargar el archivo. Ver bitacora-desarrollo.md, entrada de Fase 0.
 *
 * `sendMagicLink` queda sin implementar por ahora (placeholder): el envío real
 * por Resend es trabajo de la Fase 2 (notificaciones), no de la Fase 0.
 */
export function getAuth(env: AuthEnv) {
  const db = getDb(env.DB);

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.NEXT_PUBLIC_APP_URL,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
      // D1 no soporta transacciones interactivas; las operaciones del adapter
      // se ejecutan secuencialmente en vez de envueltas en una transacción.
      transaction: false,
    }),
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        tenantId: { type: "string", required: false },
        role: { type: "string", required: false, defaultValue: "advisor" },
        phone: { type: "string", required: false },
        isActive: { type: "boolean", required: false, defaultValue: true },
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async () => {
          throw new Error(
            "sendMagicLink no implementado todavía — se conecta a Resend en la Fase 2 (ver plan-implementacion.md)"
          );
        },
      }),
    ],
  });
}
