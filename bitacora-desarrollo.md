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

- **Fase activa:** 1 — Inventario de Propiedades. **Completa y verificada en vivo**: onboarding, CRUD de propiedades/propietarios con UI de dashboard, `ImageUploader`, bulk-status/bulk-import, catálogo público y detalle con galería/mapa/WhatsApp. Se corrió el flujo real (registro → crear propiedad → verla pública → importar CSV → marcar vendida → ver el badge) contra D1 local de verdad (Miniflare), no solo tests unitarios. 15 tests unitarios en verde, `npm run build`/`npx tsc --noEmit` limpios.
- **Versión del blueprint:** v1.6
- **Pendiente de Fase 0 (no bloquea seguir):** aprovisionar de verdad en una cuenta de Cloudflare (`cf d1 create`, plan de Cloudflare Images, Turnstile) — requiere login del usuario. Lo de hoy se probó contra la simulación local de Miniflare, no contra Cloudflare real.
- **Bloqueadores abiertos (solo bloquean Fase 3):** duración del token de WhatsApp (riesgo 10) y estrategia de message templates (riesgo 11).
- **Próximo paso:** probar la Fase 1 a mano desde el navegador (hasta ahora solo por API/curl), y luego decidir entre cerrar los pendientes de Fase 0 (aprovisionar Cloudflare real) o arrancar la Fase 2 (CRM: leads + deals).

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
