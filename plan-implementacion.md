# PLAN DE IMPLEMENTACIÓN — SaaS Inmobiliario
**Basado en:** `blueprint-saas-inmobiliario.md` v1.7
**Estado:** `BORRADOR` → cambiar a `APROBADO` cuando esté revisado

> Este documento define el **orden de trabajo** (fases, dependencias, criterios de salida) y las **reglas no negociables** del desarrollo. El progreso real, las decisiones del día a día y los bloqueos se registran en `bitacora-desarrollo.md`, no acá — este archivo es el plan, no el diario.

---

## 0. Antes de escribir código

De las 5 cosas que bloqueaban el arranque, quedan 2 abiertas (ver bitacora-desarrollo.md, entrada 2026-11-07, para el detalle de cómo se resolvieron 3 y 4):

| # | Qué confirmar | Por qué bloquea | Dueño |
|---|---|---|---|
| 1 | ~~Compatibilidad de vinext~~ — **RESUELTO 2026-11-06:** `create-vinext-app` funciona y el build de producción corre sin errores | — | — |
| 2 | Plan de Cloudflare que habilita Cloudflare Images y su costo | Si no se confirma, el módulo de fotos (Fase 1) no tiene dónde apoyarse en producción (en local ya funciona sin esto configurado) | — |
| 3 | ~~Token de WhatsApp por tenant~~ — **RESUELTO 2026-11-07:** se usa un System User Token único a nivel de app (`META_SYSTEM_USER_TOKEN`), no el token por tenant del Embedded Signup. Ver blueprint §11/§14/§15 (riesgo 10) | — | — |
| 4 | ~~Message templates para la ventana de 24h~~ — **RESUELTO 2026-11-07 para el alcance del MVP:** el agente solo responde a mensajes entrantes, siempre dentro de ventana; no hay mensajes proactivos por WhatsApp en el MVP. Ver blueprint §15 (riesgo 11) | — | — |
| 5 | Confirmar versión de Node en la máquina/CI que vaya a correr comandos de `cf` (crear D1, secrets, deploy): `cf@1.0.0-beta.28` pide `^22.23.0 \| ^24.22.0 \| ^26.12.0`, y el entorno de prueba tenía v24.12.0 (por debajo del mínimo) | Comandos de `cf` podrían fallar o comportarse distinto si Node no cumple el rango | — |

**La Fase 4 (WhatsApp) ya no tiene ningún bloqueador externo pendiente** — queda de última en el orden (ver §1) por decisión del usuario, no porque siga frenada. Sigue habiendo un paso manual recurrente (asignar cada WABA nuevo al usuario de sistema en Meta Business Manager cuando un tenant se conecta), documentado en el blueprint §11, no en esta sección porque no bloquea nada, es una tarea operativa de cada conexión.

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
- [x] Onboarding: `POST /api/register` (crea tenant + usuario admin en un solo request) + páginas `/register` y `/login` + catch-all de Better Auth (2026-11-06)
- [ ] `/dashboard/settings/agency` (editar logo/colores/slug ya creado) — queda para cuando se construya el módulo de Settings (fuera del alcance estricto de "Inventario de Propiedades")
- [x] CRUD de `properties` completo (backend + dashboard: lista, crear, editar, eliminar, marcar vendida) con `owner_id`, `internal_code`, `listing_type`, mandato, `visibility` (2026-11-06)
- [x] CRUD de `property_owners` completo (backend + dashboard) (2026-11-06)
- [x] `ImageUploader.tsx` (drag & drop con `react-dropzone`, sube directo a Cloudflare Images vía `POST /api/upload`) — integrado en `PropertyForm` para la foto de portada (2026-11-06)
- [x] `PATCH /api/properties/bulk-status`, `POST /api/properties/bulk-import` (CSV) — **probado en vivo contra D1 local** (ver bitácora), no solo con tests unitarios (2026-11-06)
- [x] Página pública `/[slug]` (catálogo filtrable por tipo/operación) y `/[slug]/property/[id]` (detalle, galería con `react-photo-view`, mapa con `react-leaflet`, botón de WhatsApp directo) (2026-11-06)
- [x] Páginas del dashboard (`/dashboard/properties`, `/new`, `/[id]/edit`, `/owners`, `/owners/new`, `/owners/[id]/edit`) (2026-11-06)

**Criterio de salida: CUMPLIDO Y VERIFICADO EN VIVO (2026-11-06).** Se corrió `npm run dev` (vinext + D1 local vía Miniflare), se aplicó la migración directo al `.sqlite` que Miniflare persiste en `.cloudflare/state/`, y se ejecutó el flujo real con `curl`: registro → tenant creado con usuario admin → crear propiedad vía API → aparece en `/[slug]` y en `/[slug]/property/[id]` → crear propietario → importar 2 propiedades por CSV (`bulk-import`) → marcar una como vendida (`bulk-status`) y el badge "Vendida" aparece en la página pública. Pendiente real: hacerlo clic a clic desde el navegador (hasta ahora se verificó por API/curl, no con el mouse) y, por supuesto, repetirlo contra una cuenta de Cloudflare real en vez de la simulación local de Miniflare.

