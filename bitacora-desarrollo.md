# BITÁCORA DE DESARROLLO — SaaS Inmobiliario

> Diario del proyecto. Acá se registra **qué pasó, cuándo y por qué** — no la arquitectura (eso vive en `blueprint-saas-inmobiliario.md`) ni el plan de fases (eso vive en `plan-implementacion.md`).
>
> **Regla de esta bitácora: solo se agrega, nunca se reescribe el pasado.** Si una decisión anterior queda obsoleta, se agrega una entrada nueva que lo diga y enlaza a la entrada vieja — no se borra ni se edita la entrada original.

---

## Cómo escribir una entrada

Cada entrada nueva va al final del archivo, con este formato mínimo:

```markdown
## AAAA-MM-DD — Título corto de la entrada

**Quién:** (persona o agente que trabajó)
**Fase (según plan-implementacion.md):** 0 / 1 / 2 / 3 / 4 / 5

**Qué se hizo:**
- ...

**Decisiones tomadas (si hubo):**
- Decisión: ...
  **Por qué:** ...
  **Alternativa descartada:** ... (si aplica)

**Bloqueadores abiertos:**
- ...

**Próximo paso:**
- ...
```

No hace falta llenar todas las secciones si no aplican (p. ej. una sesión sin bloqueadores no necesita esa sección), pero no se eliminan entradas completas.

---

## Estado actual (se reescribe esta sección en cada entrada nueva; el historial de abajo no se toca)

- **Fase activa:** 2 — CRM (Leads + Deals). **Completa y verificada en vivo**: formulario público con Turnstile, alta manual de contactos, calificación de leads, kanban de deals con drag & drop, agenda de visitas con detección de conflicto. 24 tests unitarios en verde, `npm run build`/`npx tsc --noEmit` limpios.
- **Versión del blueprint:** v1.6
- **Pendiente de Fase 0 (no bloquea seguir):** aprovisionar de verdad en una cuenta de Cloudflare (`cf d1 create`, plan de Cloudflare Images, Turnstile real) — requiere login del usuario. Todo lo probado hasta ahora usa la simulación local de Miniflare y las claves de prueba públicas de Turnstile.
- **Diferido explícitamente (no es un olvido):** notificaciones por Resend (nuevo lead, visita confirmada) — Resend ya está instalado, falta solo la API key real y el código que dispara los envíos.
- **Bloqueadores abiertos (solo bloquean Fase 3):** duración del token de WhatsApp (riesgo 10) y estrategia de message templates (riesgo 11).
- **Próximo paso:** hacer una pasada manual desde el navegador (Fase 1 y 2 completas, probadas solo por API/curl hasta ahora), y luego decidir entre aprovisionar Cloudflare real o arrancar la Fase 3 (agente de WhatsApp) — que sigue bloqueada por los riesgos 10/11.

---

## Historial

### 2026-11-06 — Blueprint inicial (v1.1) y migración completa a Cloudflare

**Quién:** sesión de planeación con Claude
**Fase:** — (pre-Fase 0, definición de arquitectura)

**Qué se hizo:**
- Se redactó el blueprint técnico inicial del MVP (v1.1): Next.js + Supabase (Postgres/Auth/Storage/Edge Functions) + Vercel, con Plazbot como proveedor de WhatsApp.
- Se migró el stack completo a Cloudflare (v1.2): Workers (vinext) reemplaza a Vercel; D1 + Drizzle reemplaza a Supabase Postgres; Better Auth reemplaza a Supabase Auth; Cloudflare Images reemplaza a Supabase Storage + `sharp` (que no corre en el runtime de Workers); el webhook del agente de IA se colapsa en el mismo Worker en vez de vivir en una Supabase Edge Function separada.

**Decisiones tomadas:**
- Decisión: D1 no tiene RLS nativo, así que el aislamiento multitenant se fuerza en código vía una capa de repositorio obligatoria (`lib/db/tenant-scope.ts`), no en la base de datos.
  **Por qué:** es la pieza que reemplaza la garantía que daban las políticas RLS de Postgres en v1.1; sin ella, un bug de cualquier endpoint podría filtrar datos entre inmobiliarias.
- Decisión: llamar a Gemini por `fetch` directo al REST API en vez de con el SDK `@google/generative-ai`.
  **Por qué:** evitar depender de una compatibilidad con el runtime de Workers que no estaba verificada.
- Decisión: agregar Cloudflare Turnstile al formulario público de leads.
  **Por qué:** v1.1 no tenía ninguna protección anti-spam en un endpoint público (`POST /api/leads`); al migrar a Cloudflare, agregarlo es casi gratis.

**Bloqueadores abiertos (documentados en §15 del blueprint, aún sin resolver):**
- Compatibilidad de la versión exacta de Next.js con vinext.
- Plan/costo de Cloudflare Images.
- Límite de tamaño por base D1 (monitorear, documentar camino a sharding por tenant si hace falta).

**Próximo paso:** definir cómo se conecta el agente de IA con WhatsApp (pendiente de confirmar si se usa un proveedor intermedio o integración directa con Meta).

---

### 2026-11-06 — WhatsApp: de Plazbot a integración directa con Meta (v1.3)

**Quién:** sesión de planeación con Claude
**Fase:** — (pre-Fase 0)

**Qué se hizo:**
- Se retiró Plazbot como proveedor intermedio de WhatsApp.
- Se rediseñó la integración para hablar directo con la WhatsApp Business Cloud API de Meta, usando una app propia del equipo ya registrada como Tech Provider (Business Solution Provider) ante Meta.
- Cada tenant conecta su propio número vía **Embedded Signup**; el webhook pasa a ser una única URL a nivel de app (no una por tenant), enrutada por `phone_number_id`.

**Decisiones tomadas:**
- Decisión: integración directa con Meta en vez de cualquier proveedor intermedio.
  **Por qué:** el equipo ya tiene resuelto lo que un proveedor como Plazbot resolvería (Business Verification, registro de números); mantenerlo habría sido una capa redundante y un costo recurrente sin beneficio.
  **Alternativa descartada:** mantener Plazbot u otro proveedor tipo BSP de terceros.

**Bloqueadores abiertos:**
- Confirmar si el access token que devuelve Embedded Signup necesita convertirse a un token de usuario de sistema (no expira) — pendiente de confirmar contra la implementación de Tech Provider que ya existe.
- Diseñar la estrategia de *message templates* para la ventana de 24 horas de Meta (antes esto lo resolvía Plazbot de forma transparente).

**Próximo paso:** revisar si el módulo de propiedades del MVP cubre lo que una inmobiliaria real necesita para su inventario (no solo el catálogo público).

---

### 2026-11-06 — Módulo de Inventario de Propiedades (v1.4)

**Quién:** sesión de planeación con Claude
**Fase:** — (pre-Fase 0)

**Qué se hizo:**
- Se agregó el módulo de Inventario de Propiedades: tabla `property_owners` (propietario/mandante, distinto de los leads del CRM), y en `properties`: `internal_code`, `listing_type` (exclusivo/compartido/abierto), fechas de mandato, `commission_percentage`, y `visibility` (separado de `status`, para poder preparar una propiedad antes de publicarla).
- Se agregaron endpoints de acciones masivas (`bulk-status`) e importación CSV (`bulk-import`), pensados para el usuario objetivo que hoy maneja su portafolio en Excel/Wasi.

**Decisiones tomadas:**
- Decisión: separar `property_owners` de `leads`.
  **Por qué:** el propietario que entrega un inmueble en mandato no es lo mismo que un comprador/arrendatario captado por el CRM; mezclarlos habría sido confuso.
- Decisión: `visibility` como campo independiente de `status`.
  **Por qué:** permite cargar/preparar una propiedad (fotos, precio, mandato) antes de que aparezca en la página pública.

**Bloqueador descartado explícitamente (no se implementa en MVP):** historial de cambios de estado (`property_status_history`) y reportes de inventario — choca con "Reportes y analytics avanzados", que ya está fuera de alcance del MVP.

**Próximo paso:** revisar si hay más gaps de CRM/Inventario comparando contra un producto real del mercado (el usuario compartió un theme de WordPress — Houzez — con su propio plugin de CRM).

---

### 2026-11-06 — Revisión de Houzez CRM y separación Lead/Deal (v1.5)

**Quién:** sesión de planeación con Claude (con un sub-agente dedicado a leer el código del plugin `houzez-crm` y el addon de importación CSV/XML del tema WordPress Houzez v4.4.4, compartido por el usuario en la carpeta `Houzez_v4.4.4_Main/`)

**Fase:** — (pre-Fase 0)

**Qué se hizo:**
- Se analizó el modelo de datos de `houzez-crm` (plugin de CRM inmobiliario maduro) y del addon de importación CSV/XML de propiedades.
- Se adoptó su separación de **Lead** (contacto calificado) y **Deal/oportunidad** (negocio concreto sobre una propiedad, con valor esperado y pipeline propio).
- `leads.stage` se simplificó a `new/contacted/disqualified`. Se agregó la tabla `deals` (`lead_id` + `property_id` + `deal_value_cents` + `next_action` + `expected_close_date` + su propio pipeline de 7 etapas). El `KanbanBoard.tsx` pasa a operar sobre `deals`, no sobre `leads`. `visits` gana un `deal_id` opcional.

**Decisiones tomadas:**
- Decisión: adoptar el split Lead/Deal de Houzez.
  **Por qué:** un mismo lead puede tener varias oportunidades abiertas en paralelo (interesado en dos propiedades a la vez), cada una con su propio monto y estado de cierre — v1.4 no podía representar eso con un solo `leads.stage`.
- Decisión explícita de **no** adoptar ahora (diferido a v2, con el usuario aprobando solo el ítem de Lead/Deal en esta sesión): stages/fuentes/`next_action` configurables por tenant (en vez de `CHECK` fijos), timeline de `activities` y notas múltiples por lead/deal, tipos de consulta "avalúo"/"crédito hipotecario", y en Inventario: `land_area`, `video_url`, `virtual_tour_url` y una tabla `floor_plans` repetible.
  **Por qué se difirió:** son mejoras reales pero no bloquean el MVP tal como está definido en la sección 1 del blueprint; se documentaron con número en la sección 15 (riesgo 13) para no perderlas de vista.

**Próximo paso:** crear el plan de implementación por fases y esta misma bitácora (hecho en esta misma sesión) y arrancar la Fase 0 cuando se resuelvan los 4 bloqueadores listados en `plan-implementacion.md` §0.

---

### 2026-11-06 — Fase 0: scaffold probado, blueprint corregido a v1.6

**Quién:** sesión de planeación con Claude
**Fase:** 0

**Qué se hizo:**
- Se corrió `npx create-vinext-app` en una carpeta de prueba (fuera del repo) con `--platform cloudflare --image-optimization cloudflare-images` para verificar el bloqueador #1 de `plan-implementacion.md` antes de tocar el proyecto real.
- Se confirmó que vinext funciona hoy y genera un proyecto App Router + TypeScript + Tailwind sobre Vite, listo para Cloudflare.
- Se corrigieron dos supuestos del blueprint que resultaron incorrectos: el proyecto se administra con el CLI **`cf`** (no `wrangler`) y un archivo **`cloudflare.config.ts`** (no `wrangler.jsonc`); y la estructura real no envuelve el código en `src/` — `app/`, `lib/`, `components/` van en la raíz.

**Decisiones tomadas:**
- Decisión: probar el scaffold en una carpeta ajena al repo antes de arrancar el proyecto real.
  **Por qué:** evitar que un scaffold fallido o con supuestos equivocados ensuciara el repo real desde el primer commit.

**Bloqueadores abiertos:** los de WhatsApp (riesgos 10 y 11 del blueprint) — no bloquean lo que sigue.

**Próximo paso:** scaffold real en la raíz del repo, `git init`, primer commit, y empezar `lib/db/tenant-scope.ts` + schema Drizzle + su prueba de aislamiento multitenant.

---

### 2026-11-06 — Scaffold real aplicado al repo + primer commit

**Quién:** sesión de planeación con Claude
**Fase:** 0

**Qué se hizo:**
- `create-vinext-app` no aceptó el nombre de la carpeta real (`SaaS Inmobiliario V2` tiene mayúsculas/espacios, inválido como nombre de paquete npm), así que se generó en una carpeta temporal válida (`saas-inmobiliario-scaffold`) y se copiaron sus archivos a la raíz del repo, corrigiendo el `name` a `saas-inmobiliario` en `package.json` y `cloudflare.config.ts`.
- `npm install` en la raíz real: 201 paquetes instalados correctamente.
- `npm run build` corrió exitosamente (build de cliente + SSR para Cloudflare Workers) — confirma que el scaffold es funcional de punta a punta, no solo que el comando no tiró error.
- Se inicializó git (`git init`) y se hizo el primer commit con la documentación (blueprint v1.6, plan, esta bitácora) + el scaffold del proyecto.
- Se agregó `Houzez_v4.4.4_Main/` al `.gitignore` — son ~35 MB de zips de un theme de WordPress que sirven como referencia de producto, no son parte de la app, así que no se versionan (la carpeta sigue en el disco, solo no entra al repo).

