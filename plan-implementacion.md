# PLAN DE IMPLEMENTACIÓN — SaaS Inmobiliario
**Basado en:** `blueprint-saas-inmobiliario.md` v1.5
**Estado:** `BORRADOR` → cambiar a `APROBADO` cuando esté revisado

> Este documento define el **orden de trabajo** (fases, dependencias, criterios de salida) y las **reglas no negociables** del desarrollo. El progreso real, las decisiones del día a día y los bloqueos se registran en `bitacora-desarrollo.md`, no acá — este archivo es el plan, no el diario.

---

## 0. Antes de escribir código

Hay 4 cosas del blueprint que bloquean el arranque y deben resolverse primero (son los riesgos 1, 3, 9 y 10 de la sección 15 del blueprint):

| # | Qué confirmar | Por qué bloquea | Dueño |
|---|---|---|---|
| 1 | ~~Compatibilidad de vinext~~ — **RESUELTO 2026-11-06:** `create-vinext-app` funciona y el build de producción corre sin errores | — | — |
| 5 | Confirmar versión de Node en la máquina/CI que vaya a correr comandos de `cf` (crear D1, secrets, deploy): `cf@1.0.0-beta.28` pide `^22.23.0 \| ^24.22.0 \| ^26.12.0`, y el entorno de prueba tenía v24.12.0 (por debajo del mínimo) | Comandos de `cf` podrían fallar o comportarse distinto si Node no cumple el rango | — |
| 2 | Plan de Cloudflare que habilita Cloudflare Images y su costo | Si no se confirma, el módulo de fotos (Fase 1) no tiene dónde apoyarse | — |
| 3 | Con la app Tech Provider ya existente: ¿el token de WhatsApp Cloud API por tenant es de larga duración o hay que convertirlo a token de usuario de sistema? | Si no se resuelve, el agente de WhatsApp (Fase 3) deja de responder cuando el token expira, en silencio | — |
| 4 | Estrategia de *message templates* para la ventana de 24h de Meta | Sin esto, cualquier mensaje proactivo del agente fuera de la ventana de 24h simplemente falla | — |

**Regla:** no se empieza la Fase 3 (WhatsApp) sin tener 3 y 4 resueltos y anotados en `bitacora-desarrollo.md`. Las fases 0, 1 y 2 no dependen de esto y pueden avanzar en paralelo a esa confirmación.

---

## 1. Fases y orden de trabajo

### Fase 0 — Fundaciones (infraestructura + aislamiento multitenant)
**No se escribe un solo endpoint de dominio antes de terminar esta fase.**

- [x] Scaffold del proyecto (`create-vinext-app --platform cloudflare --image-optimization cloudflare-images`), build de producción verificado, repo git inicializado con primer commit (2026-11-06)
- [ ] `cf d1 create` real contra una cuenta de Cloudflare (requiere login del usuario — pendiente de su lado), cuenta de Cloudflare Images confirmada con plan/costo, cuenta Turnstile
- [x] Schema completo en Drizzle (14 tablas: 10 de dominio + 4 de Better Auth) + primera migración (`drizzle/migrations/0000_kind_speed.sql`, con los mismos CHECK del blueprint §6) + binding `DB: bindings.d1({ name: "saas-inmobiliario-db" })` en `cloudflare.config.ts` (2026-11-06)
- [x] Better Auth configurado (`lib/auth/auth.ts`: adapter Drizzle/D1, `additionalFields` para `tenantId`/`role`/`phone`/`isActive`, factory por request) — pendiente conectar `sendMagicLink` a Resend en Fase 2 (2026-11-06)
- [x] `lib/crypto.ts` — encrypt/decrypt con Web Crypto (AES-GCM), con test unitario (2026-11-06)
- [x] `lib/db/tenant-scope.ts` — capa obligatoria de acceso a datos por tenant (cubre `properties` y `leads` como referencia del patrón; el resto de tablas se agrega tabla por tabla en Fase 1/2) (2026-11-06)
- [x] **Prueba automatizada de aislamiento multitenant:** 4 casos en `tests/tenant-scope.test.ts`, corriendo contra SQLite real (better-sqlite3 + la misma migración de drizzle-kit), sin necesitar un binding D1/Miniflare (2026-11-06)

