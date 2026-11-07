import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { env } from "cloudflare:workers";
import { getDb } from "../db/client";
import * as schema from "../db/schema";
import { sendEmail } from "../email/resend";

/**
 * Better Auth se construye por request, nunca como singleton a nivel de
 * módulo: el binding D1 (`env.DB`) solo existe dentro del contexto de un
 * request de Workers — no se puede capturar en una variable de módulo creada
 * al cargar el archivo. `env` viene de `cloudflare:workers` (API nativa del
 * runtime, respaldada por AsyncLocalStorage), así que no hace falta pasarlo
 * a mano por cada Route Handler. Ver bitacora-desarrollo.md, entrada de Fase 1.
 */
export function getAuth() {
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
        sendMagicLink: async ({ email, url }) => {
          await sendEmail(
            {
              to: email,
              subject: "Tu enlace para ingresar",
              html: `
                <p>Hola,</p>
                <p>Haz clic en el siguiente enlace para ingresar a tu cuenta. El enlace expira en unos minutos.</p>
                <p><a href="${url}">Ingresar</a></p>
                <p>Si no pediste este enlace, puedes ignorar este mensaje.</p>
              `,
            },
            env
          );
        },
      }),
    ],
  });
}