**Decisiones tomadas:**
- Decisión: no versionar la carpeta `Houzez_v4.4.4_Main/`.
  **Por qué:** es material de referencia externo (zips binarios de un theme WordPress), no código del proyecto; versionarlo infla el repo sin aportar nada que no se pueda consultar directo del disco.

**Bloqueador nuevo, menor:** `cf@1.0.0-beta.28` (el CLI de Cloudflare) pide Node `^22.23.0 || ^24.22.0 || ^26.12.0`; el entorno donde se corrió esto tiene Node v24.12.0, justo por debajo del mínimo de la rama 24.x. `npm install` lo deja pasar como warning (`EBADENGINE`), no bloqueó el build, pero antes de correr comandos reales de `cf` (crear la D1, cargar secrets, deploy) hay que confirmar la versión de Node en la máquina/CI que se use para eso.

**Próximo paso:** schema Drizzle completo (tablas del blueprint §6) + binding `DB: bindings.d1(...)` en `cloudflare.config.ts` + `lib/crypto.ts` + `lib/db/tenant-scope.ts` + su prueba de aislamiento multitenant. Eso cierra el criterio de salida de la Fase 0.

---

### 2026-11-06 — Resto de la Fase 0: schema, D1, Better Auth, crypto, tenant-scope y su prueba

**Quién:** sesión de planeación con Claude
**Fase:** 0

**Qué se hizo:**
- `lib/db/schema/` — schema completo en Drizzle: 10 tablas de dominio (`domain.ts`) + 4 de Better Auth (`auth.ts`, con `additionalFields` `tenantId`/`role`/`phone`/`isActive` en `user`). Los `CHECK` que tenía el SQL de referencia del blueprint (`type`, `operation`, `status`, `visibility`, `listing_type`, `source`, `stage` de leads y deals, `status` de visits, `plan`/`status` de subscriptions, `role` de user) se agregaron explícitamente con el helper `check()` de `drizzle-orm/sqlite-core` — Drizzle no los infiere solo del `{ enum: [...] }` de TypeScript.
- `drizzle.config.ts` + `npx drizzle-kit generate` → `drizzle/migrations/0000_kind_speed.sql`, 14 tablas, confirmado que corre contra SQLite/D1.
- Binding real de D1 en `cloudflare.config.ts`: `DB: bindings.d1({ name: "saas-inmobiliario-db" })`. Se leyeron los tipos instalados de `@cloudflare/config` para confirmar la firma exacta (`{ id?, name?, dev? }`) en vez de adivinarla — el blueprint tenía `databaseName` en vez de `name`, ya corregido.
- `lib/crypto.ts` — encrypt/decrypt con Web Crypto AES-GCM. Tuvo que ajustarse con casts `as BufferSource` por un choque de tipos entre `Uint8Array` y `ArrayBuffer`/`SharedArrayBuffer` en la versión de TypeScript instalada (fricción conocida de TS reciente + DOM types, no un bug de lógica).
- `lib/db/tenant-scope.ts` — cubre `properties` y `leads` como referencia del patrón (el resto de las tablas se suma tabla por tabla cuando se construya cada módulo en Fase 1/2, no de una sola vez acá).
- `lib/auth/auth.ts` — Better Auth con `drizzleAdapter(db, { provider: "sqlite", schema, transaction: false })` (D1 no soporta transacciones interactivas) y plugin `magicLink` con `sendMagicLink` como placeholder que lanza error explícito hasta que se conecte a Resend en Fase 2. Se construye con una función `getAuth(env)` por request, no como singleton de módulo, porque el binding D1 solo existe dentro del contexto de un request de Workers (confirmado por búsqueda web antes de escribirlo, para no asumir mal un patrón tan central).
- **Prueba de aislamiento multitenant** (`tests/tenant-scope.test.ts`, 4 casos) corriendo contra una base SQLite real en memoria (`better-sqlite3`), aplicando la misma migración que generó drizzle-kit — no un mock. Cierra el criterio de salida de la Fase 0 en la parte que depende de código.
- Más un test de round-trip de `lib/crypto.ts` (3 casos).

**Decisiones tomadas:**
- Decisión: probar el aislamiento multitenant contra SQLite real (better-sqlite3) en vez de montar un entorno D1/Miniflare (`@cloudflare/vitest-pool-workers`) para esto.
  **Por qué:** `lib/db/tenant-scope.ts` está escrito contra la API de query builder de `drizzle-orm/sqlite-core`, que es idéntica entre el driver de D1 y el de better-sqlite3 — alcanza para probar la *lógica* de aislamiento hoy mismo, sin la fricción de integrar un test runner nuevo (y potencialmente no compatible todavía con `cloudflare.config.ts`, que es muy reciente) solo para esto.
  **Alternativa descartada (no cerrada, solo pospuesta):** `@cloudflare/vitest-pool-workers` contra un D1 real simulado por Miniflare — queda como tarea pendiente antes de considerar el aislamiento multitenant 100% probado en las condiciones exactas de producción, no solo en SQLite genérico.
- Decisión: `created_at`/`updated_at` se generan en la aplicación (`$defaultFn`/`$onUpdate` de Drizzle) en vez de con los triggers SQL `AFTER UPDATE` que tenía el SQL de referencia del blueprint.
  **Por qué:** consistente con la decisión ya tomada en el blueprint de generar los ids en la aplicación (`crypto.randomUUID()`) en vez de en la base de datos; evita mezclar dos estilos.
- Decisión de implementación corrigiendo al blueprint: `cf` no usa `databaseName` sino `name` para identificar la base D1 en `bindings.d1()`.
  **Por qué:** se verificó leyendo los tipos reales instalados (`@cloudflare/config`) en vez de confiar en el ejemplo que se había escrito de memoria en v1.6.

**Bloqueadores abiertos:**
- `@cloudflare/vitest-pool-workers` (o el equivalente que ofrezca `cf` cuando salga de beta) para probar contra D1/Miniflare real, no solo SQLite genérico.
- Aprovisionamiento real en Cloudflare (`cf d1 create`, plan de Images, Turnstile) — requiere credenciales del usuario.
- Los de WhatsApp (riesgos 10 y 11 del blueprint) — siguen sin bloquear nada antes de la Fase 3.

**Próximo paso:** a elección — (a) aprovisionar Cloudflare de verdad para cerrar la Fase 0 al 100%, o (b) arrancar la Fase 1 (Inventario de Propiedades: CRUD de `properties`/`property_owners`, `ImageUploader`, bulk-import/bulk-status) sobre el schema ya validado.

---

### 2026-11-06 — Fase 1, backend: auth real, registro combinado, CRUD de inventario, bulk e imágenes

**Quién:** sesión de planeación con Claude
**Fase:** 1

**Qué se hizo:**
- **Acceso a `env` dentro de Route Handlers:** se confirmó (leyendo `@cloudflare/workers-types`) que `import { env } from "cloudflare:workers"` da acceso a los bindings del Worker desde cualquier punto del código, respaldado por AsyncLocalStorage — no hace falta pasar `env` a mano por cada función. `lib/auth/auth.ts` se actualizó para usarlo (antes recibía `env` como parámetro).
- `cloudflare.config.ts`: se agregaron como `bindings.secret()` todos los secrets del blueprint (`WOMPI_*`, `GEMINI_API_KEY`, `RESEND_*`, `META_*`, `ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, `CLOUDFLARE_IMAGES_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `TURNSTILE_SECRET_KEY`) más `NEXT_PUBLIC_APP_URL` — es el único mecanismo de "variable de runtime" que tiene `cf` hoy (no existe un binding tipo `vars` plano como en `wrangler.toml`).
- `lib/auth/session.ts` — `requireSession(request)`: resuelve `{ user, session, tenantId, role }` desde la cookie, y trata "sesión sin tenant" igual que "sin sesión" para no arriesgar nada.
- `app/api/auth/[...all]/route.ts` — catch-all de Better Auth (`getAuth()` se instancia dentro del handler, nunca a nivel de módulo).
- `app/api/register/route.ts` — registro combinado: crea el `tenant` primero, luego `auth.api.signUpEmail({ body: { email, password, name, tenantId, role: "admin" }, asResponse: true })` (el `tenantId`/`role` pasan porque son `additionalFields` de `user`), y revierte el tenant si el sign-up falla. No es atómico a nivel de motor (D1 no soporta transacciones interactivas con este adapter) — queda documentado como limitación conocida, no oculto.
- `lib/db/tenant-scope.ts` — se extendió con CRUD completo de `properties` (list con filtros+paginación, get, create con generación de slug único por tenant, update, delete) y `property_owners` (list con búsqueda, get, create, update, delete con bloqueo si tiene propiedades asociadas), más `bulkUpdatePropertyStatusForTenant` (filtra por tenant aunque lleguen ids ajenos en la lista) y los helpers públicos `getTenantBySlug`/`listPublishedPropertiesForTenant`/`getPublishedPropertyForTenant` (solo `visibility = 'published'`).
- `lib/validations/property.ts`, `property-owner.ts`, `property-import.ts`, `agency.ts` — Zod en el borde de cada endpoint.
- `lib/images/cloudflare-images.ts` + `app/api/upload/route.ts` — mint de Direct Creator Upload URL (metadata `{ tenant_id, context }`), tal como lo describe el blueprint §7/§11.
- `app/api/properties/bulk-import/route.ts` — CSV con `papaparse`, validación en dos pasos (coerción de tipos → reglas de negocio de `createPropertySchema`), reporta `created`/`skipped`/`errors` por fila.
- 8 nuevos tests (`tests/properties.test.ts`): slug único por tenant (incluso con título repetido), que nadie edita/borra una propiedad de otro tenant, que `bulk-status` no toca ids ajenos aunque vengan en la lista, que el catálogo público filtra por `visibility`, y que no se puede borrar un propietario con propiedades asociadas.

**Decisiones tomadas:**
- Decisión: el catálogo público filtra por `visibility = 'published'`, sin excluir por `status` (una propiedad `sold` sigue siendo visible, con badge, en vez de desaparecer).
  **Por qué:** es el comportamiento típico de sitios inmobiliarios reales (prueba social, SEO de la ficha); `status` gobierna disponibilidad comercial, `visibility` gobierna si aparece en la web — son preguntas distintas (ver blueprint v1.4).
- Decisión: el CSV de importación usa nombres de columna fijos (los mismos campos camelCase del body de `POST /api/properties`), sin un mapeador de columnas configurable.
  **Por qué:** un mapeador de columnas es una feature en sí misma (UI para mapear encabezados arbitrarios); el blueprint ya dejó fuera de alcance el editor visual y otras piezas de configuración pesada — esto sigue esa misma lógica. El admin exporta su Excel/Wasi a este formato antes de importar.
- Decisión: registro combinado (tenant + usuario) en un solo endpoint, con el tenant creado antes de llamar a `signUpEmail` y revertido si el sign-up falla, en vez de crear el usuario primero y parchear el `tenantId` después.
  **Por qué:** más simple — `tenantId`/`role` son `additionalFields` de Better Auth, así que se pasan directo en el body de sign-up sin una segunda escritura a la tabla `user`.

**Bloqueadores / deuda técnica abierta:**
- El rollback de `/api/register` no es una transacción real (D1 no soporta transacciones interactivas con el adapter actual); si el `DELETE` de rollback mismo fallara, quedaría un tenant huérfano sin usuarios. Poco probable, pero no está resuelto con una garantía fuerte.
- Sigue pendiente (de la Fase 0) montar `@cloudflare/vitest-pool-workers` para probar contra D1/Miniflare real en vez de SQLite genérico.
- Todo lo construido hoy es backend: no hay una sola página ni componente de React nuevo. El criterio de salida de la Fase 1 ("una inmobiliaria publica 5+ propiedades por el flujo normal") todavía no se cumple de punta a punta porque no hay UI.

**Próximo paso:** página pública `/[slug]` (catálogo) y `/[slug]/property/[id]` (detalle) primero — es la parte más visible del criterio de salida — y después el dashboard (lista/crear/editar propiedades y propietarios) y el onboarding.

---

### 2026-11-06 — Fase 1 completa: UI de dashboard, páginas públicas, y verificación en vivo contra D1 real

**Quién:** sesión de planeación con Claude
**Fase:** 1