**Criterio de salida:** se puede crear un tenant + usuario admin, loguearse, y la prueba de aislamiento multitenant pasa en CI/local. **Cumplido en lo que depende del código** (`npm test` pasa, `npm run build` pasa); queda pendiente solo el aprovisionamiento real en una cuenta de Cloudflare (`cf d1 create`, login, migración aplicada a D1 real) antes de dar la Fase 0 por completamente cerrada — eso requiere credenciales del usuario, no es un paso que se pueda automatizar desde acá.

### Fase 1 — Inventario de Propiedades + Catálogo público
- [x] Backend de onboarding: `POST /api/register` (crea tenant + usuario admin en un solo request, con rollback manual si Better Auth rechaza el sign-up) + catch-all de Better Auth (`/api/auth/[...all]`) (2026-11-06)
- [ ] UI de onboarding (formulario de registro) y de `/dashboard/settings/agency` (editar logo/colores/slug ya creado) — falta
- [x] Backend del CRUD de `properties` (`GET/POST /api/properties`, `PATCH/DELETE /api/properties/[id]`), con `owner_id`, `internal_code`, `listing_type`, mandato, `visibility`, probado contra SQLite real (2026-11-06)
- [x] Backend del CRUD de `property_owners` (2026-11-06)
- [x] `POST /api/upload` — mint de Direct Creator Upload URL de Cloudflare Images (2026-11-06). **Falta el componente `ImageUploader.tsx`** (drag & drop + llamar a este endpoint desde el cliente)
- [x] `PATCH /api/properties/bulk-status`, `POST /api/properties/bulk-import` (CSV, con `papaparse` + validación Zod de dos pasos) (2026-11-06)
- [ ] Página pública `/[slug]` (catálogo filtrable) y `/[slug]/property/[id]` (detalle, galería, mapa) — falta
- [ ] Páginas del dashboard (`/dashboard/properties`, `/new`, `/[id]/edit`, `/owners`) — falta

**Criterio de salida:** una inmobiliaria publica 5+ propiedades reales por el flujo normal (sin tocar la base de datos a mano), y un CSV de prueba con 20 filas se importa correctamente. **Backend completo y probado** (ver bitacora-desarrollo.md); falta toda la UI (onboarding, dashboard, catálogo público) para que el criterio se cumpla de punta a punta.

### Fase 2 — CRM (Leads + Deals)
- [ ] Formulario público de contacto con Turnstile → `POST /api/leads`
- [ ] Lista/ficha de leads, calificación (`new/contacted/disqualified`)
- [ ] `DealForm` / `DealCard` / `KanbanBoard` sobre `deals`
- [ ] `visits` + `VisitScheduler` (opcionalmente ligada a un `deal_id`)
- [ ] Notificaciones por Resend (nuevo lead, visita confirmada)

**Criterio de salida:** un lead entra por el formulario público, el admin lo califica, abre un deal sobre una propiedad, lo mueve en el kanban y agenda una visita — todo sin intervención manual en la base de datos.

### Fase 3 — Agente de WhatsApp (gate: ver sección 0)
- [ ] Botón "Conectar WhatsApp" (Embedded Signup) + `POST /api/whatsapp/connect`
- [ ] Webhook `GET/POST /api/webhooks/whatsapp` (verificación + firma + enrutamiento por `phone_number_id`)
- [ ] Integración Gemini (contexto de propiedades activas + respuesta)
- [ ] Definir y dejar aprobados ante Meta al menos los *message templates* necesarios para el `welcome_message`

**Criterio de salida:** un mensaje real de WhatsApp a un número conectado en modo prueba recibe respuesta del agente con información de propiedades reales del tenant.

### Fase 4 — Billing
- [ ] Widget Wompi + `POST /api/webhooks/wompi` (validación HMAC con Web Crypto)
- [ ] Gating de funcionalidades por `subscriptions.plan`/`status`

