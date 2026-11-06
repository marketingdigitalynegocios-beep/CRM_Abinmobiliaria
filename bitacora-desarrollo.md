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

- **Fase activa:** 0 — Fundaciones (arrancando scaffold del proyecto)
- **Versión del blueprint:** v1.6
- **Bloqueadores resueltos:** compatibilidad vinext/Next (confirmado funcionando), plan de Cloudflare Images (el flag `--image-optimization cloudflare-images` del scaffold confirma el camino técnico; falta solo confirmar costo/plan de cuenta)
- **Bloqueadores abiertos:** duración del token de WhatsApp (riesgo 10 del blueprint) y estrategia de message templates (riesgo 11) — estos siguen bloqueando solo la Fase 3, no la 0/1/2
- **Próximo paso:** scaffold real del proyecto en la raíz del repo (`create-vinext-app`), git init, y arrancar `lib/db/tenant-scope.ts` + su prueba de aislamiento multitenant

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