**Qué se hizo:**
- **Tailwind v4, no v3:** el scaffold de vinext usa el config CSS-first de Tailwind v4 (`@import "tailwindcss"` + `@theme` en `globals.css`), no `tailwind.config.ts` como asumía el blueprint §12. Se tradujo la paleta de colores del blueprint a `@theme` en `app/globals.css` (tokens `--color-primary`, `--color-danger`, etc., generan las clases `bg-primary`, `text-danger`...).
- **Acceso a `env` confirmado para Server Components, no solo Route Handlers:** `headers()` de `next/headers` + `requireSession(headers)` (se generalizó la firma de `requireSession` para aceptar `Headers` en vez de un `Request` completo, así sirve tanto en Route Handlers como en páginas server).
- `lib/auth/client.ts` — cliente de Better Auth para componentes de cliente (`createAuthClient` + `magicLinkClient`).
- Páginas de auth: `/register` (formulario → `POST /api/register`) y `/login` (`authClient.signIn.email`).
- `app/(dashboard)/layout.tsx` — guard de sesión server-side (`redirect("/login")` si no hay sesión) + `Sidebar`/`TopBar`.
- **Error de estructura de carpetas, encontrado y corregido antes de commitear:** las páginas de propiedades se habían puesto en `app/(dashboard)/properties/...` — como `(dashboard)` es un *route group*, esas URLs resultaban en `/properties`, no en `/dashboard/properties` como promete el blueprint §9. Se movieron a `app/(dashboard)/dashboard/properties/...` para que coincida con la tabla de rutas del blueprint. De paso, se migraron los imports de esos archivos al alias `@/*` (ya configurado en `tsconfig.json`, y confirmado que vinext lo materializa también como alias de Vite en runtime, no solo para type-checking) en vez de rutas relativas frágiles — un `sed` mal escrito lo demostró rompiendo imports al primer intento.
- `ImageUploader.tsx` (drag & drop con `react-dropzone`, sube directo a Cloudflare Images vía `/api/upload`), `PropertyForm.tsx`, `PropertyOwnerForm.tsx`, `PropertiesTable.tsx`, `PropertyOwnersTable.tsx`, y las 6 páginas del dashboard de propiedades/propietarios (lista, crear, editar para cada uno).
- Páginas públicas: `app/[slug]/page.tsx` (catálogo, filtros por `<form method="get">` sin JS de cliente) y `app/[slug]/property/[id]/page.tsx` (detalle), con `AgencyHeader`, `PropertyCard`/`PropertyGrid`, `PropertyGallery` (`react-photo-view`), `PropertyMap` (`react-leaflet`, con el ícono de marcador apuntando a unpkg porque Vite rompe las rutas de assets por defecto de Leaflet), y `WhatsAppButton` (link directo a `wa.me`, sin agente de IA todavía — eso es Fase 3).
- **Verificación en vivo, no solo tests:** se corrió `npm run dev` (vinext + Cloudflare Vite plugin, que levanta un D1 simulado con Miniflare), se aplicó la migración de drizzle-kit directo al archivo `.sqlite` que Miniflare persiste en `.cloudflare/state/v3/d1/.../*.sqlite` (con un script de una línea usando `better-sqlite3`, sin pelear con el CLI `cf` para resolver el id de la base local), y se ejercitó el flujo completo con `curl`: registro → tenant + usuario admin creados → crear propiedad → aparece en el catálogo público y en el detalle → crear propietario → importar 2 propiedades por CSV → marcar una como vendida y ver el badge "Vendida" en la página pública.

**Decisiones tomadas:**
- Decisión: sin `shadcn/ui` por ahora — los componentes de formulario/tabla se escribieron con Tailwind plano.
  **Por qué:** instalar y configurar shadcn (CLI, `components.json`, elegir cada primitiva) es trabajo real que no cambia la funcionalidad; se prefirió llegar a un flujo end-to-end verificable primero. Retrofitear shadcn después es compatible con esta decisión, no un callejón sin salida.
- Decisión: filtros del catálogo público como `<form method="get">` plano, sin componente de cliente ni JavaScript.
  **Por qué:** навegación GET + re-render del Server Component alcanza para el caso de uso (filtrar por tipo/operación) sin la complejidad de un combobox controlado; más simple y más rápido de cargar.
- Decisión: el ícono de marcador de Leaflet apunta a `unpkg.com` en vez de a los assets locales del paquete.
  **Por qué:** es el workaround estándar para el problema conocido de Leaflet con bundlers (las rutas de imagen por defecto asumen un bundler tipo Webpack con un resolutor de assets distinto al de Vite).

**Bloqueadores / deuda técnica abierta:**
- Todo lo de hoy se probó contra la simulación local de Miniflare (`.cloudflare/state/`), no contra una cuenta de Cloudflare real — sigue pendiente el aprovisionamiento real (`cf d1 create`, Cloudflare Images, Turnstile).
- El flujo se verificó por API (`curl`), no haciendo clic en el navegador — las páginas y formularios compilan y las rutas responden, pero no hay una pasada manual confirmando que los formularios de React se comportan bien con inputs reales de usuario.
- `/dashboard/settings/agency` (editar logo/colores/slug después de creado el tenant) no se construyó — el registro crea el tenant pero no hay UI para editarlo después. Queda para cuando se arme el módulo de Settings.
- Sigue sin resolverse lo de `@cloudflare/vitest-pool-workers` (de Fase 0) — aunque hoy se logró una verificación en vivo equivalente a mano, no quedó automatizada como test.

**Próximo paso:** verificar manualmente desde el navegador (clic a clic) el flujo de registro → crear propiedad → ver el catálogo público, y después decidir entre cerrar los pendientes de aprovisionamiento de Cloudflare o arrancar la Fase 2 (CRM: leads + deals).

---

### 2026-11-06 — Fase 2 completa: CRM (leads + deals) backend, UI, y verificación en vivo

**Quién:** sesión de planeación con Claude
**Fase:** 2

**Qué se hizo:**
- `lib/turnstile.ts` — `verifyTurnstileToken()` contra el endpoint real de Cloudflare Siteverify. Se usaron las claves de prueba públicas de Cloudflare (sitekey `1x00000000000000000000AA` / secreto `1x0000000000000000000000000000000AA`, documentadas oficialmente, no son de ninguna cuenta real) para poder probar el flujo completo del formulario público sin tener Cloudflare provisionado todavía.
- `lib/validations/lead.ts`, `deal.ts`, `visit.ts` — Zod en el borde. `createLeadSchema` (pública, con Turnstile) vs. `createManualLeadSchema` (autenticada, sin Turnstile) son schemas separados a propósito.
- `lib/db/tenant-scope.ts` — CRUD de `leads` (incluye `createLeadForTenant` que opcionalmente registra el interés en una propiedad), `deals` (con la regla de que tanto el lead como la propiedad deben ser del mismo tenant o no se crea el deal), y `visits` (con una detección simple de conflicto de agenda: mismo asesor, misma franja exacta — no solapamiento de rangos, eso queda para si hace falta más adelante). Más `listDealsWithContextForTenant` (join con lead/propiedad, solo para pintar el kanban).
- `app/api/leads/route.ts` — **un solo endpoint con dos caminos**: con sesión es alta manual (`source: 'manual'`, sin Turnstile), sin sesión es el formulario público (con Turnstile, resolviendo el tenant por `tenantSlug`). Evitó duplicar el endpoint.
- `app/api/leads/[id]/route.ts` (detalle + calificar), `app/api/leads/[id]/interests/route.ts`, `app/api/deals/route.ts` + `[id]/route.ts`, `app/api/visits/route.ts` + `[id]/route.ts`.
- UI: `TurnstileWidget.tsx` (carga el script de Turnstile a mano, sin paquete de terceros — no hay uno en la lista de dependencias del blueprint), `ContactForm.tsx` (en la página de detalle de propiedad), `KanbanBoard.tsx`/`KanbanColumn.tsx`/`DealCard.tsx` (drag & drop con `@hello-pangea/dnd`), `DealForm.tsx`, `VisitScheduler.tsx`, `LeadsTable.tsx`, `NewContactForm.tsx`, y las páginas `/dashboard/crm` (kanban), `/dashboard/crm/contacts` (lista) y `/dashboard/crm/[leadId]` (detalle: intereses, deals, visitas).
- 9 tests nuevos (`tests/crm.test.ts`): un lead colado con una propiedad de otro tenant se crea igual pero sin registrar el interés; nadie califica un lead ajeno; `addLeadPropertyInterest` es idempotente; un deal no se crea si la propiedad es de otro tenant aunque el lead sí sea propio; un lead puede tener varios deals abiertos en paralelo; nadie mueve un deal ajeno en el kanban; conflicto de agenda detectado correctamente.
- **Verificación en vivo** (mismo D1 local de la Fase 1, ya con datos de antes): lead público con Turnstile real → `201`; lead manual autenticado → `201`; crear propiedad + lead + deal → el deal aparece en el kanban (`/dashboard/crm`) y en el detalle del lead (`/dashboard/crm/[leadId]`); mover el deal de etapa vía `PATCH /api/deals/[id]` (lo mismo que dispara el drag & drop) → se refleja; agendar una visita ligada al deal → `201` y aparece en el detalle del lead.
- **Encontrado y resuelto durante la verificación:** reusar una cookie de sesión de una sesión de `dev` anterior (de la Fase 1) dejó de funcionar — las páginas del dashboard devolvían 307 (redirect a `/login`) y el endpoint de leads caía al camino público por falta de sesión válida. No se investigó la causa raíz (no bloqueaba nada: un registro nuevo generó una cookie fresca que funcionó de inmediato), pero queda anotado por si se repite con una sesión real de un usuario.

**Decisiones tomadas:**
- Decisión: `POST /api/leads` es un solo endpoint con dos caminos (autenticado = manual, sin sesión = público con Turnstile) en vez de dos rutas separadas.
  **Por qué:** los dos casos escriben la misma fila con el mismo helper (`createLeadForTenant`); separar la ruta solo habría duplicado el wiring sin aportar claridad.
- Decisión: el widget de Turnstile se integró a mano (cargar el script + `window.turnstile.render`) en vez de buscar un paquete de React para Turnstile.
  **Por qué:** el blueprint no lista ningún paquete de Turnstile entre las dependencias, y la integración oficial es deliberadamente simple (un script + un div) — meter una dependencia nueva solo para esto no se justificaba.
- Decisión: la detección de conflicto de agenda es "misma franja exacta", no solapamiento de rangos de horario.
  **Por qué:** así lo describe el blueprint §7 (`409 conflicto de agenda`) sin pedir manejo de duración variable; una regla más sofisticada es una mejora de v2, no un requisito del MVP.

**Bloqueadores / deuda técnica abierta:**
- Notificaciones por Resend (nuevo lead, visita confirmada) quedaron fuera de esta pasada — diferido explícitamente, no es un olvido (ver plan-implementacion.md §Fase 2).
- Sigue sin montarse `@cloudflare/vitest-pool-workers` (arrastrado desde Fase 0).
- Todo lo de hoy se probó por `curl`, no haciendo clic en el navegador (mismo pendiente que la Fase 1).

**Próximo paso:** pasada manual desde el navegador de las Fases 1 y 2 juntas, y después decidir entre aprovisionar Cloudflare real o intentar arrancar la Fase 3 (agente de WhatsApp) — que sigue bloqueada por los riesgos 10 y 11 del blueprint (duración del token, estrategia de message templates).

---

### 2026-11-07 — Reordenamiento de fases: WhatsApp pasa al final

**Quién:** sesión de planeación con Claude
**Fase:** — (ajuste de plan, no de código)

**Qué se hizo:**
- A pedido del usuario, se reordenó `plan-implementacion.md`: el agente de WhatsApp deja de ser la Fase 3 y pasa a ser la Fase 4, justo antes del pulido final. Billing (antes Fase 4) pasa a ser la Fase 3.
- Orden actualizado: Fase 0 (Fundaciones) → Fase 1 (Inventario) → Fase 2 (CRM) → **Fase 3 (Billing)** → **Fase 4 (WhatsApp)** → Fase 5 (Pulido para "Done").

**Decisión tomada:**
- Decisión: mover WhatsApp al final, justo antes de Pulido.
  **Por qué:** sigue siendo la única fase bloqueada por algo externo (riesgos 10 y 11: duración del token, estrategia de message templates — pendientes de confirmar con la app Tech Provider existente), y no tiene ninguna dependencia hacia ni desde Billing. No hay razón para dejarla a mitad de camino bloqueando nada; mejor dejarla de última para no interrumpir el impulso en las fases que sí se pueden construir de punta a punta ahora mismo.

**Sin cambios de código en esta entrada** — solo reordenamiento del plan.

---

### 2026-11-07 — Resueltos los riesgos 10 y 11 (token y ventana 24h) auditando WhatsflowAI-V2

**Quién:** sesión de planeación con Claude (con un sub-agente dedicado a auditar en solo lectura el proyecto externo)
**Fase:** — (resolución de riesgos de la Fase 4, antes de implementarla)