### Fase 2 — CRM (Leads + Deals)
- [x] Formulario público de contacto con Turnstile → `POST /api/leads` — probado en vivo con las claves de prueba públicas de Cloudflare (2026-11-06)
- [x] Lista/ficha de leads, calificación (`new/contacted/disqualified`), alta manual desde el dashboard (2026-11-06)
- [x] `DealForm` / `DealCard` / `KanbanColumn` / `KanbanBoard` sobre `deals`, drag & drop con `@hello-pangea/dnd` (2026-11-06)
- [x] `visits` + `VisitScheduler` (opcionalmente ligada a un `deal_id`), con detección simple de conflicto de agenda (2026-11-06)
- [ ] Notificaciones por Resend (nuevo lead, visita confirmada) — diferido, ver nota abajo

**Criterio de salida: CUMPLIDO Y VERIFICADO EN VIVO (2026-11-06).** Contra el mismo D1 local de la Fase 1: lead público con Turnstile → lead manual desde el dashboard → calificar lead → abrir deal sobre una propiedad → moverlo de etapa (`PATCH /api/deals/[id]`, lo que hace el drag & drop del kanban) → agendar visita ligada al deal. Todo verificado con `curl` contra las páginas y endpoints reales, más 9 tests unitarios nuevos (aislamiento multitenant en leads/deals/visits, idempotencia de intereses, conflicto de agenda).

**Nota de alcance:** las notificaciones por Resend (nuevo lead, visita confirmada) se dejaron fuera de esta pasada — no bloquean el criterio de salida tal como está escrito, y Resend ya está instalado como dependencia desde la Fase 1 pero sin una API key real para probarlo en vivo. Se puede agregar como una mejora incremental sin tocar el resto del CRM.

### Fase 3 — Pulido para "Done"
> **Reordenada (2026-11-07):** pasa a ser la siguiente fase activa. El uso real hoy es **interno, de una sola inmobiliaria** (no un SaaS multitenant vendido a terceros todavía), así que Billing deja de ser lo que sigue — ver Fase 5 más abajo.

