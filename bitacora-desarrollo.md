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

- **Fase activa:** 0 — Fundaciones. Todo lo que dependía solo de código está cerrado: schema Drizzle (14 tablas, con los mismos CHECK del blueprint), binding D1, Better Auth, `lib/crypto.ts`, `lib/db/tenant-scope.ts` y su prueba de aislamiento. 7 tests en verde, `npm run build` y `npx tsc --noEmit` limpios.
- **Versión del blueprint:** v1.6
- **Pendiente para cerrar la Fase 0 del todo:** aprovisionar de verdad en una cuenta de Cloudflare (`cf d1 create`, confirmar plan de Cloudflare Images, cuenta Turnstile) — requiere login/credenciales del usuario, no se puede hacer desde acá.
- **Bloqueadores abiertos (no bloquean Fase 0/1/2):** duración del token de WhatsApp (riesgo 10 del blueprint) y estrategia de message templates (riesgo 11) — solo bloquean la Fase 3.
- **Próximo paso:** o (a) el usuario provisiona Cloudflare para cerrar la Fase 0 por completo, o (b) se adelanta a la Fase 1 (Inventario de Propiedades) sobre el schema ya validado, y el aprovisionamiento real se hace antes del primer deploy.

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