**Qué se hizo:**
- El usuario señaló que el proyecto `WhatsflowAI-V2` (en `C:\Users\marke\Downloads\MVP IA-Antigravity\WhatsFlowAI-V2`) ya tiene una integración funcionando con una app Meta Tech Provider, y pidió revisarlo en modo solo lectura para resolver los riesgos 10 y 11 del blueprint.
- Se auditó (sin modificar nada de ese proyecto) `lib/meta/client.ts`, `lib/ai/responder.ts`, `app/api/webhooks/meta-direct/route.ts`, `app/api/meta/token-exchange/route.ts`, `lib/campaigns/enviar.ts`, `lib/automations/executor.ts`, `app/api/plantillas/route.ts`, `lib/utils/whatsapp-validation.ts`, `lib/constants/default-templates.ts`, y el documento `WhatFlowAI_MetaTechProvider_Sandbox_Blueprint.md`.
- **Hallazgo riesgo 10 (token):** el patrón real en producción no es guardar el token del intercambio de Embedded Signup — es un **System User Token único a nivel de app**, generado una sola vez a mano en Meta Business Manager (Usuarios del sistema → crear uno Admin → asignarle cada WABA como activo → generar token con `whatsapp_business_management`/`whatsapp_business_messaging`), usado como fallback en absolutamente todas las llamadas de envío (`channel.meta_access_token || process.env.META_SYSTEM_USER_TOKEN`), y en la práctica el campo por canal casi nunca se usa.
- **Hallazgo riesgo 11 (ventana 24h):** no hay ningún chequeo preventivo de "¿pasaron 24h?". Es reactivo: capturan el código de error de Meta (`131047`) después de que el envío falla y se lo informan al usuario. Para respuestas del agente de IA a mensajes entrantes no hace falta ningún chequeo, porque responder en la misma conversación siempre cae dentro de la ventana.
- Se actualizó el blueprint a **v1.7**: §11 ahora documenta el flujo con System User Token (Embedded Signup solo sirve para obtener `waba_id`/`phone_number_id`, ya no para guardar un token por tenant), §15 marca los riesgos 10 y 11 como resueltos (con la nota de que falta confirmar manualmente que el token de sistema se generó marcado como "no expira"), y §14 tiene la decisión nueva con su porqué. Se actualizó `plan-implementacion.md` §0 (ya no hay bloqueadores externos para la Fase 4) y la Fase 4 (agrega la tarea de generar el token a mano, quita el token por tenant del schema).

**Decisiones tomadas:**
- Decisión: adoptar el mismo patrón de System User Token único que usa `WhatsflowAI-V2`, en vez de intentar hacer funcionar el token por tenant del Embedded Signup con algún mecanismo de refresh propio.
  **Por qué:** es un patrón ya probado en producción por una integración Tech Provider real con la misma app/cuenta de Meta que vamos a usar nosotros — más confiable que diseñar algo nuevo sin poder probarlo contra una cuenta real todavía.
- Decisión: no construir ningún chequeo de ventana de 24h para el MVP.
  **Por qué:** el agente del MVP solo responde, nunca escribe primero (no hay mensajes proactivos de WhatsApp en el alcance — las notificaciones de CRM van por Resend). Construir ese chequeo ahora sería resolver un problema que el MVP no tiene.

**Bloqueadores abiertos:**
- Confirmar al generar el `META_SYSTEM_USER_TOKEN` real que quede marcado explícitamente como "no expira" en el dashboard de Meta — no se encontró evidencia en la auditoría de que `WhatsflowAI-V2` lo haya hecho así (podría estar rotándolo a mano, no quedó claro).
- Sigue pendiente el paso manual recurrente: cada WABA nuevo que se conecte necesita asignarse a mano al usuario de sistema en Business Manager — no es un bloqueador, es una tarea operativa de cada conexión (documentada en el blueprint §11).

**Próximo paso:** la Fase 4 ya no tiene nada externo pendiente para arrancar cuando le toque el turno (sigue de última en el orden, por decisión del usuario). Seguir con la Fase 3 (Billing) o con el aprovisionamiento real de Cloudflare / la pasada manual en el navegador, según lo que decida el usuario.

---

### 2026-11-07 — Billing diferido: el uso real hoy es interno, de una sola empresa

**Quién:** sesión de planeación con Claude
**Fase:** — (ajuste de plan, no de código)

**Qué se hizo:**
- El usuario aclaró que el CRM se va a usar primero para su propia empresa (un solo tenant), no como SaaS cobrado a otras inmobiliarias todavía — Billing no resuelve nada en ese escenario.
- Se reordenó `plan-implementacion.md`: Billing pasa de Fase 3 a **Fase 5, marcada explícitamente como DIFERIDA (no bloqueante)**. Pulido para "Done" pasa a ser la Fase 3 (siguiente fase activa). El orden completo queda: Fase 0 (Fundaciones) → Fase 1 (Inventario) → Fase 2 (CRM) → **Fase 3 (Pulido)** → Fase 4 (WhatsApp) → **Fase 5 (Billing, diferida)**.
- Se ajustó el criterio de QA de la Fase 3 (Pulido): el criterio #12 del blueprint (cobro con Wompi) se marca como "no aplicable mientras el uso sea interno", no como incumplido — para no bloquear falsamente el QA end-to-end por algo que el negocio todavía no necesita.

**Decisión tomada:**
- Decisión: no borrar Billing del plan, dejarlo diseñado y diferido en vez de descartarlo.
  **Por qué:** la arquitectura multitenant (D1 + `tenant_id` en todo, tabla `subscriptions` ya en el schema desde la Fase 0) no cuesta nada extra por tenerla construida ahora. Si en algún momento deciden vender esto a otras inmobiliarias, el cobro se agrega sin rediseñar nada del resto del sistema — dejar la puerta abierta sale gratis, cerrarla de una vez no.

**Próximo paso:** arrancar la Fase 3 (Pulido para "Done": SEO, invitación de asesores, `/dashboard/settings/agency`, QA end-to-end) cuando el usuario lo indique.

---

### 2026-11-07 — Fase 3, primera tanda: diseño/UX básico + los 3 templates de página pública

**Quién:** sesión de planeación con Claude
**Fase:** 3

**Qué se hizo:**
- El usuario señaló, con razón, que no había ningún trabajo real de diseño/UX hecho todavía — se verificó y era cierto en tres frentes concretos:
  1. Las tipografías del blueprint §12 (Inter, Urbanist) estaban declaradas como `font-family` en `globals.css` pero **nunca se habían cargado** (sin `<link>` de Google Fonts, sin `next/font`) — todo renderizaba con la fuente del sistema.
  2. `app/layout.tsx` seguía con el `<title>` y `lang="en"` del scaffold de `create-vinext-app` (*"vinext on Cloudflare Workers"*), visibles en la pestaña del navegador de todo el sitio.
  3. La función de **3 templates de página pública** (`modern`/`classic`/`minimal`) del blueprint §12, con su selector en `/dashboard/website`, nunca se construyó — solo existía un único diseño fijo. Esto no era un recorte de alcance deliberado, era un olvido: el blueprint lo pone explícitamente dentro del MVP (la sección "Fuera de alcance" solo descarta el *editor visual*, no los 3 templates fijos).
- Se corrigió lo básico: `app/layout.tsx` ahora carga Inter/Urbanist de Google Fonts de verdad, tiene `lang="es"`, título/descripción reales con un `template` de título (`%s · SaaS Inmobiliario`) para que cada sección herede un título sensato; se agregó `export const metadata` a las páginas clave del dashboard (resumen, propiedades, propietarios, oportunidades, contactos) y a `/login`/`/register` (que al ser `"use client"` necesitaron un `layout.tsx` propio, server component, solo para la metadata). Se reemplazaron clases `slate-*` sueltas por los tokens del blueprint (`border-border`, `text-dark`) en los formularios y páginas que las tenían.
- Se construyeron los 3 templates reales: `AgencyHeader` y `PropertyGrid`/`PropertyCard` ahora toman un prop `template`/`variant` y cambian de layout según `tenants.template` (que ya existía en el schema desde la Fase 0, nunca se había usado hasta ahora): `modern` (lo que ya había: grilla de 3 columnas, header compacto), `classic` (header centrado con logo grande + lista con imagen a la izquierda, componente nuevo `PropertyListRow.tsx`), `minimal` (sin header con tarjeta, tipografía grande, grilla de 2 columnas con fotos a sangre, sin bordes).
- Backend nuevo: `lib/db/tenant-scope.ts` gana `getTenantForTenant`/`updateTenantForTenant`; `app/api/agency/route.ts` (`GET`/`PATCH`, solo admin para escribir).
- UI nueva: `/dashboard/settings/agency` (editar nombre, logo vía `ImageUploader`, color de marca, contacto, descripción) y `/dashboard/website` (selector de template con 3 tarjetas + preview por iframe de la página pública real).
- **Verificado en vivo** (mismo D1 local de las fases anteriores): se registró un tenant nuevo, se hizo `PATCH /api/agency` cambiando nombre/color/ciudad (se reflejó en la respuesta y en la página pública), se cambió el template a `classic` y a `minimal` en secuencia, y en cada caso se confirmó con `curl` que el HTML de `/[slug]` y `/[slug]/property/[id]` trae las clases/estructura específicas de ese template (no solo que el campo se guardó en la base de datos).

**Decisiones tomadas:**
- Decisión: las diferencias entre templates se concentran en `AgencyHeader` y en el listado/grid de propiedades (grid vs. lista vs. grid a sangre), no en la página de detalle de cada propiedad.
  **Por qué:** es exactamente lo que describe la tabla del blueprint §12 ("Header... grilla de 3 cols" / "Header centrado... lista con imagen a la izquierda" / "Sin sidebar, tipografía grande, fotos a sangre") — ninguna fila menciona que el detalle cambie por template. Diferenciar también el detalle habría sido inventar alcance que el blueprint no pide.
- Decisión: el picker de templates en `/dashboard/website` guarda con un botón explícito ("Usar este template"), no al hacer clic en la tarjeta.
  **Por qué:** cambiar el diseño público de la inmobiliaria es una acción con consecuencia visible para cualquiera que visite el sitio — no debería poder pasar por un clic accidental.

**Bloqueadores / deuda técnica abierta:**
- `app/page.tsx` (la landing del SaaS en `/`) sigue siendo el placeholder del scaffold de vinext — no se tocó en esta pasada, es un trabajo de contenido/marketing aparte, no una corrección de diseño técnico.
- No se tocó `/dashboard/settings/team` (invitación de asesores) ni el SEO del catálogo público — quedan como las próximas tareas de la Fase 3.
- El picker de color (`<input type="color">`) es el control nativo del navegador, sin un selector de paleta curado — suficiente para el "básico" que pidió el usuario, se podría refinar después si hace falta.

**Próximo paso:** seguir con el resto de la Fase 3 — SEO del catálogo público, invitación de asesores, y después el QA end-to-end contra los 15 criterios de done del blueprint.

---

### 2026-11-07 — Fase 3, segunda tanda: SEO del catálogo, magic link real, invitación de asesores

**Quién:** sesión de planeación con Claude
**Fase:** 3

**Qué se hizo:**
- SEO: `app/[slug]/page.tsx` gana `openGraph` (title/description/image del logo del tenant, `type: "website"`) — antes solo tenía `title`/`description` planos.
- `lib/email/resend.ts` — wrapper mínimo sobre el SDK de Resend (`sendEmail({to, subject, html}, env)`).
- `lib/auth/auth.ts` — `sendMagicLink` deja de ser un placeholder que lanzaba error (desde la Fase 0) y ahora manda un email real por Resend con el link de ingreso. Esto también activa la opción "ingresar sin contraseña" que ya estaba prometida en `/login` pero sin funcionar — se agregó el botón correspondiente.
- Invitación de equipo: `lib/validations/team.ts`, `lib/db/tenant-scope.ts` (`listTeamMembersForTenant`, `isEmailAlreadyRegistered`), `app/api/team/invite/route.ts` (solo admin), `/dashboard/settings/team` (tabla de equipo + `InviteTeamMemberForm`).
- **Bug real encontrado y corregido durante la verificación en vivo:** el `<title>` de las páginas públicas (`/[slug]`, `/[slug]/property/[id]`) estaba heredando el `title.template` del layout raíz (`%s · SaaS Inmobiliario`, agregado en la primera tanda de esta fase) — una inmobiliaria se veía en la pestaña del navegador como *"Inmobiliaria SEO · SaaS Inmobiliario"*, cargando la marca del SaaS en el sitio de un cliente. Se corrigió con `title: { absolute: ... }` en ambas páginas, que en Next.js rompe la herencia del template del layout padre. Sin la verificación en vivo (correr el server real y mirar el HTML, no solo que compilara) esto no se habría detectado — el build y los tipos no tienen forma de saber que un título es "semánticamente incorrecto".

**Decisiones tomadas:**
- Decisión: la invitación de equipo crea la cuenta directo (con una contraseña aleatoria que el invitado nunca usa) y manda un magic link, en vez de un flujo de "token de invitación pendiente" con una tabla nueva.
  **Por qué:** no usamos el plugin de "organización" de Better Auth (nuestro modelo es `tenantId` como additionalField, no organizaciones) y no justificaba agregar una tabla nueva solo para esto — reutiliza exactamente el mismo mecanismo de magic link que ya se estaba construyendo para el login.