- [x] Diseño/UX básico: fuentes Inter/Urbanist cargadas de verdad (antes declaradas en CSS pero nunca importadas), `<title>`/`lang="es"` reales en vez del placeholder del scaffold, títulos por página en el dashboard, limpieza de clases `slate-*` sueltas a los tokens del blueprint §12 (2026-11-07) — **verificado en vivo**
- [x] Los 3 templates de página pública (`modern`/`classic`/`minimal`, blueprint §12) con selector en `/dashboard/website` (incluye preview por iframe) — **verificado en vivo**: se registró un tenant, se cambió de template y se confirmó que el catálogo y el detalle público cambian de diseño en cada uno (2026-11-07)
- [x] `/dashboard/settings/agency` (editar nombre/logo/colores/contacto/descripción del tenant ya creado — quedó pendiente de la Fase 1) + `GET/PATCH /api/agency` (solo admin) — **verificado en vivo** (2026-11-07)
- [x] Meta tags SEO en páginas públicas (`title`, `description`, `og:image`, `og:title`) — catálogo y detalle de propiedad, ambos con `title: { absolute: ... }` para no heredar el template de título del dashboard (`%s · SaaS Inmobiliario`) en el sitio público de cada tenant — **verificado en vivo**, incluyendo el bug real que se encontró y corrigió (título heredado antes de la corrección) (2026-11-07)
- [x] Invitación de asesores (`/dashboard/settings/team`): cuenta creada directo dentro del tenant (contraseña aleatoria que nunca se usa) + magic link por Resend para entrar sin contraseña — **verificado en vivo** (creación de cuenta, bloqueo de email duplicado con 409); el envío real del email no se pudo probar sin una `RESEND_API_KEY` real, pero el manejo de ese error sí se verificó (no tumba la invitación completa) (2026-11-07)
- [x] `sendMagicLink` de Better Auth implementado de verdad con Resend (antes placeholder que lanzaba error) — login sin contraseña ahora funciona en `/login` (2026-11-07)
- [x] Landing del SaaS (`app/page.tsx`): reemplazado el placeholder del scaffold de vinext por una landing real (hero, features, CTA a `/register`/`/login`), fiel al blueprint §9 (2026-11-07)
- [x] QA end-to-end contra los 15 criterios de done del blueprint (§13) — **hecho (2026-11-07): 11 cumplidos y verificados en vivo, 2 parciales (#10/#11, bloqueados solo por no tener credenciales reales de Meta/Gemini), 1 diferido a propósito (#12, Wompi), 1 pendiente del usuario (#14, deploy real a Cloudflare)** — tabla completa en blueprint §13
- [x] Revisar los 13 puntos de la sección 15 del blueprint — **hecho (2026-11-07): 9 resueltos y verificados (1, 2, 3, 4, 5, 7, 10, 11, 12), 3 siguen abiertos de verdad (6 backups de D1, 8 límite de tamaño de D1, 9 plan de Cloudflare Images — los tres son decisiones de cuenta/infraestructura, no código pendiente), 1 diferido a v2 a propósito (13)**
- [ ] Conseguir una `RESEND_API_KEY` real y probar el envío de verdad (invitación de equipo + magic link de login) — **diferido a pedido del usuario junto con Billing**, no bloquea nada de lo demás

**Criterio de salida: CUMPLIDO (2026-11-07).** La página pública tiene SEO correcto (verificado en vivo, con un bug real encontrado y corregido), el admin puede invitar asesores y editar los datos de su inmobiliaria, y el MVP pasa el QA end-to-end salvo Billing (diferido, ver Fase 5) y Resend (diferido junto con Billing).

### Fase 4 — Agente de WhatsApp
> Ya no está bloqueada (ver §0): se resolvió el diseño del token (System User Token único, `META_SYSTEM_USER_TOKEN`) y de la ventana de 24h (el MVP solo responde, nunca escribe primero) auditando una integración Tech Provider propia ya en producción.

- [x] Secret `META_SYSTEM_USER_TOKEN` declarado en `cloudflare.config.ts` — **falta que el usuario lo genere a mano en Meta Business Manager** (usuario de sistema Admin, permisos `whatsapp_business_management`/`whatsapp_business_messaging`) y lo cargue con `cf workers secrets update` cuando aprovisione Cloudflare de verdad (2026-11-07)
- [x] Botón "Conectar WhatsApp" (Embedded Signup, `WhatsAppConnectButton.tsx`) + `POST /api/whatsapp/connect` — solo obtiene `waba_id`/`phone_number_id` (del evento `postMessage` del SDK) y los guarda; no guarda ningún token por tenant (2026-11-07)
- [x] Webhook `GET/POST /api/webhooks/whatsapp` (handshake de verificación + firma `X-Hub-Signature-256` con Web Crypto + enrutamiento por `phone_number_id`) — **verificado en vivo**: firma válida acepta, firma inválida rechaza con 401, `phone_number_id` desconocido responde 200 OK sin romper (2026-11-07)
- [x] Integración Gemini (`lib/ai/agent.ts`: contexto de propiedades activas + `fetch` directo a la API real de Gemini) — **verificado en vivo contra la API real** (confirmado con un error real de "API key inválida", no un mock) (2026-11-07)
- [x] `/dashboard/ai-agent`: conectar WhatsApp, configurar `system_prompt`/`welcome_message`/Gemini key (cifrada, nunca se devuelve en texto plano — verificado leyendo la DB directamente), y "probar el agente" sin tocar WhatsApp (2026-11-07)
- [x] Quitado `whatsapp_access_token_enc` del schema de `ai_agent_configs` y regenerada la migración (`0000_minor_shotgun.sql`) (2026-11-07)
- [x] 5 tests unitarios de la verificación de firma del webhook (válida, secret equivocado, body alterado, sin header, header mal formado) — lógica pura, sin necesitar D1 ni Meta real (2026-11-07)

**Criterio de salida: PARCIAL — construido, type-checked y verificado contra las APIs reales de Meta y Gemini (ambas devuelven errores reales de credenciales inválidas, no mocks ni timeouts), pero falta un número de WhatsApp real conectado para confirmar el envío de punta a punta.** Eso requiere que el usuario tenga a mano su cuenta de Meta Business Manager (`NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_CONFIG_ID`, `META_APP_SECRET`, `META_SYSTEM_USER_TOKEN` reales) — no es código por escribir, es una cuenta externa por conectar, igual que Cloudflare en la Fase 0.

### Fase 5 — Billing (DIFERIDA, no bloqueante)
> **Diferida (2026-11-07) a pedido del usuario:** el CRM se va a usar primero para la propia empresa (un solo tenant), no como SaaS cobrado a otras inmobiliarias todavía. Cobrar una suscripción no resuelve nada en ese escenario. Se deja el diseño documentado (Wompi, tabla `subscriptions` ya en el schema desde la Fase 0) para no tener que rediseñar nada si más adelante se decide vender esto a otras inmobiliarias — la arquitectura multitenant ya está puesta, agregar el cobro no toca el resto del sistema.

- [ ] Widget Wompi + `POST /api/webhooks/wompi` (validación HMAC con Web Crypto)
- [ ] Gating de funcionalidades por `subscriptions.plan`/`status`

**Criterio de salida (cuando se retome):** un pago en sandbox de Wompi actualiza `subscriptions` end-to-end.

> Wompi no tiene dependencias de las fases 1–4 más allá de tener tenants/usuarios creados — se puede retomar en cualquier momento sin reabrir nada de lo ya construido.

> **Pendiente final, una vez se retome o se decida descartar Billing de forma definitiva:** pasar `blueprint-saas-inmobiliario.md` y este plan de `BORRADOR` a `APROBADO`.

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
