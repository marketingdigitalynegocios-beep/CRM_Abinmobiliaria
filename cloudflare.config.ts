import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "saas-inmobiliario",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-06",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      DB: bindings.d1({ name: "saas-inmobiliario-db" }),
      // Documentos/contratos (Fase 9, ver plan-implementacion.md §1-bis) — no
      // son imágenes a transformar, así que van en R2 en vez de Cloudflare
      // Images. Nunca se exponen con una URL pública directa del bucket: se
      // sirven streameados desde `GET /api/documents/[id]/download`, que valida
      // que el documento pertenece al tenant de la sesión antes de leerlo.
      DOCUMENTS: bindings.r2({ name: "saas-inmobiliario-documents" }),

      // Config de runtime del Worker (no hay un binding "var" plano en `cf`
      // todavía — `bindings.secret()` es el mecanismo genérico encontrado para
      // inyectar strings en env; ninguno de estos es sensible aparte del valor
      // real que se cargue). Valores reales con `cf workers secrets update`.
      NEXT_PUBLIC_APP_URL: bindings.secret(),

      // Secrets reales (ver blueprint-saas-inmobiliario.md §10)
      WOMPI_PRIVATE_KEY: bindings.secret(),
      WOMPI_EVENTS_SECRET: bindings.secret(),
      GEMINI_API_KEY: bindings.secret(),
      RESEND_API_KEY: bindings.secret(),
      RESEND_FROM_EMAIL: bindings.secret(),
      META_APP_SECRET: bindings.secret(),
      META_WEBHOOK_VERIFY_TOKEN: bindings.secret(),
      // System User Token único a nivel de app (ver blueprint §11/§14, v1.7) —
      // se genera a mano una sola vez en Meta Business Manager, no por tenant.
      META_SYSTEM_USER_TOKEN: bindings.secret(),
      ENCRYPTION_KEY: bindings.secret(),
      BETTER_AUTH_SECRET: bindings.secret(),
      CLOUDFLARE_IMAGES_API_TOKEN: bindings.secret(),
      CLOUDFLARE_ACCOUNT_ID: bindings.secret(),
      TURNSTILE_SECRET_KEY: bindings.secret(),

      // Sincronización con Google Calendar por asesor (Fase 10, ver
      // plan-implementacion.md §1-bis) — credenciales OAuth2 de un proyecto en
      // Google Cloud Console, pendientes de que el usuario las genere (mismo
      // patrón de bloqueo externo que Meta/Gemini en la Fase 4).
      GOOGLE_CLIENT_ID: bindings.secret(),
      GOOGLE_CLIENT_SECRET: bindings.secret(),
    },
  }),
});