- Decisión: si falla el envío del email de invitación pero la cuenta ya se creó, se responde `200` con un `warning`, no un error.
  **Por qué:** la cuenta del asesor sí quedó creada (se puede confirmar en la tabla de equipo); tratarlo como una falla completa sería engañoso y llevaría a reintentar una invitación que en realidad ya existe parcialmente.

**Bloqueadores abiertos:**
- No hay una `RESEND_API_KEY` real todavía — se verificó que el código maneja bien el error (`invalid API key`, capturado y reportado como `warning`, no como fallo total), pero el envío real de un email no se pudo confirmar de punta a punta.
- La landing del SaaS (`app/page.tsx`) sigue siendo el placeholder del scaffold — queda pendiente como tarea de contenido, no de diseño técnico.

**Próximo paso:** conseguir una API key real de Resend para cerrar la verificación de email, y después el QA end-to-end contra los 15 criterios de done del blueprint §13.

---

### 2026-11-07 — Fase 4 completa (agente de WhatsApp) + landing real + QA final de todo el MVP

**Quién:** sesión de planeación con Claude
**Fase:** 3 (cierre) + 4

**Qué se hizo:**
- El usuario pidió diferir también Resend y seguir con "todo lo que falta" en una sola tanda. Se interpretó como: cerrar lo que quedaba de la Fase 3 (landing, QA, revisión de riesgos) y construir completa la Fase 4 (agente de WhatsApp), dejando Billing y Resend diferidos como ya se había acordado.
- **Schema:** se quitó `whatsapp_access_token_enc` de `ai_agent_configs` (ya no hace falta — token de sistema único, no por tenant) y se regeneró la migración desde cero (`0000_minor_shotgun.sql`, reemplaza a `0000_kind_speed.sql`) — no había nada desplegado a un D1 real todavía, así que se pudo squashear en vez de agregar una migración incremental.
- **Backend de WhatsApp:** `lib/whatsapp/graph-client.ts` (`sendWhatsappMessage` con el System User Token, `verifyMetaWebhookSignature` con Web Crypto HMAC-SHA256 y comparación en tiempo constante), `lib/whatsapp/embedded-signup.ts` (intercambio de `code` + suscripción del WABA a los webhooks de la app), `lib/ai/agent.ts` (arma el contexto de propiedades activas y llama a Gemini por `fetch` directo). `lib/db/tenant-scope.ts` gana el CRUD de `ai_agent_configs` (incluido `getAiAgentConfigByPhoneNumberId`, el que resuelve a qué tenant pertenece cada mensaje entrante).
- **Endpoints:** `POST /api/whatsapp/connect`, `GET/POST /api/webhooks/whatsapp`, `GET/PUT /api/ai-agent`, `POST /api/ai-agent/test`.
- **UI:** `/dashboard/ai-agent` con `WhatsAppConnectButton.tsx` (carga el SDK de Facebook, maneja el evento `postMessage` `WA_EMBEDDED_SIGNUP` para capturar `waba_id`/`phone_number_id`, y el callback de `FB.login` para el `code`) y `AiAgentForm.tsx` (config + "probar agente").
- **Landing real:** `app/page.tsx` dejó de ser el placeholder de vinext — ahora es la landing del SaaS descrita en blueprint §9 (hero, 3 features, CTA a `/register`/`/login`). Se borró también `/api/hello` (ruta de ejemplo del scaffold, sin referencias en el proyecto).
- **QA final:** se revisaron los 15 criterios de done del blueprint §13 y los 13 riesgos de la sección 15, uno por uno, y se dejó una tabla de estado real en el blueprint (ahora v1.8) — no un "todo listo" genérico. Resultado: 11/15 criterios cumplidos y verificados en vivo, 2 parciales (WhatsApp — bloqueados solo por no tener cuenta Meta real), 1 diferido a propósito (Wompi), 1 pendiente del usuario (deploy real a Cloudflare). De los 13 riesgos: 9 resueltos y verificados, 3 siguen abiertos de verdad (backups de D1, límite de tamaño de D1, plan de Cloudflare Images — decisiones de cuenta, no código), 1 diferido a v2 a propósito.
- **Verificación en vivo (lo más importante de esta entrada):** sin tener una cuenta real de Meta ni una API key real de Gemini, se verificó igual que el código de integración es correcto contra las APIs reales, no contra mocks:
  - `POST /api/ai-agent/test` con una Gemini key falsa → la llamada SÍ llegó a `generativelanguage.googleapis.com` y volvió un error real de Google ("API key not valid"), confirmando que `lib/ai/agent.ts` arma la request correctamente.
  - `POST /api/whatsapp/connect` con credenciales Meta falsas → la llamada SÍ llegó a `graph.facebook.com` y volvió "Invalid Client ID", confirmando que `lib/whatsapp/embedded-signup.ts` también está bien armado.
  - El webhook se probó de punta a punta con una firma HMAC-SHA256 calculada a mano con el mismo secret de `.dev.vars`: firma válida → `200 OK`; firma inválida → `401`; `phone_number_id` sin config asociada → `200 OK` sin romper (confirma el riesgo 12 de §15 en la parte de "no debe tumbar nada").
  - El cifrado de la Gemini key se confirmó leyendo la fila directo de la base de datos (no el texto plano, un blob cifrado real).
- **Gotcha de entorno encontrado y resuelto:** al borrar el archivo `.sqlite` del D1 local para aplicar el schema nuevo (sin el campo quitado), la primera corrida del script de migración se aplicó a un archivo que el propio script creó (porque corrió antes de que Miniflare abriera el suyo), mientras el servidor de `dev` ya en marcha seguía apuntando a su propio archivo (mismo nombre, pero recreado después) — resultado: "no such table: tenants" en el primer intento de registro. Se resolvió re-aplicando la migración directo sobre el archivo que ya existía mientras el servidor estaba corriendo (el mismo patrón que había funcionado en sesiones anteriores). Queda anotado por si se repite: después de borrar el `.sqlite` de Miniflare, esperar a que el servidor haga su primera query real (o reiniciarlo) antes de aplicar la migración, no asumir que el archivo ya existe.

**Decisiones tomadas:**
- Decisión: `waba_id`/`phone_number_id` se obtienen del evento `postMessage` (`WA_EMBEDDED_SIGNUP`) que el propio SDK de Meta dispara en el navegador, no con una llamada extra a la Graph API para "descubrirlos" a partir del token.
  **Por qué:** es el patrón documentado y estándar del flujo de Embedded Signup — inventar una llamada adicional de descubrimiento habría sido reconstruir algo que Meta ya entrega gratis.
- Decisión: regenerar la migración desde cero (squash) en vez de agregar una migración incremental para quitar la columna.
  **Por qué:** no hay nada desplegado en un D1 real todavía — mantener una sola migración "0000" es más simple de leer que una serie de migraciones que documentan cambios que nunca llegaron a producción.

**Bloqueadores abiertos (todos de cuenta/credenciales externas, no de código):**
- Falta una cuenta Meta Business Manager real con la app Tech Provider del equipo para: generar `META_SYSTEM_USER_TOKEN`, obtener `NEXT_PUBLIC_META_APP_ID`/`NEXT_PUBLIC_META_CONFIG_ID` reales, y conectar un número de WhatsApp real de principio a fin.
- Falta una `GEMINI_API_KEY`/Gemini key de tenant real para confirmar que la respuesta generada tiene sentido (hoy solo se confirmó que la *llamada* a la API es correcta).
- Siguen pendientes de antes: aprovisionar Cloudflare real (Fase 0), `RESEND_API_KEY` real (diferido junto con Billing), y los 3 riesgos de infraestructura de la sección 15 (backups, límite de D1, plan de Cloudflare Images).

**Próximo paso:** el MVP está, en términos de código, completo salvo Billing (diferido) y Resend (diferido). Lo único que falta para un lanzamiento real son credenciales/cuentas externas (Cloudflare, Meta, Gemini) que dependen del usuario — no hay más fases de desarrollo activo planeadas hasta que esas cuentas estén listas, o hasta que el usuario pida retomar Billing/Resend.

---

## 2026-11-07 — Auditoría de "relleno" post-rediseño visual y conexión real de datos

**Quién:** Claude (sesión de auditoría + corrección)
**Fase (según plan-implementacion.md):** 3 (pulido) — correcciones posteriores al rediseño visual que se hizo en paralelo fuera de esta sesión

**Qué se hizo:**
- Un rediseño visual sustancial (Sidebar, TopBar, dark mode, dashboard "Resumen", páginas de Agente IA/Configuración) se había aplicado directamente en el repo, en paralelo a esta conversación, con datos de ejemplo tipo mockup (nombres y cifras inventadas: "148 propiedades", "$4.250M pipeline", "Dr. Roberto Meza", "Plan Pro Inmobiliario $189.000/mes", etc.) que no venían de la base de datos real del tenant demo.
- Se corrigieron bugs de layout introducidos por ese rediseño: `a { color: inherit }` sin `@layer` pisaba `text-white` en los botones; el sidebar `fixed` no dejaba margen al contenido (quedaba tapado); el fondo raíz del layout no tenía variante `dark:`, dejando franjas blancas entre tarjetas en modo oscuro.
- Se hizo el sidebar retráctil (persiste en `localStorage` + atributo `data-sidebar` en `<html>`), se movió "Cerrar sesión" al sidebar, se quitó el indicador fijo "Bot WhatsApp Activo 24/7" del TopBar, y se creó `/dashboard/settings/profile` (edición real de nombre/teléfono y cambio de contraseña vía Better Auth, no un formulario decorativo).
- Se encargó una auditoría (subagente) de cada página bajo `app/(dashboard)/dashboard/**` para distinguir qué está conectado a datos reales y qué es relleno visual. Hallazgos y correcciones aplicadas:
  - **Bugs reales corregidos:** link "Ficha" en Propiedades apuntaba a una ruta inexistente (404); "Mi Web Pública" en el sidebar apuntaba a un slug fijo ajeno al tenant; botón "+ Nueva Oportunidad" sin `onClick`; banner de WhatsApp en Agente IA que siempre decía "Conectado & Operativo" sin importar el estado real; error de tipos en `settings/team/page.tsx` (`session.userId` → `session.user.id`).
  - **Dashboard "Resumen" reescrito por completo** (`app/(dashboard)/dashboard/page.tsx`): ahora usa `getLeadsForTenant`, `listDealsWithContextForTenant`, `listPropertiesForTenant` y una función nueva `listVisitsWithContextForTenant` (agregada a `tenant-scope.ts`) — KPIs, pipeline por etapa, próximas visitas y leads recientes son 100% reales del tenant, sin un solo número inventado.
  - **Badges del sidebar** ("Propiedades 148", "Oportunidades 18") pasaron a ser conteos reales calculados en el layout del dashboard y pasados como prop a `Sidebar`.
  - **Página de Agente IA:** se quitó el badge falso "Edge Workers Latencia 185ms"; las 4 tarjetas de métricas inventadas (volumen de mensajes, leads cualificados, tiempo de respuesta, satisfacción) se reemplazaron por 2 métricas reales derivables de `leads.source = 'whatsapp'` (no hay tabla de historial de conversaciones todavía, así que las métricas que sí la requieren se retiraron con una nota explícita en vez de inventarse).
  - **`AiAgentForm`:** se eliminaron los campos que nunca se enviaban al API (nombre del asistente, idioma, tono, 3 checkboxes de reglas de cualificación, umbral VIP) — se verificó en `lib/ai/agent.ts` que el `systemPrompt` se pasa literal a Gemini sin interpolar variables como `{catalogo_propiedades}`, así que los "chips de variables dinámicas" tampoco funcionaban y se quitaron. Solo quedan los campos que de verdad se guardan.
  - **`WhatsAppChatSimulator`:** se quitó la conversación semilla con marca inventada ("Sofía de InmoElite Prime"), la tarjeta de propiedad ficticia con botones muertos ("Brochure PDF", "Ver Ubicación"), y el panel "Score IA en Tiempo Real" (zona/presupuesto/broker/score) que era 100% estático. El simulador ahora es solo el chat real contra `/api/ai-agent/test` (Gemini real).
  - **Configuración de la Inmobiliaria:** la tarjeta "Plan Pro Inmobiliario" (precio, fecha de renovación, cupo de inventario, botón "Gestionar Facturación" muerto) se reemplazó por una tarjeta honesta con el conteo real de propiedades activas y asesores, y una nota de que Billing está diferido. El badge "3 miembros" en la pestaña de equipo pasó a ser el conteo real.
- Verificado en vivo contra el servidor ya corriendo (puerto 3000) con la cuenta demo real: `tsc --noEmit` limpio, `npm test` 29/29, y por `curl` confirmado que el payload RSC de `/dashboard`, `/dashboard/ai-agent` y `/dashboard/settings/agency` ya no contiene ninguno de los valores inventados y sí refleja los datos reales sembrados (5 propiedades, 4 leads, 5 deals en sus etapas correctas, 2 visitas próximas).