**Criterio de salida:** un pago en sandbox de Wompi actualiza `subscriptions` end-to-end.

### Fase 5 — Pulido para "Done"
- [ ] Meta tags SEO en páginas públicas (`title`, `description`, `og:image`, `og:title`)
- [ ] Invitación de asesores (`/dashboard/settings/team`) sobre el flujo de invitación de Better Auth
- [ ] QA end-to-end contra los 15 criterios de done del blueprint (§13)
- [ ] Revisar que los 13 puntos de la sección 15 del blueprint estén resueltos o explícitamente diferidos con nota
- [ ] Pasar `blueprint-saas-inmobiliario.md` y este plan de `BORRADOR` a `APROBADO`

> Wompi (Fase 4) no tiene dependencias de las fases 1–3 más allá de tener tenants/usuarios creados; si se necesita validar pricing con un cliente piloto antes, se puede adelantar justo después de la Fase 0.

---

## 2. Reglas no negociables

1. **Aislamiento multitenant primero, siempre.** Ninguna query a `properties`, `property_owners`, `leads`, `deals`, `visits`, `lead_property_interests`, `ai_agent_configs` o `subscriptions` se escribe sin pasar por `lib/db/tenant-scope.ts`. El `tenant_id` nunca se acepta del body/query de un request — siempre se resuelve server-side desde la sesión o desde el `slug`.
2. **Dinero siempre en enteros (centavos).** Nunca floats para `price_cents`, `deal_value_cents`, `budget_min_cents`/`budget_max_cents`, `commission_percentage` es la única excepción explícita (es un porcentaje, no dinero).
3. **Secretos solo vía `wrangler secret put` (producción) o `.dev.vars` (local).** Nunca hardcodeados, nunca commiteados. `.dev.vars` va en `.gitignore` desde el primer commit.
4. **Todo cambio de schema pasa por `drizzle-kit` (migración versionada).** Nada de `ALTER TABLE` manual contra D1 de producción.
5. **Toda decisión que se aparte del blueprint se documenta en los dos lugares:** se sube la versión de `blueprint-saas-inmobiliario.md` con su nota de changelog (igual que se ha hecho de v1.1 a v1.5), y se registra la fecha/motivo en `bitacora-desarrollo.md`. Un cambio de arquitectura que solo vive en la cabeza de quien lo hizo no cuenta como decisión tomada.
6. **No se abre una fase nueva sin cerrar el criterio de salida de la anterior** (sección 1 de este documento). Si hace falta adelantar algo por una razón de negocio, se anota explícitamente en la bitácora por qué se rompe el orden.
7. **Todo endpoint nuevo valida con Zod en el borde** (request body) y, si toca una tabla de dominio, tiene al menos un caso de prueba de aislamiento multitenant (tenant A no ve/edita datos de tenant B).
8. **Un gap identificado y diferido (como los de la revisión de `houzez-crm`) se anota con número en la sección 15 del blueprint — nunca se descarta en silencio.** Si en algún momento deja de ser relevante, se marca como resuelto/descartado con una línea explicando por qué, no se borra sin dejar rastro.
9. **Git:** commits pequeños y descriptivos; una rama por fase o por feature grande. No se hace `--force` ni se reescribe historia compartida sin pedirlo explícitamente.

---

## 3. Cómo usar este documento junto con los otros dos

- `blueprint-saas-inmobiliario.md` — **qué** se construye (arquitectura, schema, contratos de API, decisiones y sus porqués). Se versiona (v1.1, v1.2, …) cada vez que cambia algo de fondo.
- `plan-implementacion.md` (este archivo) — **en qué orden** se construye y **qué reglas** aplican mientras se construye. Se actualiza cuando cambia el plan de fases, no con el día a día.
- `bitacora-desarrollo.md` — **qué pasó, cuándo y por qué**, sesión a sesión. Es el único de los tres que se espera que crezca constantemente; no se reescribe el pasado, se agrega al final.