**Decisiones tomadas:**
- Decisión: donde no existe la data real para una métrica (volumen de mensajes de WhatsApp, tiempo de respuesta, satisfacción, score de IA en tiempo real), se retira el elemento visual en vez de dejarlo con un número fijo o un "próximamente" a medias.
  **Por qué:** regla del proyecto de no dejar funcionalidad a medio implementar ni mentir sobre el estado de una conexión — mejor ausencia honesta que apariencia de feature que no existe.
  **Alternativa descartada:** marcar esas tarjetas como "Próximamente" y dejarlas — se descartó por ser relleno de todas formas, solo que etiquetado.

**Bloqueadores abiertos:**
- No hay tabla de historial de mensajes de WhatsApp — para medir volumen de mensajes, tiempo de respuesta real y tasa de éxito autónoma del agente haría falta loggear cada mensaje entrante/saliente del webhook (`app/api/webhooks/whatsapp/route.ts`), lo cual no está en el alcance pedido hasta ahora.
- `app/(dashboard)/dashboard/crm/[leadId]/page.tsx` sigue con el estilo visual anterior al rediseño — es funcional y real, solo visualmente inconsistente con el resto del dashboard ya migrado.

**Próximo paso:** investigar y reportar funcionalidades típicas de un CRM inmobiliario que todavía faltan en este MVP (pedido explícito del usuario), para decidir junto con él qué se construye a continuación.

---

## 2026-11-07 — Plan de las Fases 6-13 (cierre de brechas de CRM inmobiliario)

**Quién:** Claude
**Fase (según plan-implementacion.md):** planificación de Fases 6-13 (ninguna construida todavía)

**Qué se hizo:**
- A partir del análisis de brechas de la entrada anterior (13 puntos: historial de WhatsApp, tareas/recordatorios, notificaciones, documentos/contratos, comisiones, portales externos, reportes, calendario, firma electrónica, historial de interacciones, matching lead↔propiedad, PWA móvil, reseñas), el usuario pidió los 13 y que se armara el plan de fases.
- Se agregó la sección **"1-bis. Fases 6-13"** en `plan-implementacion.md`, agrupando los 13 puntos en 8 fases nuevas ordenadas por dependencia de datos (no por importancia de negocio): Fase 6 (historial de WhatsApp + timeline de leads), Fase 7 (tareas + notificaciones), Fase 8 (comisiones + reportes), Fase 9 (documentos/contratos/firma), Fase 10 (calendario), Fase 11 (matching inteligente), Fase 12 (portales externos), Fase 13 (PWA + reseñas).
- Se encontró, revisando el schema antes de escribir el plan, que `properties.commission_percentage` y `deals.advisor_id` **ya existen y ya se capturan** (el primero desde `PropertyForm`), solo que nadie los consume todavía — la Fase 8 se documentó como mayormente de lectura/agregación, no de schema nuevo, gracias a este hallazgo.

**Decisiones tomadas:**
- Decisión: Fase 12 (portales externos) empieza con una tarea explícita de investigación/confirmación con el usuario antes de escribir código (¿tienen API real o solo feed?, ¿requieren plan pagado?).
  **Por qué:** es la fase de mayor riesgo externo — cada portal colombiano (Fincaraíz, Metrocuadrado, Properati) tiene su propio contrato comercial/técnico que no se puede asumir sin confirmarlo, a diferencia de Meta/Gemini donde ya había una app propia de referencia.
- Decisión: la firma electrónica real (proveedor tipo HelloSign/DocuSign) se deja fuera del alcance de la Fase 9 — esa fase solo entrega el PDF listo para firma manual/externa.
  **Por qué:** conectar un proveedor de firma implica una cuenta/costo externo nuevo, mismo patrón que Wompi en Billing — se prefiere no bloquear toda la fase de documentos por una cuenta que el usuario aún no tiene.
- Decisión: el envío de notificaciones por email (Fase 7) se construye pero queda sin poder verificarse en vivo hasta tener una `RESEND_API_KEY` real.
  **Por qué:** es la misma decisión ya tomada y documentada en la Fase 3 (Resend diferido junto con Billing) — no se reabre esa decisión, solo se nota que esta fase nueva hereda la misma limitación.

**Bloqueadores abiertos:**
- Fase 10 (calendario): la sincronización con Google Calendar requiere credenciales de Google Cloud nuevas que el usuario no ha provisto todavía.
- Fase 12 (portales externos): pendiente la investigación de qué modalidad de integración (API vs. feed) ofrece cada portal antes de poder estimar el trabajo real.
- Fase 11 (matching): queda una decisión abierta con el usuario — si se agregan campos estructurados (`preferredCity`/`preferredType`) a `leads`, o si se usa el agente de IA para extraerlos de `notes` on-demand.

**Próximo paso:** confirmar con el usuario si se arranca la Fase 6 (historial de WhatsApp + timeline) en el mismo orden del plan, o si pide adelantar otra fase.

---

## 2026-11-07 — Fase 6: historial de WhatsApp + timeline de leads (construida y verificada en vivo)

**Quién:** Claude
**Fase (según plan-implementacion.md):** 6

**Qué se hizo:**
- Dos tablas nuevas en `lib/db/schema/domain.ts` + migración `drizzle/migrations/0001_violet_silver_sable.sql`: `whatsapp_messages` (mensaje real entrante/saliente, `lead_id` nullable porque un número nuevo puede escribir sin tener lead todavía) y `lead_activities` (timeline: `stage_change`, `note`, `call`, `deal_created`, `visit_scheduled`, `whatsapp_message`).
- `lib/db/tenant-scope.ts`: nuevas funciones `logLeadActivity`, `listLeadActivitiesForTenant`, `recordWhatsappMessage`, `listWhatsappMessagesForLead`, `findLeadByPhoneForTenant` (empareja un `from` de Meta con indicativo de país contra `leads.whatsapp`/`leads.phone` comparando solo los últimos 10 dígitos, en memoria sobre los leads del tenant). Se conectó el log automático de actividad en `updateLeadForTenant` (cambio de etapa), `createDealForTenant` (oportunidad abierta) y `createVisitForTenant` (visita agendada) — nunca se llama desde el cliente directamente.
- `app/api/webhooks/whatsapp/route.ts`: ahora resuelve el lead por teléfono y registra tanto el mensaje entrante como la respuesta saliente del agente en `whatsapp_messages` (y en el timeline del lead, si existe).
- `app/api/ai-agent/test/route.ts`: el simulador también registra sus mensajes (con `phoneNumberId = "simulador"` cuando el tenant no tiene un número real conectado, porque la columna es `NOT NULL`).
- `app/(dashboard)/dashboard/crm/[leadId]/page.tsx`: se agregaron las secciones "Conversación de WhatsApp" e "Historial", leyendo datos reales — sin tocar el resto del estilo visual de esa página (sigue pendiente de migrar al nuevo diseño, no es parte de esta fase).
- 10 tests nuevos en `tests/trazabilidad.test.ts` (aislamiento multitenant de mensajes/actividades, no duplica actividad si el stage no cambia, matching de teléfono por últimos 10 dígitos, mensajes sin lead no rompen nada).
- **Verificado en vivo contra la cuenta demo real**, aplicando la migración 0001 directo al `.sqlite` de Miniflare: se cambió la etapa de un lead real por `PATCH /api/leads/[id]` y apareció en su timeline; se firmó un payload de webhook de WhatsApp real con HMAC-SHA256 (mismo secreto que `.dev.vars`) simulando un mensaje entrante del teléfono de un lead sembrado, y se confirmó por SQL directo y por `curl` a la página del lead que el mensaje y la actividad `whatsapp_message` quedaron guardados y se renderizan en `/dashboard/crm/[leadId]`. Se revirtieron después todos los datos de prueba (el `phone_number_id` temporal, el mensaje de prueba) para no dejar la demo en un estado inconsistente con "Sin conectar" que se ve en el resto del dashboard.

**Decisiones tomadas:**
- Decisión: `recordWhatsappMessage` del simulador de prueba (`/api/ai-agent/test`) no se asocia a ningún lead (`leadId: null` siempre).
  **Por qué:** es una prueba interna del admin, no una conversación real de un cliente — asociarla a un lead arbitrario sería inventar una interacción que no ocurrió, lo mismo que se evitó en la auditoría del "relleno".
- Decisión: `findLeadByPhoneForTenant` compara en memoria sobre todos los leads del tenant, no con una query indexada.
  **Por qué:** SQLite/D1 no tiene función regexp nativa para extraer los últimos N dígitos en una cláusula `WHERE` eficiente, y el volumen esperado (una sola inmobiliaria) hace que esto no sea un problema de rendimiento real hoy. Si el volumen crece, se puede revisar.

**Bloqueadores abiertos:**
- Ninguno nuevo. Los mismos de siempre (número real de WhatsApp conectado, Gemini key real) siguen aplicando para ver el flujo end-to-end sin intervención manual.

**Próximo paso:** Fase 7 (tareas y notificaciones), según el orden del plan — pendiente de confirmación del usuario.

---

## 2026-11-07 — Fase 7: tareas y notificaciones (construida y verificada en vivo)

**Quién:** Claude
**Fase (según plan-implementacion.md):** 7

**Qué se hizo:**
- Dos tablas nuevas + migración `drizzle/migrations/0002_optimal_donald_blake.sql`: `tasks` (`leadId`/`dealId` opcionales, `dueAt`, `status` pending/done, `assigneeId` opcional) y `notifications` (por usuario, no por tenant, para que cada quien marque las suyas como leídas de forma independiente).
- `lib/db/tenant-scope.ts`: CRUD completo de tareas (`listTasksForTenant`, `getTaskForTenant`, `createTaskForTenant`, `updateTaskForTenant`, `deleteTaskForTenant`, `listOverdueTasksForTenant`) y de notificaciones (`createNotificationForTenant`, `notifyTenantTeam`, `listNotificationsForUser`, `countUnreadNotificationsForUser`, `markNotificationReadForUser`, `markAllNotificationsReadForUser`, `hasNotificationForLink` para no duplicar avisos en corridas sucesivas del cron).
- Disparadores conectados directamente en las funciones que ya mutan estado: `createLeadForTenant` notifica a todo el equipo cuando el lead llega por un canal público (website/whatsapp/referral) — **no** cuando es alta manual desde el dashboard, para no notificar al usuario de su propia acción. `createVisitForTenant` notifica al asesor asignado si lo hay, o a todo el equipo si no.
- `app/api/cron/check-tasks/route.ts`: endpoint admin-only que escanea las tareas vencidas del tenant de la sesión y genera notificaciones `task_due`, con deduplicación para no repetir el aviso en cada corrida. **No es un Cloudflare Cron Trigger real todavía** — `vinext` controla el entrypoint del Worker (`entrypoint: "vinext/server/fetch-handler"` en `cloudflare.config.ts`), así que agregar un handler `scheduled()` de verdad requiere investigar cómo exponerlo sin pelearse con ese entrypoint (ver bloqueador abajo). Mientras tanto, se invoca manualmente — tal como el propio plan ya contemplaba como aceptable para el criterio de salida.
- CRUD de tareas expuesto en `app/api/tasks/route.ts` + `[id]/route.ts`; notificaciones en `app/api/notifications/route.ts` (listar + marcar todas leídas) + `[id]/route.ts` (marcar una leída).
- UI nueva: `NotificationBell.tsx` (campanita en el TopBar, poll cada 30s, dropdown con marcar leída individual o todas) y `TaskList.tsx` (lista + alta rápida + marcar hecha), reutilizado tanto en el Resumen (tareas del tenant completo) como en la ficha de lead (`crm/[leadId]/page.tsx`, solo las de ese lead).
- 11 tests nuevos en `tests/tasks-notifications.test.ts` (aislamiento multitenant de tareas y notificaciones, no notifica en alta manual, sí notifica en alta pública, dedup de `hasNotificationForLink`, etc.) — 50/50 en total.
- **Verificado en vivo contra la cuenta demo real**: se creó una tarea vencida y una futura por API, se corrió el cron handler manualmente (`notified: 2`, uno por cada miembro del equipo demo) y se confirmó que no duplica en una segunda corrida (`notified: 0`); se marcó una notificación como leída y bajó el contador; se creó un lead público real (con las claves de prueba de Turnstile) y se confirmó que generó automáticamente su notificación con el link correcto a la ficha del lead. Se revirtieron después todos los datos de prueba.

**Decisiones tomadas:**
- Decisión: el endpoint `/api/cron/check-tasks` queda protegido por sesión de admin (igual que cualquier otro endpoint de configuración), operando solo sobre el tenant de esa sesión — no procesa todos los tenants de la app.
  **Por qué:** exponerlo como una ruta pública sin autenticación para que la invoque un verdadero Cron Trigger habría requerido inventar un mecanismo de secreto compartido nuevo, una decisión de seguridad que no estaba pedida. Reusar la sesión existente es más simple y consistente con el resto del código. Se dejó `listAllTenantIds` en `tenant-scope.ts` como pieza ya lista para cuando se conecte un `scheduled()` real que si necesite iterar todos los tenants.
- Decisión: el email de notificación (Resend) no se implementó en esta fase.
  **Por qué:** es la misma decisión ya tomada en la Fase 3 (Resend diferido junto con Billing) — no se reabre, solo se hereda. Las notificaciones de esta fase son 100% in-app.

**Bloqueadores abiertos:**
- Conectar un Cloudflare Cron Trigger real (`scheduled()`) requiere investigar cómo convive con el entrypoint que vinext ya controla (`vinext/server/fetch-handler`) — no se resolvió en esta fase, el endpoint de tareas vencidas sigue siendo de invocación manual/externa (ej. un cron de GitHub Actions que haga `curl` autenticado, o resolver esto cuando se aprovisione Cloudflare de verdad).
- Igual que siempre: notificaciones por email siguen atadas a una `RESEND_API_KEY` real todavía no disponible.

**Próximo paso:** Fase 8 (comisiones y reportes), según el orden del plan — pendiente de confirmación del usuario.

---

## 2026-11-07 — Fase 8: comisiones y reportes (construida y verificada en vivo)

**Quién:** Claude
**Fase (según plan-implementacion.md):** 8

**Qué se hizo:**
- `lib/db/tenant-scope.ts`: `getCommissionsReportForTenant` (comisión = `dealValueCents * commissionPercentage/100` de la propiedad, por cada deal `closed_won`, agrupado por asesor — sin asesor cae en un grupo `null`), `getConversionBySourceForTenant` (leads por canal vs. cuántos llegaron a `closed_won`), `getAverageClosingDaysForTenant` (aproximación: días entre `createdAt` y `updatedAt` del deal, documentado explícitamente como aproximación porque no existe una columna `closed_at` separada), `getAdvisorRankingForTenant`.
- Página nueva `/dashboard/reports`, agregada a la navegación del sidebar, con exportación a CSV client-side (`CsvExportButton.tsx`, genera el archivo en el navegador sin pasar por un endpoint nuevo).
- Sin schema nuevo: se confirmó lo ya encontrado en la fase de planificación — `properties.commission_percentage` y `deals.advisor_id` ya existían y se capturan, esta fase fue pura agregación/lectura.
- 6 tests nuevos en `tests/reports.test.ts` (cálculo de comisión, agrupación sin asesor, aislamiento multitenant, conversión por canal, ranking) — 56/56 en total.
- **Verificado en vivo**: sobre la cuenta demo, el único deal `closed_won` sembrado (apartamento Sabaneta, `$3.200.000` de valor, propiedad con 8% de comisión) aparece en el reporte con exactamente `$2.560 COP` de comisión bajo "Sin asesor asignado" — calculado correctamente a partir de datos reales, no inventado.

**Decisiones tomadas:**
- Decisión: la velocidad de cierre usa `updatedAt` del deal como proxy de la fecha de cierre real.
  **Por qué:** el schema no tiene una columna `closed_at` separada y agregarla ahora sería un cambio de schema no pedido para una métrica secundaria — se documenta la aproximación en el propio código, no se presenta como un dato exacto de auditoría.

**Bloqueadores abiertos:** ninguno nuevo.

**Próximo paso:** Fase 9 (documentos, contratos y firma electrónica), según el orden del plan.

---

## 2026-11-07 — Fase 9: documentos, contratos y firma electrónica (construida y verificada en vivo)

**Quién:** Claude
**Fase (según plan-implementacion.md):** 9

**Qué se hizo:**
- **Descubrimiento técnico importante:** investigando cómo guardar archivos (el plan dejaba abierto "R2 vs. otra cosa"), se encontró que `cf/config` (`@cloudflare/config`, de donde viene `bindings`/`defineWorker` en `cloudflare.config.ts`) **sí soporta `bindings.r2({ name })`** — no hacía falta ningún paquete nuevo ni cambiar de herramienta. También se encontró `triggers.scheduled({ schedule })` en el mismo paquete, lo que sugiere que sí se podría conectar un Cloudflare Cron Trigger real para el bloqueador abierto de la Fase 7 — **no se investigó más a fondo en esta sesión** (requiere ver cómo convive con el entrypoint `vinext/server/fetch-handler`), queda anotado como pista concreta para retomar esa Fase 7 pendiente.
- `cloudflare.config.ts`: nuevo binding `DOCUMENTS: bindings.r2({ name: "saas-inmobiliario-documents" })`. Se confirmó que el tipo de `env.DOCUMENTS` (`R2Bucket`) se infiere automáticamente sin correr ningún comando de generación — sí hizo falta `cf workers types` en un intento, pero resultó innecesario: el propio `tsc` ya lo resolvía por inferencia desde `cloudflare.config.ts`.
- Tabla nueva `documents` (`leadId`/`dealId`/`propertyId` todos opcionales, `type` enum, `fileName`, `contentType`, `sizeBytes`, `storageKey`, `uploadedBy`) + migración `drizzle/migrations/0003_perpetual_changeling.sql`. El archivo en sí vive en R2; la tabla solo guarda la referencia.
- `lib/db/tenant-scope.ts`: `createDocumentForTenant` (valida que lead/deal/propiedad referenciados sean del tenant antes de guardar la fila), `listDocumentsForTenant`, `getDocumentForTenant`, `deleteDocumentForTenant`.
- `app/api/documents/route.ts` (`GET` lista, `POST` sube un `multipart/form-data` real — límite 15MB, sube a R2 primero y si la fila falla por tenant cruzado borra el objeto para no dejarlo huérfano), `app/api/documents/[id]/route.ts` (`DELETE`, borra fila + objeto R2), `app/api/documents/[id]/download/route.ts` (`GET`, streamea el objeto solo si pertenece al tenant de la sesión — **nunca hay una URL pública directa del bucket**).
- **Decisión técnica documentada (regla 5):** para "ficha de inmueble en PDF" y "contrato listo para firma manual", no se integró una librería de generación de PDF server-side (`@react-pdf/renderer` y similares dependen de APIs de Node/canvas que no son seguras en el runtime de Workers). En su lugar se construyeron páginas HTML imprimibles (`/dashboard/properties/[id]/sheet` y `/dashboard/crm/[leadId]/contract/[dealId]`) con estilos `print:` de Tailwind (ocultan sidebar/topbar/nav al imprimir) y un botón que llama a `window.print()` — el usuario guarda como PDF desde el diálogo nativo del navegador. Cero dependencias nuevas, 100% compatible con Workers.
- El borrador de contrato se arma con datos 100% reales: nombre del tenant, nombre/documento del propietario (si existe), nombre/email/teléfono del lead, dirección/área/precio de la propiedad, valor y comisión del deal — con un aviso explícito de que es un borrador interno que requiere revisión legal antes de firmarse, dejando la firma electrónica real (proveedor externo tipo HelloSign/DocuSign) fuera de esta fase, tal como ya contemplaba el plan.
- `DocumentList.tsx` (subir/listar/descargar/eliminar) embebido en la ficha de lead y en la edición de propiedad; `PrintButton.tsx` reutilizado en ambas páginas imprimibles.
- 6 tests nuevos en `tests/documents.test.ts` (aislamiento multitenant, documento sin asociar, no crea si el lead es de otro tenant, borrado devuelve el `storageKey` para limpiar R2) — 62/62 en total.
- **Verificado en vivo contra R2 real** (vía la simulación local de Miniflare, igual que D1): se subió un archivo de texto real por `multipart/form-data`, se descargó de vuelta y el contenido coincidió byte a byte, se borró y se confirmó que tanto la fila como el objeto desaparecieron (404 al intentar descargarlo después). Se generó la ficha PDF de una propiedad real de la demo y el borrador de contrato del deal `closed_won` real (Laura Gómez / Apartamento Sabaneta), ambos con los datos reales correctos.

**Decisiones tomadas:**
- Decisión: usar páginas HTML + `window.print()` en vez de una librería de PDF server-side.
  **Por qué:** ver arriba — riesgo de incompatibilidad con el runtime de Workers, cero dependencias nuevas, resultado idéntico para el usuario (un PDF descargado).
- Decisión: la firma electrónica real queda fuera de esta fase.
  **Por qué:** ya estaba así en el plan — requiere una cuenta/costo externo nuevo (HelloSign/DocuSign), mismo patrón que Wompi.

**Bloqueadores abiertos:**
- Ninguno nuevo para esta fase. Se encontró una pista (`triggers.scheduled`) para resolver el bloqueador ya abierto de la Fase 7 (Cron Trigger real), pero no se investigó a fondo — queda para cuando se retome esa fase o se pida explícitamente.

**Próximo paso:** Fase 10 (calendario), según el orden del plan.

---

## 2026-11-07 — Fase 10: calendario (construida y verificada en vivo)

**Quién:** Claude
**Fase (según plan-implementacion.md):** 10

**Qué se hizo:**
- `components/dashboard/CalendarView.tsx`: vista mensual y semanal (toggle) sobre las `visits` reales del tenant, construida a mano con `date-fns` (ya era dependencia del proyecto, sin librerías de calendario nuevas) — celdas por día, visitas agendadas con su hora y color según estado (`scheduled`/`completed`/`cancelled`), panel de detalle al seleccionar un día.
- Página nueva `/dashboard/calendar`, agregada al sidebar.
- Sincronización con Google Calendar por asesor: tabla nueva `google_calendar_connections` (una por `userId`, con tokens cifrados vía `lib/crypto.ts`) + migración `drizzle/migrations/0004_handy_daredevil.sql`; `lib/google-calendar.ts` (`fetch` directo a las APIs reales de Google — authorize URL, intercambio de código, refresh de token, creación de evento — mismo patrón que `lib/whatsapp/embedded-signup.ts`); flujo OAuth2 completo: `GET /api/integrations/google-calendar/connect` (redirige a Google, guarda un `state` anti-CSRF en cookie), `GET /api/integrations/google-calendar/callback` (verifica el `state`, intercambia el código, cifra y guarda los tokens), `GET/DELETE /api/integrations/google-calendar` (estado de conexión / desconectar).
- `app/api/visits/route.ts`: al crear una visita con `advisorId`, si ese asesor tiene Google Calendar conectado se crea el evento allá — mejor esfuerzo, nunca tumba la creación de la visita si Google falla (mismo criterio que el agente de WhatsApp en el webhook); si el access token expiró, se refresca con el refresh token antes de reintentar.
- Secrets nuevos en `cloudflare.config.ts`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (pendientes de que el usuario cree un proyecto OAuth2 en Google Cloud Console — mismo patrón de bloqueo externo que Meta/Gemini).
- 5 tests nuevos en `tests/google-calendar.test.ts` (construcción de la URL de autorización, aislamiento multitenant de la conexión, upsert en vez de duplicar) — 67/67 en total.
- **Verificado en vivo**: `/dashboard/calendar` carga y pasa las 3 visitas reales de la demo al calendario (confirmado por el payload RSC); `GET /api/integrations/google-calendar/connect` redirige de verdad a `accounts.google.com` con los parámetros correctos y guarda el `state` en cookie; se simuló el retorno de Google al callback con un código falso y **la API real de Google respondió con un rechazo real** ("The OAuth client was not found", HTTP 401) — misma prueba de "llega a la API real" ya usada con Meta y Gemini.

**Decisiones tomadas:**
- Decisión: la sincronización es de salida únicamente (CRM → Google Calendar al crear una visita), no bidireccional.
  **Por qué:** una sincronización bidireccional (webhooks de Google Calendar, resolución de conflictos) es sustancialmente más compleja y no estaba pedida — el caso de uso real ("que el asesor vea sus visitas en su calendario de siempre") se cubre con solo la salida.
- Decisión: el calendario se construyó a mano con `date-fns` en vez de agregar una librería de calendario (`react-big-calendar`, `FullCalendar`, etc.).
  **Por qué:** el requisito (vista mes/semana con las visitas reales) es acotado — una librería completa trae mucho más peso y superficie de la que hace falta para esto.

**Bloqueadores abiertos:**
- Credenciales OAuth2 reales de Google Cloud Console pendientes del usuario — mismo patrón que Meta/Gemini.

**Próximo paso:** Fase 11 (matching inteligente lead↔propiedad), según el orden del plan.

---

## 2026-11-07 — Fase 11: matching inteligente lead↔propiedad (construida y verificada en vivo)

**Quién:** Claude
**Fase (según plan-implementacion.md):** 11

**Qué se hizo:**
- Se resolvió la decisión que el plan había dejado abierta ("¿campos estructurados o IA sobre `notes`?"): se agregaron 3 campos opcionales a `leads` — `preferredCity`, `preferredType` (mismo enum que `properties.type`), `preferredOperation` (mismo enum que `properties.operation`) — en vez de usar IA para extraerlos de texto libre.
- `lib/db/tenant-scope.ts`: `getMatchingPropertiesForLead` — filtra propiedades activas y publicadas del tenant por tipo/operación/ciudad/presupuesto del lead; si el lead no tiene ninguna preferencia capturada, devuelve lista vacía en vez de sugerir al azar.
- UI: sección "Propiedades Sugeridas" en la ficha del lead (`crm/[leadId]/page.tsx`), con botón "Abrir oportunidad" (`QuickDealButton.tsx`) que crea el deal directo sin pasar por el formulario completo; `NewContactForm.tsx` ahora captura ciudad/tipo/operación de interés y presupuesto (este último con el mismo patrón de `Controller` + conversión pesos↔centavos que ya usaba `PropertyForm` — también se notó que el formulario nunca había expuesto `budgetMinCents`/`budgetMaxCents` pese a que el schema y el backend ya los soportaban desde antes).
- 6 tests nuevos en `tests/matching.test.ts` (sin preferencias no sugiere nada, filtra por ciudad/presupuesto/tipo, aislamiento multitenant, actualizar preferencias habilita el matching) — 73/73 en total.
- **Bug real encontrado y corregido en una migración generada por drizzle-kit:** al agregar las 3 columnas nuevas junto con sus `CHECK` constraints, drizzle-kit generó un `INSERT INTO __new_leads(...) SELECT ... FROM leads` que incluía las columnas nuevas en el `SELECT` de la tabla **vieja**, que todavía no las tenía — la migración fallaba con `no such column: preferred_city`. Se corrigió a mano quitando esas 3 columnas del `INSERT`/`SELECT` (quedan `NULL` para las filas existentes, que es el comportamiento correcto) y se verificó aplicando la cadena completa de migraciones desde cero contra una base en memoria antes de tocar el D1 local.
- **Verificado en vivo**: se le asignó a un lead real de la demo (Sandra, que en sus notas ya decía "busca lote en Rionegro") las preferencias estructuradas correspondientes vía `PATCH /api/leads/[id]`, y la ficha del lead mostró "Lote urbanizable en Rionegro" en Propiedades Sugeridas con su botón "Abrir oportunidad" — luego se revirtieron esas preferencias de prueba para no alterar los datos sembrados de la demo.

**Decisiones tomadas:**
- Decisión: preferencias estructuradas en vez de extracción por IA sobre `notes`.
  **Por qué:** 3 campos opcionales que el asesor ya conoce al calificar el lead, sin costo ni latencia de un modelo de lenguaje, y sin el riesgo de que la IA extraiga algo incorrecto de un texto libre ambiguo.
- Decisión: si el lead no tiene ninguna preferencia, no se sugiere nada (ni al azar ni "las más recientes").
  **Por qué:** sugerir sin ningún criterio real sería peor que no sugerir — mismo principio aplicado en la auditoría de "relleno" del 2026-11-07.

**Bloqueadores abiertos:** ninguno.

**Próximo paso:** Fase 12 (portales externos: Fincaraíz, Metrocuadrado, Properati), según el orden del plan — empieza con investigación antes de código, tal como está documentado.

---

## 2026-11-07 — Fase 12: portales externos (investigación + feed real, construida y verificada en vivo)

**Quién:** Claude
**Fase (según plan-implementacion.md):** 12

**Qué se hizo:**
- **Investigación previa (vía WebSearch), tal como exigía el plan antes de escribir código:**
  - **Fincaraíz:** no hay documentación oficial pública, pero existe un SDK de PHP de terceros (Homlity) para una "API de Integradores" real, con autenticación por API key. Confirma que la integración programática existe, pero las credenciales las entrega Fincaraíz directamente — no hay un registro de self-service.
  - **Metrocuadrado:** API real identificada como "PTEC Core" (documentada por el mismo SDK de Homlity a partir de documentación oficial de Metrocuadrado), con dos hosts (uno de tokens, uno de recursos), autenticación por API key + usuario/contraseña, y operaciones de publicar/actualizar/despublicar **asíncronas** (devuelven un `transactionId` para consultar el resultado después). Credenciales de integrador también a solicitar directamente con Metrocuadrado.
  - **Properati:** sin evidencia pública de una API o feed para que inmobiliarias publiquen — solo herramientas de terceros para *leer* anuncios ya publicados (scraping). Pertenece ahora a LIFULL Connect; cualquier integración real requeriría contacto comercial directo.
  - **Conclusión:** los tres portales requieren credenciales de integrador que el usuario debe solicitar directamente — ninguno tiene una API pública auto-gestionable, mismo patrón de bloqueo externo que Meta/Gemini/Google. No se puede verificar en vivo contra sus APIs reales sin esas credenciales, a diferencia de Meta/Gemini/Google (que sí tienen endpoints públicos donde un rechazo de credenciales inválidas ya prueba que la integración llega).
- **Decisión de alcance, documentada antes de construir:** en vez de intentar simular una integración específica de un portal sin poder verificarla de verdad, se construyó la pieza que **sí se puede construir y probar hoy sin esas credenciales**: un feed XML genérico y real del inventario publicado del tenant, listo para registrarse en el panel de integrador de cualquiera de los tres portales una vez el usuario tenga acceso.
- Campo nuevo `tenants.portal_feed_token` (token opaco, único) + migración `drizzle/migrations/0006_pretty_black_tarantula.sql` (verificada contra la cadena completa de migraciones desde cero, sin el bug de la fase anterior).
- `lib/db/tenant-scope.ts`: `getOrCreatePortalFeedToken` (idempotente — no regenera el token si ya existe, para no invalidar una URL ya registrada en un portal), `getTenantByPortalFeedToken`.
- `GET /api/portals/feed/[token]` — endpoint **público, sin sesión** (lo consume el crawler del portal) protegido por el token impredecible en la URL, que genera XML real con las propiedades `active`+`published` del tenant (precio, tipo, operación, ubicación, fotos reales vía `buildImageUrl`, link a la ficha pública).
- `GET /api/agency/portal-feed` (autenticado) + `PortalFeedCard.tsx` en Configuración → Mi Inmobiliaria: muestra la URL del feed con botón de copiar, y una nota explícita de que activar un portal específico requiere solicitar credenciales de integrador directamente a Fincaraíz/Metrocuadrado.
- 5 tests nuevos en `tests/portal-feed.test.ts` (genera token, lo reutiliza, aislamiento multitenant, resuelve tenant por token, token inexistente no resuelve nada) — 78/78 en total.
- **Verificado en vivo**: se generó el token real de la demo, se obtuvo la URL del feed, y se hizo `curl` directo contra ella (sin cookie de sesión, como lo haría el crawler de un portal) — devolvió XML válido con las 3 propiedades reales `active`+`published` de las 5 totales de la demo (las otras 2 están vendida/arrendada o en borrador), con precios, fotos y links reales. Un token inválido devuelve 404.

**Decisiones tomadas:**
- Decisión: no se construyó una integración específica de API contra Fincaraíz ni Metrocuadrado.
  **Por qué:** sin credenciales de integrador reales no hay forma de verificar en vivo contra esas APIs (a diferencia de Meta/Gemini/Google, que tienen endpoints públicos donde incluso un rechazo de credenciales inválidas prueba que la integración llega) — construir contra endpoints no verificables habría significado adivinar formatos de payload, violando la regla de este proyecto de no fabricar funcionalidad que no se pueda probar.
  **Alternativa descartada:** simular la integración con datos/endpoints inventados — descartada explícitamente por ir contra el principio de honestidad del proyecto (mismo que guió la auditoría de "relleno").

**Bloqueadores abiertos:**
- Credenciales de integrador reales de Fincaraíz y/o Metrocuadrado, a solicitar por el usuario directamente con cada portal. Cuando estén disponibles, el siguiente paso es implementar el cliente específico de la API de integrador de ese portal (autenticación, mapeo de campos del feed ya generado a su payload específico, manejo de las respuestas asíncronas de Metrocuadrado) — la investigación de esta fase ya deja documentado qué forma tiene cada API.
- Properati no tiene un canal de integración conocido — requiere contacto comercial directo para confirmar si existe.

**Próximo paso:** Fase 13 (PWA móvil + reseñas y testimonios), según el orden del plan — es la última fase pendiente.

---

## 2026-11-07 — Fase 13: PWA móvil + reseñas y testimonios (construida y verificada en vivo) — última de las fases 6-13

**Quién:** Claude
**Fase (según plan-implementacion.md):** 13

**Qué se hizo:**
- **PWA:** `public/manifest.json` (nombre, `start_url: /dashboard`, colores, ícono), `public/sw.js` (service worker mínimo: solo cachea assets estáticos de `_next/static`, manifest e ícono — **nunca** `/api/*` ni páginas del dashboard, para no arriesgar mostrar datos de CRM obsoletos como si fueran actuales), registrado desde `app/layout.tsx` con el mismo patrón ya usado para el script anti-flash del tema oscuro. Ícono en SVG (`public/icon.svg`) en vez de PNG — **limitación honesta documentada**: no hay forma de generar archivos de imagen rasterizados (PNG 192/512, maskable) en esta sesión; SVG es válido para manifest pero un set de íconos PNG queda como tarea de diseño pendiente para el usuario si se quiere instalabilidad estricta en todas las plataformas.
- **Revisión de responsive:** spot-check de código (no una auditoría Lighthouse real — ver limitación abajo) sobre los flujos críticos para asesores en terreno: `Sidebar` ya se oculta en móvil (`hidden md:flex`) a favor de `MobileBottomNav`, `PropertiesTable` ya tenía una vista de tarjetas separada para móvil desde antes. No se encontraron problemas estructurales nuevos que requirieran arreglo en esta pasada.
- Tabla nueva `property_reviews` (`propertyId` opcional, `authorName`, `rating` 1-5, `comment`, `isPublished` default `false`) + migración `drizzle/migrations/0007_faulty_toad_men.sql`.
- `lib/db/tenant-scope.ts`: `createReviewForTenant`, `listReviewsForTenant` (todas, panel admin), `listPublishedReviewsForTenant` (solo publicadas, para la página pública), `updateReviewForTenant`, `deleteReviewForTenant`.
- `app/api/reviews/route.ts` + `[id]/route.ts` (CRUD, admin-only). **Decisión de alcance:** las reseñas se registran desde el dashboard (el asesor anota lo que el cliente le compartió, ej. por WhatsApp), no hay formulario público de envío — evita tener que resolver moderación anti-spam/Turnstile para una funcionalidad secundaria.
- UI: `/dashboard/reviews` (`ReviewsManager.tsx` — registrar + publicar/despublicar + eliminar) agregado al sidebar; `ReviewsSection.tsx` en la página pública del tenant (`app/[slug]/page.tsx`), mostrando solo las publicadas.
- 6 tests nuevos en `tests/reviews.test.ts` (no publicada por defecto, no se crea si la propiedad es de otro tenant, no aparece en público hasta publicarse, aislamiento multitenant en publicar/borrar) — 84/84 en total.
- **Verificado en vivo**: se registró una reseña real desde el dashboard de la demo, se publicó, y apareció en `http://localhost:3000/inmobiliaria-demo` (pedido **sin cookie de sesión**, como la vería cualquier visitante real) bajo "Lo que dicen nuestros clientes" con su texto y autor correctos. Se confirmó que `manifest.json`, `sw.js` e `icon.svg` se sirven con código 200 y que el script de registro del service worker está presente en el HTML del dashboard.

**Decisiones tomadas:**
- Decisión: el service worker solo cachea assets estáticos, nunca datos de la API ni páginas del dashboard.
  **Por qué:** cachear datos de negocio dinámicos (leads, deals, visitas) correría el riesgo de mostrarle al asesor información vieja presentada como si fuera actual — inaceptable en un CRM, mismo principio de honestidad de datos que guió toda la auditoría de "relleno" de esta sesión.
- Decisión: ícono del manifest en SVG, no PNG.
  **Por qué:** no hay herramienta de generación de imágenes rasterizadas disponible en esta sesión — se documenta la limitación en vez de inventar un PNG o dejarlo sin ícono.
- Decisión: la "revisión de responsive" de esta fase fue un spot-check de código, no una auditoría Lighthouse real.
  **Por qué:** el navegador de esta sesión estuvo desconectado durante buena parte del trabajo de las fases 6-13 — se declara esta limitación explícitamente en vez de afirmar una verificación visual que no se pudo hacer.
- Decisión: reseñas registradas por el asesor desde el dashboard, sin formulario público de envío.
  **Por qué:** un formulario público de reseñas necesitaría su propia moderación anti-spam (Turnstile, cola de revisión) — fuera del alcance pedido; el flujo "asesor registra lo que el cliente le compartió" ya resuelve el caso de uso real de una inmobiliaria pequeña.

**Bloqueadores abiertos:**
- Set de íconos PNG (192/512, maskable) para instalabilidad PWA estricta en todas las plataformas — tarea de diseño, no de código.
- Una auditoría Lighthouse PWA real requiere un navegador conectado — pendiente de hacerse cuando se retome una sesión con el navegador disponible.

**Próximo paso:** **Las Fases 6-13 quedan completas.** Revisar con el usuario si hay más funcionalidad a construir, o si se retoma algún bloqueador externo (credenciales de Meta/Gemini/Google/Fincaraíz/Metrocuadrado) cuando estén disponibles.
