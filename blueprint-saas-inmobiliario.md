# BLUEPRINT TÉCNICO — SaaS Inmobiliario
**Versión 1.7 — Noviembre 2026 | Stack Cloudflare (hosting + base de datos) | Para implementación con Antigravity**

> **Estado:** `BORRADOR` → cambiar a `APROBADO` cuando esté revisado
>
> **Cambio de versión 1.6 → 1.7:** se audita (solo lectura) una integración Meta Tech Provider propia ya en producción (`WhatsflowAI-V2`) para resolver los dos riesgos abiertos del agente de WhatsApp. Riesgo 10 (token): se adopta un **System User Token único a nivel de app** (`META_SYSTEM_USER_TOKEN`) en vez del token por tenant del Embedded Signup — `ai_agent_configs.whatsapp_access_token_enc` deja de ser necesario. Riesgo 11 (ventana 24h/templates): el MVP solo responde a mensajes entrantes, así que no aplica tal como estaba planteado. Ver §11, §14 y §15.
>
> **Cambio de versión 1.1 → 1.2:** se reemplaza Supabase (Auth + Postgres + Storage + Edge Functions) y Vercel por el stack de Cloudflare completo (Workers + D1 + Cloudflare Images). Ver sección 15 para los gaps y riesgos que trae este cambio de arquitectura.
>
> **Cambio de versión 1.2 → 1.3:** se retira Plazbot como proveedor intermedio de WhatsApp. El equipo ya cuenta con una app propia registrada ante Meta como Tech Provider; el agente de IA se conecta directo a la WhatsApp Business Cloud API y cada tenant autoriza su número con Embedded Signup. Ver §11 y §14.
>
> **Cambio de versión 1.3 → 1.4:** se agrega el módulo de **Inventario de Propiedades** (tabla `property_owners`, código interno, mandato/comisión, visibilidad pública independiente del status comercial, importación CSV y acciones masivas). Antes, el CRUD de propiedades cubría el catálogo pero no la relación con el propietario/mandante ni la operación de cargar/gestionar un portafolio grande. Ver §6, §7, §8 y §14.
>
> **Cambio de versión 1.5 → 1.6:** se probó el scaffold real de vinext (`create-vinext-app --platform cloudflare --image-optimization cloudflare-images`) antes de arrancar la Fase 0. Confirma que el riesgo 3 de §15 está resuelto, pero corrige dos supuestos: el proyecto se administra con el CLI **`cf`** y `cloudflare.config.ts`, no con `wrangler.jsonc`; y la estructura de carpetas real no usa wrapper `src/`. Ver §4 y §15.
>
> **Cambio de versión 1.4 → 1.5:** se revisó el plugin `houzez-crm` (tema WordPress compartido por el equipo) y se adopta su separación de **Lead** (contacto calificado) y **Deal/oportunidad** (negocio concreto sobre una propiedad, con valor y pipeline propio). `leads.stage` se simplifica a `new/contacted/disqualified`; se agrega la tabla `deals`, que pasa a alimentar el `KanbanBoard`. El resto de los gaps encontrados en esa revisión (stages configurables, timeline de actividades, campos de propiedad como lote/video/tour 360°) quedan diferidos a v2 — ver §15, riesgo 13.

---

## 1. DEFINICIÓN DEL MVP

**El problema (una oración):**
Las inmobiliarias medianas en Colombia no tienen una plataforma propia asequible para publicar su portafolio, gestionar sus clientes y automatizar la atención por WhatsApp — todo en un solo sistema bajo su marca.

**El usuario principal:**
Gerente o dueño de inmobiliaria mediana en Colombia (5–30 asesores), con portafolio de 20–200 propiedades, que actualmente usa Wasi, Excel o WhatsApp manual para operar.

**La solución:**
Plataforma SaaS multitenant donde cada inmobiliaria tiene su propio slug (`/[slug]`), su página pública con catálogo de propiedades, un CRM para gestionar leads y sus propiedades de interés, y un módulo para configurar un agente de IA conectado a WhatsApp que atiende clientes 24/7.

**Métrica de éxito del MVP:**
1 inmobiliaria con onboarding completo: página publicada con 5+ propiedades, 3+ leads registrados en el CRM y agente de WhatsApp respondiendo consultas de propiedades en menos de 2 minutos.

---

## 2. FLUJO PRINCIPAL

### Flujo del Admin de Inmobiliaria
1. Admin se registra → crea su cuenta de inmobiliaria → elige plan → paga con Wompi
2. Completa perfil de la empresa (nombre, logo, colores, slug personalizado)
3. Publica propiedades (tipo, precio, fotos, descripción, ubicación)
4. Clientes visitan la página pública → hacen contacto → entran al CRM como leads
5. Admin califica el lead (Nuevo → Contactado) y abre una oportunidad (deal) por cada propiedad de interés; gestiona esos deals en el pipeline kanban (Nuevo → Reunión → Calificado → Propuesta → Negociación → Cerrado ganado/perdido)
6. Activa el agente de IA de WhatsApp para responder automáticamente

### Flujo del Cliente Final (página pública)
1. Visita el slug de la inmobiliaria (`tuapp.com/[slug]`)
2. Filtra propiedades por tipo, precio, habitaciones, ciudad
3. Ve detalle de propiedad con galería, mapa y características
4. Contacta por WhatsApp → el agente de IA responde

---

## 3. FUERA DEL ALCANCE (MVP)

- Editor visual drag-and-drop de la página pública (MVP usa templates fijos)
- App móvil nativa (iOS / Android)
- Integración con portales externos (Metrocuadrado, Finca Raíz)
- Módulo de contratos digitales o firma electrónica
- Chat en tiempo real entre asesores y clientes dentro de la plataforma
- Reportes y analytics avanzados
- Multi-idioma (solo español en MVP)
- Integraciones con Stripe, PayU u otras pasarelas (solo Wompi en MVP)
- Roles granulares dentro de la inmobiliaria (solo `admin` y `advisor` en MVP)
- Tours virtuales 360°
- Comparador de propiedades side-by-side
- Geocodificación automática (coordenadas se ingresan manualmente en MVP)
- Subdominios propios por inmobiliaria (`inmobiliaria.tuapp.com`) — en v1.1 se descartaba por complejidad de DNS/SSL en Vercel; con Cloudflare esto se vuelve mucho más simple (ver sección 14), pero se mantiene fuera del MVP para no ampliar scope

---

## 4. STACK TECNOLÓGICO

### Stack Base (no modificar)

| Tecnología | Propósito | Versión | Notas del cambio a Cloudflare |
|---|---|---|---|
| Next.js (vía vinext) | Framework full-stack con App Router | — (no hay paquete `next`; `vinext` reimplementa su superficie de API sobre Vite) | **Confirmado (v1.6):** `npx create-vinext-app` funciona hoy, con `--platform cloudflare --image-optimization cloudflare-images` como flags de primera clase. Resuelve el riesgo 3/1 de §15 |
| **Cloudflare Workers + vinext** | Hosting, runtime y deploy del Next.js | — | **Reemplaza Vercel.** Un solo Worker sirve el frontend, los Route Handlers y el webhook del agente de IA |
| **Cloudflare D1** | Base de datos relacional (SQLite) multitenant | — | **Reemplaza Supabase Postgres.** Sin RLS nativo: el aislamiento por tenant se fuerza en la capa de repositorio (ver §6 y §15) |
| **Better Auth** | Auth (email/password + magic link + sesiones) | latest, adapter D1/Drizzle | **Reemplaza Supabase Auth.** Corre dentro del mismo Worker |
| **Cloudflare Images** | Storage + resize/optimización de fotos | — | **Reemplaza Supabase Storage + `sharp`.** `sharp` no corre en el runtime de Workers (binarios nativos); Cloudflare Images resuelve upload directo, variantes y entrega por CDN |
| Tailwind CSS | Estilos utilitarios | 3.x | sin cambios |
| shadcn/ui | Componentes UI accesibles | latest | sin cambios |
| TypeScript | Tipado estricto | 5.x | sin cambios |

### Dependencias Adicionales

| Paquete npm | Propósito | Justificación |
|---|---|---|
| `drizzle-orm` | ORM para D1 | Tipado end-to-end sobre SQLite/D1, generación de migraciones |
| `drizzle-kit` (dev) | Migraciones D1 | Genera y aplica el SQL de migración a partir del schema TS |
| `better-auth` | Auth completo (password, magic link, sesiones, invitaciones de equipo) | SDK con adapter oficial para D1/Drizzle, corre nativamente en Workers |
| `react-hook-form` | Formularios | Menos re-renders, validación eficiente |
| `zod` | Validación de esquemas | Validación en cliente y servidor |
| `@hookform/resolvers` | Bridge RHF + Zod | Integración directa |
| `zustand` | Estado global | Ligero, sin boilerplate |
| `@tanstack/react-query` | Data fetching / cache | Cache de propiedades y leads |
| `react-dropzone` | UI de drag & drop de imágenes | El archivo se sube directo a Cloudflare Images (upload URL firmada), no pasa por el Worker |
| `@hello-pangea/dnd` | Kanban drag & drop | Pipeline CRM |
| `react-photo-view` | Galería de propiedades | Lightbox para fotos |
| `leaflet` + `react-leaflet` | Mapas | Ubicación de propiedades (OSM, gratuito) |
| `@types/leaflet` | Types para Leaflet | TypeScript support |
| `date-fns` | Manejo de fechas | Agendar visitas en CRM |
| `resend` | Emails transaccionales | SDK basado en `fetch`, compatible con Workers sin APIs de Node |
| `slugify` | Generación de slugs | URLs de propiedades e inmobiliarias |
| `papaparse` | Parseo de CSV | Importación masiva del inventario existente (Excel/Wasi → CSV) |
| `clsx` + `tailwind-merge` | Utilidades de clases | Gestión condicional de Tailwind |

**Removido respecto a v1.1:** `@supabase/ssr`, `@supabase/supabase-js`, `sharp`, `@google/generative-ai` (se llama a Gemini por `fetch` directo al endpoint REST, ver §11, para no depender de compatibilidad Node del SDK dentro de Workers).

### Instalación

```bash
npm install drizzle-orm better-auth react-hook-form zod @hookform/resolvers
npm install zustand @tanstack/react-query react-dropzone @hello-pangea/dnd
npm install react-photo-view leaflet react-leaflet @types/leaflet date-fns
npm install resend slugify clsx tailwind-merge papaparse

npm install -D drizzle-kit @cloudflare/workers-types
# vinext, @vinext/cloudflare, vite, @cloudflare/vite-plugin y cf ya quedan instalados por create-vinext-app
```

### Componentes shadcn/ui a instalar

```bash
npx shadcn@latest add button input label textarea select checkbox
npx shadcn@latest add card badge dialog sheet dropdown-menu
npx shadcn@latest add table tabs avatar separator toast
npx shadcn@latest add form skeleton popover calendar command
```

### Infraestructura Cloudflare a provisionar

> **Nota v1.6:** se probó el scaffolding real de vinext (`create-vinext-app`) y confirma que **no** genera `wrangler.jsonc` ni usa `wrangler` como CLI principal — genera `cloudflare.config.ts` y se administra con el CLI **`cf`** (más nuevo que Wrangler; ver la skill `cloudflare` de este entorno: "si el proyecto tiene `cloudflare.config.ts`, usar `cf`, no Wrangler"). También coloca `app/`, `lib/`, `components/` etc. **en la raíz del proyecto, sin wrapper `src/`** — la estructura de carpetas de la sección 5 de este blueprint usa `src/` solo por claridad organizativa; al generar el proyecto real, quitar ese prefijo.

```bash
# Scaffold inicial del proyecto (Next.js vía vinext, destino Cloudflare, con Cloudflare Images)
npx create-vinext-app . --platform cloudflare --image-optimization cloudflare-images

# Base de datos D1
cf d1 create saas-inmobiliario-db

# Migraciones D1 (compatible con el formato de `wrangler d1 migrations`, pero generadas con drizzle-kit)
cf d1 migrations apply --dir drizzle/migrations

# Secrets del Worker (uno por variable; confirmar la sintaxis exacta con `cf cli search "workers secrets update"` al implementar)
cf workers secrets update

# Deploy
npm run deploy   # internamente corre `vinext-cloudflare deploy`
```

`cloudflare.config.ts` generado por el scaffold (bindings se agregan acá, no en un `wrangler.jsonc`):

```typescript
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
      DB: bindings.d1({ name: "saas-inmobiliario-db" }), // confirmado (v1.6): D1BindingOptions = { id?, name?, dev? }
    },
  }),
});
```

Secrets a cargar (no van en `cloudflare.config.ts`, se cargan con el CLI): `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, `CLOUDFLARE_IMAGES_API_TOKEN`, `TURNSTILE_SECRET_KEY`.

---

## 5. ESTRUCTURA DE CARPETAS

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Sidebar + header del admin
│   │   ├── dashboard/page.tsx            # Resumen: propiedades, leads, stats
│   │   ├── properties/                   # Módulo de Inventario de Propiedades
│   │   │   ├── page.tsx                  # Lista/inventario: filtros, código interno, acciones masivas
│   │   │   ├── new/page.tsx              # Crear propiedad
│   │   │   ├── [id]/edit/page.tsx        # Editar propiedad
│   │   │   └── owners/
│   │   │       ├── page.tsx              # Lista de propietarios/mandantes
│   │   │       ├── new/page.tsx          # Crear propietario
│   │   │       └── [id]/edit/page.tsx    # Editar propietario
│   │   ├── crm/
│   │   │   ├── page.tsx                  # Pipeline kanban de deals (oportunidades)
│   │   │   ├── contacts/page.tsx         # Lista de leads/contactos
│   │   │   └── [leadId]/page.tsx         # Detalle de lead: datos, propiedades de interés y sus deals
│   │   ├── ai-agent/
│   │   │   └── page.tsx                  # Config agente WhatsApp + IA
│   │   ├── settings/
│   │   │   ├── agency/page.tsx           # Info, logo, colores, slug
│   │   │   ├── billing/page.tsx          # Plan y pagos Wompi
│   │   │   └── team/page.tsx             # Asesores del equipo
│   │   └── website/page.tsx              # Preview + config página pública
│   ├── [slug]/
│   │   ├── page.tsx                      # Página pública inmobiliaria (SSR)
│   │   └── property/[propertyId]/page.tsx # Detalle público propiedad (SSR)
│   ├── api/
│   │   ├── webhooks/
│   │   │   ├── wompi/route.ts
│   │   │   └── whatsapp/route.ts         # GET verificación + POST mensaje entrante Meta → Gemini → responde (corre en este mismo Worker)
│   │   ├── properties/
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   ├── bulk-status/route.ts      # Acción masiva: cambiar status/visibility de varias propiedades
│   │   │   └── bulk-import/route.ts      # Importación CSV del portafolio existente (Excel/Wasi)
│   │   ├── property-owners/route.ts      # CRUD de propietarios/mandantes
│   │   ├── leads/route.ts
│   │   ├── deals/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── visits/route.ts
│   │   ├── ai-agent/route.ts
│   │   ├── upload/route.ts               # Emite upload URL firmada de Cloudflare Images
│   │   └── whatsapp/
│   │       └── connect/route.ts          # Callback de Embedded Signup: intercambia el code por access token
│   ├── layout.tsx
│   └── page.tsx                          # Landing del SaaS
├── components/
│   ├── ui/                               # shadcn/ui (auto-generado)
│   ├── dashboard/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── StatsCard.tsx
│   ├── properties/
│   │   ├── PropertyCard.tsx
│   │   ├── PropertyForm.tsx
│   │   ├── PropertyGallery.tsx
│   │   ├── PropertyFilters.tsx
│   │   ├── ImageUploader.tsx
│   │   ├── PropertyOwnerForm.tsx         # Alta/edición de propietario-mandante
│   │   ├── PropertyOwnerPicker.tsx       # Buscar/asociar propietario existente al crear una propiedad
│   │   ├── BulkActionsBar.tsx            # Cambiar status/visibility de varias propiedades seleccionadas
│   │   └── CsvImportDialog.tsx           # Importación masiva del portafolio (CSV)
│   ├── crm/
│   │   ├── KanbanBoard.tsx               # Pipeline de deals (oportunidades), no de leads
│   │   ├── KanbanColumn.tsx
│   │   ├── DealCard.tsx
│   │   ├── DealForm.tsx                  # Abrir una oportunidad desde la ficha de un lead
│   │   ├── LeadCard.tsx
│   │   ├── LeadForm.tsx
│   │   └── VisitScheduler.tsx
│   ├── public/
│   │   ├── AgencyHeader.tsx
│   │   ├── PropertyGrid.tsx
│   │   ├── SearchBar.tsx
│   │   ├── PropertyDetailPage.tsx
│   │   └── WhatsAppButton.tsx
│   └── shared/
│       ├── PageHeader.tsx
│       ├── ConfirmDialog.tsx
│       └── EmptyState.tsx
├── lib/
│   ├── db/
│   │   ├── client.ts                     # getDb(env): instancia Drizzle sobre el binding D1
│   │   ├── schema.ts                     # Tablas Drizzle (incluye las generadas por Better Auth)
│   │   └── tenant-scope.ts               # Helper obligatorio: toda query de dominio pasa por acá (ver §15 riesgo 1)
│   ├── auth/
│   │   ├── auth.ts                       # Config de Better Auth (adapter D1, plugin magic link)
│   │   └── client.ts                     # Cliente de Better Auth para componentes
│   ├── wompi/
│   │   └── client.ts
│   ├── whatsapp/
│   │   ├── graph-client.ts               # Envío de mensajes via Graph API (WhatsApp Cloud API)
│   │   └── embedded-signup.ts            # Intercambio de code → access token, registro de phone_number_id/waba_id
│   ├── ai/
│   │   └── agent.ts                      # Lógica del agente: arma contexto + llama a Gemini por fetch
│   ├── images/
│   │   └── cloudflare-images.ts          # Mint de direct upload URL + construcción de URLs de entrega
│   ├── crypto.ts                         # Encrypt/decrypt con Web Crypto (SubtleCrypto AES-GCM)
│   ├── validations/
│   │   ├── property.ts
│   │   ├── lead.ts
│   │   └── agency.ts
│   └── utils.ts
├── hooks/
│   ├── useProperties.ts
│   ├── useLeads.ts
│   └── useTenant.ts
├── types/
│   └── index.ts                          # Todos los tipos del dominio
├── stores/
│   └── useAppStore.ts                    # Zustand store global
└── middleware.ts                          # Auth + tenant routing (corre nativamente en el Worker, sin distinción "edge runtime" vs Node)

drizzle/
└── migrations/                            # SQL generado por drizzle-kit

drizzle.config.ts
wrangler.jsonc
```

> **Nota de simplificación respecto a v1.1:** ya no existe la carpeta `supabase/functions/`. La función que antes vivía en una Supabase Edge Function aparte (`plazbot-webhook`, runtime Deno) ahora es un Route Handler más (`src/app/api/webhooks/whatsapp/route.ts`) dentro del mismo Worker, porque Cloudflare Workers no tiene el límite de 10s de Vercel free que motivaba separarla, y porque el binding de D1 ya está disponible directamente en el Worker sin round-trip adicional. Un solo artefacto de deploy en vez de dos.
>
> **Cambio de versión 1.2 → 1.3:** se retira Plazbot como proveedor intermedio de WhatsApp. Ya existe una app propia registrada ante Meta como Tech Provider (Business Solution Provider), así que el SaaS habla directo con la WhatsApp Business Cloud API y cada tenant conecta su número vía Embedded Signup. Ver §11 y §14.

---

## 6. BASE DE DATOS

### Diagrama de Relaciones

```
tenants → users (1:N, extiende el esquema de Better Auth) → properties (1:N) → property_images (1:N)
tenants → property_owners (1:N) → properties
tenants → leads (1:N) → lead_property_interests (N:M) → properties
tenants → leads (1:N) → deals (1:N) → properties (cada deal referencia una propiedad concreta)
tenants → visits (1:N) → leads + properties + deals (opcional)
tenants → ai_agent_configs (1:1)
tenants → subscriptions (1:1)
```

### Usuarios y sesiones: gestionados por Better Auth

Better Auth, con su adapter de Drizzle/D1, genera y mantiene sus propias tablas (`user`, `session`, `account`, `verification`) al correr:

```bash
npx @better-auth/cli generate
```

La tabla `user` se extiende con **campos adicionales** (`additionalFields` en la config de Better Auth) para cubrir lo que en v1.1 vivía en la tabla `users` propia:

| Campo adicional en `user` | Tipo | Equivalente en v1.1 |
|---|---|---|
| `tenant_id` | text, FK → `tenants.id` | `users.tenant_id` |
| `role` | text, `'admin' \| 'advisor'`, default `'advisor'` | `users.role` |
| `phone` | text, nullable | `users.phone` |
| `is_active` | boolean, default `true` | `users.is_active` |

`name` y `image` de Better Auth cubren `full_name` y `avatar_url`. El resto del dominio (`properties.advisor_id`, `leads.advisor_id`, `visits.advisor_id`) referencia `user.id` de Better Auth.

### SQL del dominio — dialecto SQLite/D1, copiar con `wrangler d1 execute`

```sql
-- =============================================
-- D1 no tiene UUID nativo ni gen_random_uuid(): los ids se generan en la
-- aplicación con crypto.randomUUID() (disponible nativamente en el runtime
-- de Workers) y se insertan como TEXT. El schema solo declara la columna.
-- =============================================

PRAGMA foreign_keys = ON;

CREATE TABLE tenants (
  id            TEXT PRIMARY KEY NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  logo_image_id TEXT,                 -- id de imagen en Cloudflare Images (antes logo_url)
  phone         TEXT,
  email         TEXT,
  city          TEXT,
  address       TEXT,
  website       TEXT,
  primary_color TEXT NOT NULL DEFAULT '#1B4FBF',
  template      TEXT NOT NULL DEFAULT 'modern' CHECK (template IN ('modern', 'classic', 'minimal')),
  whatsapp_number TEXT,
  description   TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE property_owners (
  id           TEXT PRIMARY KEY NOT NULL,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name    TEXT NOT NULL,
  document_id  TEXT,                 -- cédula/NIT del propietario, para el mandato
  phone        TEXT,
  email        TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE properties (
  id              TEXT PRIMARY KEY NOT NULL,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advisor_id      TEXT REFERENCES user(id),
  owner_id        TEXT REFERENCES property_owners(id),   -- propietario/mandante, distinto de los leads (compradores/arrendatarios)
  internal_code   TEXT,               -- código interno de inventario (ej. "AP-0042"), como ya lo manejan en Excel/Wasi
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL CHECK (type IN ('apartment','house','commercial','land')),
  operation       TEXT NOT NULL CHECK (operation IN ('sale','rent','sale_rent')),
  price_cents     INTEGER NOT NULL,   -- antes NUMERIC(14,2); SQLite no tiene DECIMAL exacto, se guarda en centavos
  currency        TEXT NOT NULL DEFAULT 'COP',
  area_m2         REAL,
  bedrooms        INTEGER,
  bathrooms       INTEGER,
  parking_spots   INTEGER NOT NULL DEFAULT 0,
  stratum         INTEGER,
  city            TEXT,
  neighborhood    TEXT,
  address         TEXT,
  latitude        REAL,
  longitude       REAL,
  cover_image_id  TEXT,               -- id de imagen en Cloudflare Images (antes cover_image_url)
  is_featured     INTEGER NOT NULL DEFAULT 0,  -- SQLite no tiene BOOLEAN: 0/1
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','sold','rented')),  -- disponibilidad comercial
  visibility      TEXT NOT NULL DEFAULT 'published' CHECK (visibility IN ('draft','published','archived')), -- si aparece o no en /[slug], independiente de status
  listing_type    TEXT NOT NULL DEFAULT 'exclusive' CHECK (listing_type IN ('exclusive','shared','open')),   -- mandato exclusivo / compartido / captación abierta
  mandate_start_date TEXT,
  mandate_end_date   TEXT,
  commission_percentage REAL,
  amenities_json  TEXT NOT NULL DEFAULT '[]',  -- antes TEXT[]; SQLite no tiene arrays, se guarda como JSON
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(tenant_id, slug),
  UNIQUE(tenant_id, internal_code)
);

CREATE TABLE property_images (
  id          TEXT PRIMARY KEY NOT NULL,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  image_id    TEXT NOT NULL,          -- id de imagen en Cloudflare Images (antes url)
  alt_text    TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE leads (
  id           TEXT PRIMARY KEY NOT NULL,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  advisor_id   TEXT REFERENCES user(id),
  full_name    TEXT NOT NULL,
  email        TEXT,
  phone        TEXT,
  whatsapp     TEXT,
  source       TEXT NOT NULL DEFAULT 'website' CHECK (source IN ('website','whatsapp','referral','manual')),
  stage        TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new','contacted','disqualified')),  -- solo calificación del contacto; el pipeline de venta vive en `deals`
  notes        TEXT,
  budget_min_cents NUMERIC,
  budget_max_cents NUMERIC,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE lead_property_interests (
  id          TEXT PRIMARY KEY NOT NULL,
  lead_id     TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(lead_id, property_id)
);

-- Oportunidad de venta/arriendo sobre UNA propiedad concreta. Un mismo lead puede
-- tener varios deals simultáneos (interesado en dos propiedades a la vez); el
-- kanban del CRM (§8 KanbanBoard.tsx) pasa a operar sobre esta tabla, no sobre `leads`.
CREATE TABLE deals (
  id                 TEXT PRIMARY KEY NOT NULL,
  tenant_id          TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id            TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  property_id        TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  advisor_id         TEXT REFERENCES user(id),
  title              TEXT,              -- ej. "Apto Laureles - Juan Pérez"; si es nulo se arma en la UI con lead + property
  deal_value_cents    INTEGER,          -- monto esperado del negocio (no necesariamente igual al price_cents de la propiedad)
  stage              TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new','meeting_scheduled','qualified','proposal_sent','negotiation','closed_won','closed_lost')),
  next_action        TEXT,              -- ej. "Llamar", "Enviar propuesta", "Agendar visita" — texto libre en MVP (ver §15 sobre listas configurables, diferido a v2)
  expected_close_date TEXT,             -- ISO 8601
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE visits (
  id            TEXT PRIMARY KEY NOT NULL,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id       TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  property_id   TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  deal_id       TEXT REFERENCES deals(id) ON DELETE SET NULL,  -- opcional: a qué oportunidad pertenece esta visita
  advisor_id    TEXT REFERENCES user(id),
  scheduled_at  TEXT NOT NULL,        -- ISO 8601
  status        TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE ai_agent_configs (
  id                       TEXT PRIMARY KEY NOT NULL,
  tenant_id                TEXT UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  is_active                INTEGER NOT NULL DEFAULT 0,
  whatsapp_waba_id         TEXT,       -- WhatsApp Business Account ID, devuelto por Embedded Signup
  whatsapp_phone_number_id TEXT,       -- identifica el número conectado del tenant; se indexa para resolver el webhook
  whatsapp_display_number  TEXT,       -- número en formato legible, solo para mostrar en el panel
  whatsapp_access_token_enc TEXT,      -- token de la Cloud API del tenant, cifrado con lib/crypto.ts (Web Crypto AES-GCM), no Node 'crypto'
  gemini_key_enc           TEXT,       -- cifrado con lib/crypto.ts
  system_prompt            TEXT,
  welcome_message          TEXT,
  created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE subscriptions (
  id              TEXT PRIMARY KEY NOT NULL,
  tenant_id       TEXT UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan            TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','starter','pro','enterprise')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','cancelled','trialing')),
  wompi_reference TEXT,
  current_period_start TEXT,
  current_period_end   TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- =============================================
-- ÍNDICES
-- =============================================

CREATE INDEX idx_properties_tenant   ON properties(tenant_id);
CREATE INDEX idx_properties_status   ON properties(status);
CREATE INDEX idx_properties_type     ON properties(type);
CREATE INDEX idx_properties_owner    ON properties(owner_id);
CREATE INDEX idx_property_owners_tenant ON property_owners(tenant_id);
CREATE INDEX idx_leads_tenant        ON leads(tenant_id);
CREATE INDEX idx_leads_stage         ON leads(stage);
CREATE INDEX idx_deals_tenant        ON deals(tenant_id);
CREATE INDEX idx_deals_stage         ON deals(stage);
CREATE INDEX idx_deals_lead          ON deals(lead_id);
CREATE INDEX idx_deals_property      ON deals(property_id);
CREATE INDEX idx_visits_tenant       ON visits(tenant_id);
CREATE INDEX idx_visits_scheduled    ON visits(scheduled_at);
CREATE INDEX idx_ai_agent_phone_number ON ai_agent_configs(whatsapp_phone_number_id);

-- =============================================
-- TRIGGERS: updated_at automático (sintaxis SQLite)
-- =============================================

CREATE TRIGGER trg_tenants_updated_at
AFTER UPDATE ON tenants BEGIN
  UPDATE tenants SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_properties_updated_at
AFTER UPDATE ON properties BEGIN
  UPDATE properties SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_property_owners_updated_at
AFTER UPDATE ON property_owners BEGIN
  UPDATE property_owners SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_leads_updated_at
AFTER UPDATE ON leads BEGIN
  UPDATE leads SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_deals_updated_at
AFTER UPDATE ON deals BEGIN
  UPDATE deals SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_subscriptions_updated_at
AFTER UPDATE ON subscriptions BEGIN
  UPDATE subscriptions SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_ai_agent_updated_at
AFTER UPDATE ON ai_agent_configs BEGIN
  UPDATE ai_agent_configs SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;
```

### Aislamiento multitenant: sin RLS, forzado en código (lee esto con atención)

D1 **no tiene Row Level Security** como Postgres. En v1.1 el aislamiento entre inmobiliarias lo garantizaba la base de datos (`get_my_tenant_id()` + políticas `USING (tenant_id = get_my_tenant_id())`); en D1 esa garantía no existe a nivel de motor, así que se reemplaza por una convención de código **obligatoria**, no opcional:

- Todas las queries de dominio (properties, property_owners, leads, deals, visits, lead_property_interests, ai_agent_configs, subscriptions) pasan por `lib/db/tenant-scope.ts`, que expone funciones como `getPropertiesForTenant(db, tenantId, filters)` y nunca aceptan un `tenant_id` que no venga de la sesión autenticada (nunca del body/query del request).
- Las rutas públicas (página `/[slug]`, `POST /api/leads`) resuelven primero `tenant_id` a partir del `slug` en una sola consulta controlada, y ese `tenant_id` — no uno enviado por el cliente — es el que se usa para todo lo demás en ese request.
- Se recomienda (no bloqueante para MVP) una prueba automatizada que, por cada endpoint autenticado, verifique que un usuario del tenant A nunca puede leer/escribir filas del tenant B.

Ver también §15, riesgo 1.

---

## 7. ENDPOINTS DE API

> Los contratos (request/response) no cambian respecto a v1.1 salvo donde se indica. Todos corren como Route Handlers de Next.js dentro del Worker.

### `GET /api/properties`
```typescript
// Auth: requerida (tenant admin, vía sesión de Better Auth)
// Query: page?: number, limit?: number, type?: string, status?: string, operation?: string,
//        owner_id?: string, visibility?: 'draft' | 'published' | 'archived', internal_code?: string (búsqueda exacta/prefijo)

// Response 200
{
  properties: Property[],
  total: number,
  page: number,
  limit: number
}
// Errores: 401 Unauthorized, 400 Bad Request
```

### `POST /api/properties`
```typescript
// Auth: requerida

// Request body
{
  title: string
  type: 'apartment' | 'house' | 'commercial' | 'land'
  operation: 'sale' | 'rent' | 'sale_rent'
  price_cents: number             // antes "price" en pesos; ahora en centavos
  currency?: string               // default 'COP'
  area_m2?: number
  bedrooms?: number
  bathrooms?: number
  parking_spots?: number
  stratum?: number
  city?: string
  neighborhood?: string
  address?: string
  latitude?: number
  longitude?: number
  description?: string
  amenities?: string[]
  cover_image_id?: string         // antes cover_image_url
  is_featured?: boolean
  owner_id?: string               // propietario/mandante (módulo de Inventario)
  internal_code?: string          // código interno de inventario, único por tenant
  visibility?: 'draft' | 'published' | 'archived'   // default 'published'
  listing_type?: 'exclusive' | 'shared' | 'open'    // default 'exclusive'
  mandate_start_date?: string     // ISO 8601
  mandate_end_date?: string       // ISO 8601
  commission_percentage?: number
}

// Response 201
{ property: Property }
// Errores: 401, 400 (validación Zod), 409 (slug o internal_code duplicado)
```

### `PATCH /api/properties/[id]`
```typescript
// Auth: requerida
// Body: Partial<PropertyInput>
// Response 200: { property: Property }
// Errores: 401, 404, 400
```

### `DELETE /api/properties/[id]`
```typescript
// Auth: requerida
// Response 200: { success: true }
// Errores: 401, 404
```

### `PATCH /api/properties/bulk-status`
```typescript
// Auth: requerida
// Propósito: cambiar status y/o visibility de varias propiedades a la vez
// (ej. marcar 10 propiedades como "sold" tras un cierre, o archivar un lote)

// Request body
{
  property_ids: string[]
  status?: 'active' | 'inactive' | 'sold' | 'rented'
  visibility?: 'draft' | 'published' | 'archived'
}

// Response 200: { updated: number }
// Errores: 401, 400
```

### `POST /api/properties/bulk-import`
```typescript
// Auth: requerida (solo admin)
// Body: FormData con campo "file" (CSV con columnas mapeadas a PropertyInput)
// Propósito: cargar de una vez el portafolio que la inmobiliaria ya tiene en Excel/Wasi,
// en vez de crear cada propiedad una por una en el wizard

// Response 200
{
  created: number
  skipped: number              // filas con error de validación
  errors: { row: number, message: string }[]
}
// Errores: 401, 400 (CSV mal formado)
```

### `GET /api/property-owners`
```typescript
// Auth: requerida
// Query: search?: string, page?: number, limit?: number
// Response 200: { owners: PropertyOwner[], total: number }
// Errores: 401
```

### `POST /api/property-owners`
```typescript
// Auth: requerida

// Request body
{
  full_name: string
  document_id?: string
  phone?: string
  email?: string
  notes?: string
}

// Response 201: { owner: PropertyOwner }
// Errores: 401, 400
```

### `PATCH /api/property-owners/[id]`
```typescript
// Auth: requerida
// Body: Partial<PropertyOwnerInput>
// Response 200: { owner: PropertyOwner }
// Errores: 401, 404, 400
```

### `DELETE /api/property-owners/[id]`
```typescript
// Auth: requerida
// Response 200: { success: true }
// Errores: 401, 404, 409 (tiene propiedades asociadas; reasignar antes de borrar)
```

### `GET /api/leads`
```typescript
// Auth: requerida
// Query: stage?: Stage, page?: number, limit?: number

// Response 200
{
  leads: Lead[],
  total: number
}
// Errores: 401
```

### `POST /api/leads`
```typescript
// Auth: pública (desde formulario de contacto en página pública)
// Protegida con Cloudflare Turnstile (nuevo en v1.2, ver §11 y §15 riesgo 2)

// Request body
{
  tenant_slug: string             // antes tenant_id: se resuelve el tenant_id en el servidor a partir del slug
  full_name: string
  email?: string
  phone?: string
  whatsapp?: string
  source: 'website' | 'whatsapp' | 'referral' | 'manual'
  property_id?: string
  turnstile_token: string         // token del widget Turnstile, validado server-side antes de insertar
}

// Response 201
{ lead: Lead }
// Errores: 400, 422, 403 (Turnstile inválido)
```

### `PATCH /api/leads/[id]`
```typescript
// Auth: requerida
// Nota: el embudo de venta ya no vive acá — ver /api/deals. Este endpoint solo
// califica el contacto (new/contacted/disqualified) y edita sus datos.

// Request body
{
  stage?: 'new' | 'contacted' | 'disqualified'
  advisor_id?: string
  notes?: string
  budget_min_cents?: number
  budget_max_cents?: number
}

// Response 200: { lead: Lead }
// Errores: 401, 404
```

### `GET /api/deals`
```typescript
// Auth: requerida
// Query: stage?: DealStage, lead_id?: string, property_id?: string, page?: number, limit?: number
// Response 200: { deals: Deal[], total: number }
// Errores: 401
```

### `POST /api/deals`
```typescript
// Auth: requerida
// Propósito: abrir una oportunidad concreta de venta/arriendo entre un lead y
// una propiedad (un lead puede tener varios deals abiertos a la vez)

// Request body
{
  lead_id: string
  property_id: string
  title?: string
  deal_value_cents?: number
  advisor_id?: string
  next_action?: string
  expected_close_date?: string    // ISO 8601
}

// Response 201: { deal: Deal }
// Errores: 401, 400, 404 (lead o property no existen en este tenant)
```

### `PATCH /api/deals/[id]`
```typescript
// Auth: requerida
// Propósito: mover el deal en el kanban (stage) y/o editar sus datos

// Request body
{
  stage?: 'new' | 'meeting_scheduled' | 'qualified' | 'proposal_sent' | 'negotiation' | 'closed_won' | 'closed_lost'
  deal_value_cents?: number
  advisor_id?: string
  next_action?: string
  expected_close_date?: string
}

// Response 200: { deal: Deal }
// Errores: 401, 404
```

### `POST /api/visits`
```typescript
// Auth: requerida

// Request body
{
  lead_id: string
  property_id: string
  deal_id?: string                // opcional: a qué oportunidad pertenece esta visita
  scheduled_at: string             // ISO 8601
  advisor_id?: string
  notes?: string
}

// Response 201: { visit: Visit }
// Errores: 401, 400, 409 (conflicto de agenda)
```

### `POST /api/upload`
```typescript
// Auth: requerida
// Body: { context: 'property' | 'agency_logo' }
// Propósito: en vez de recibir el archivo, emite una Direct Creator Upload URL de
// Cloudflare Images (válida ~30 min) con metadata { tenant_id, context } para
// poder auditar a qué tenant pertenece cada imagen. El cliente sube el archivo
// directamente a esa URL (no pasa por el Worker), y Cloudflare Images genera
// las variantes "public" y "thumbnail" automáticamente.

// Response 200
{
  upload_url: string             // URL para el PUT directo del archivo desde el cliente
  image_id: string                // id a guardar en cover_image_id / property_images.image_id
}
// Errores: 401, 400 (context inválido)
```

### `GET /api/ai-agent`
```typescript
// Auth: requerida (solo admin)
// Response 200: { config: AIAgentConfig }
// Errores: 401, 403
```

### `PUT /api/ai-agent`
```typescript
// Auth: requerida (solo admin)

// Request body
{
  is_active: boolean
  gemini_key: string             // se cifra con lib/crypto.ts antes de guardar (gemini_key_enc)
  system_prompt: string
  welcome_message: string
}
// Nota: la conexión del número de WhatsApp ya no se hace pegando tokens a mano
// acá — se hace con POST /api/whatsapp/connect (Embedded Signup). Este endpoint
// solo edita el comportamiento del agente.

// Response 200: { config: AIAgentConfig }
// Errores: 401, 403, 400
```

### `POST /api/whatsapp/connect`
```typescript
// Auth: requerida (solo admin)

// Request body
{
  code: string                   // authorization code devuelto por el SDK de Embedded Signup de Meta (FB.login)
}

// Propósito: intercambia el code por un access token de la WhatsApp Cloud API
// (Graph API /oauth/access_token), obtiene el waba_id y phone_number_id que el
// tenant autorizó, suscribe ese WABA a los webhooks de la app (una sola vez por
// WABA), y guarda todo cifrado en ai_agent_configs.

// Response 200
{
  whatsapp_phone_number_id: string
  whatsapp_display_number: string
}
// Errores: 401, 400, 502 (error devuelto por Meta)
```

### `GET /api/webhooks/whatsapp`
```typescript
// Propósito: handshake de verificación que Meta exige al registrar la URL del webhook
// Query: hub.mode, hub.verify_token, hub.challenge
// Si hub.verify_token === META_WEBHOOK_VERIFY_TOKEN → Response 200 con el valor de hub.challenge
// Errores: 403 (verify_token no coincide)
```

### `POST /api/webhooks/whatsapp`
```typescript
// Auth: validación de la firma X-Hub-Signature-256 (HMAC-SHA256 sobre el body
// crudo con META_APP_SECRET, calculado con Web Crypto)
// Propósito: recibir mensaje entrante de WhatsApp Cloud API, resolver el tenant
// por metadata.phone_number_id del payload de Meta, armar contexto con
// propiedades activas (D1), llamar a Gemini por fetch REST, y responder al
// cliente llamando a la Graph API con el access token del tenant.
// Nota: una sola URL de webhook cubre a todos los tenants conectados a la app
// (Meta la reenvía con el phone_number_id de cada uno); no hay una URL por tenant.
// Response: siempre 200 OK (evitar reintentos de Meta)
```

### `POST /api/webhooks/wompi`
```typescript
// Auth: firma HMAC-SHA256, verificada con Web Crypto (SubtleCrypto), no con el módulo 'crypto' de Node
// checksum = SHA256(reference + status + amount_in_cents + currency + events_secret)
// Propósito: actualizar subscriptions.status al confirmar pago
// Response: 200 OK
// Errores: 400 (firma inválida)
```

---

## 8. COMPONENTES PRINCIPALES

### `KanbanBoard.tsx`
- **Ubicación:** `src/components/crm/KanbanBoard.tsx`
- **Propósito:** Pipeline visual drag & drop de **oportunidades (deals)** por etapa — ya no de leads (ver decisión en §14, "Separar Lead de Deal")
- **Props:** `deals: Deal[]`, `onStageChange: (dealId: string, stage: DealStage) => void`
- **Estado:** `columns: Record<DealStage, Deal[]>` derivado de props
- **API:** `PATCH /api/deals/[id]`
- **Librería:** `@hello-pangea/dnd`

### `DealCard.tsx`
- **Ubicación:** `src/components/crm/DealCard.tsx`
- **Propósito:** Tarjeta del kanban: nombre del lead, propiedad, `deal_value_cents`, `next_action` y asesor asignado
- **Props:** `deal: Deal`

### `DealForm.tsx`
- **Ubicación:** `src/components/crm/DealForm.tsx`
- **Propósito:** Abrir una nueva oportunidad desde la ficha de un lead, eligiendo la propiedad de interés, valor esperado y próxima acción
- **Props:** `leadId: string`, `onSuccess: () => void`
- **API:** `POST /api/deals`

### `PropertyForm.tsx`
- **Ubicación:** `src/components/properties/PropertyForm.tsx`
- **Propósito:** Formulario multisección para crear/editar propiedades (wizard en pasos): datos básicos, ubicación, fotos, y un paso de **inventario** (propietario, código interno, tipo de mandato, vigencia, comisión, visibilidad)
- **Props:** `property?: Property` (si existe = modo edición), `onSuccess: () => void`
- **Estado:** `react-hook-form` + `zod`, `currentStep: number`
- **API:** `POST` o `PATCH /api/properties`, `POST /api/upload`

### `PropertyOwnerForm.tsx`
- **Ubicación:** `src/components/properties/PropertyOwnerForm.tsx`
- **Propósito:** Alta/edición de un propietario/mandante (persona dueña del inmueble, distinta de los leads/compradores del CRM)
- **Props:** `owner?: PropertyOwner`, `onSuccess: () => void`
- **API:** `POST` o `PATCH /api/property-owners`

### `PropertyOwnerPicker.tsx`
- **Ubicación:** `src/components/properties/PropertyOwnerPicker.tsx`
- **Propósito:** Combobox con búsqueda para asociar un propietario existente a una propiedad desde `PropertyForm`, con opción de crear uno nuevo sin salir del wizard
- **API:** `GET /api/property-owners?search=`

### `BulkActionsBar.tsx`
- **Ubicación:** `src/components/properties/BulkActionsBar.tsx`
- **Propósito:** Barra que aparece al seleccionar filas en la tabla de inventario, para cambiar `status`/`visibility` de varias propiedades a la vez
- **Props:** `selectedIds: string[]`, `onDone: () => void`
- **API:** `PATCH /api/properties/bulk-status`

### `CsvImportDialog.tsx`
- **Ubicación:** `src/components/properties/CsvImportDialog.tsx`
- **Propósito:** Sube un CSV exportado de Excel/Wasi, muestra una vista previa mapeando columnas, y reporta filas creadas/omitidas con sus errores
- **API:** `POST /api/properties/bulk-import`
- **Librería:** `papaparse` (parseo en el cliente para la vista previa)

### `AgencyHeader.tsx`
- **Ubicación:** `src/components/public/AgencyHeader.tsx`
- **Propósito:** Header de la página pública con branding de la inmobiliaria
- **Props:** `tenant: Tenant` (nombre, logo, colores, whatsapp_number)
- **Estado:** Sin estado local (componente presentacional SSR)
- **Nota:** Aplica `primary_color` del tenant como CSS custom property `--color-primary`

### `ImageUploader.tsx`
- **Ubicación:** `src/components/properties/ImageUploader.tsx`
- **Propósito:** Drag & drop de imágenes con preview y reordenamiento
- **Props:** `images: { id: string, url: string }[]`, `onChange: (images) => void`, `maxImages?: number`
- **Estado:** `files: File[]`, `uploading: boolean`, `previews: string[]`
- **Flujo (cambia en v1.2):** por cada archivo, pide a `POST /api/upload` una Direct Creator Upload URL de Cloudflare Images, sube el archivo directo a esa URL desde el navegador, y guarda el `image_id` devuelto — ya no pasa el binario por el servidor ni se redimensiona con `sharp`

### `AIAgentConfig.tsx`
- **Ubicación:** `src/app/(dashboard)/ai-agent/page.tsx` (inline)
- **Propósito:** Botón "Conectar WhatsApp" (lanza el SDK de Embedded Signup de Meta) + formulario de prompt/mensaje de bienvenida + probar el agente
- **Props:** `config: AIAgentConfig`
- **Estado:** `react-hook-form`, `isConnectingWhatsApp: boolean`, `testMessage: string`, `testResponse: string`, `isTesting: boolean`
- **API:** `GET + PUT /api/ai-agent`, `POST /api/whatsapp/connect`
- **Nota:** ya no hay campos de texto para pegar tokens manualmente; la conexión del número completa se hace con el flujo de Embedded Signup y el `code` resultante se envía a `/api/whatsapp/connect`

---

## 9. PÁGINAS Y RUTAS

| Ruta | ¿Auth? | Descripción |
|---|---|---|
| `/` | No | Landing del SaaS (pricing, features, CTA registro) |
| `/login` | No | Login con email/password y magic link (Better Auth) |
| `/register` | No | Registro + creación de tenant + onboarding inicial |
| `/dashboard` | Sí | Resumen: stats, últimas props, últimos leads |
| `/dashboard/properties` | Sí | Inventario: tabla de propiedades con filtros, código interno y acciones masivas |
| `/dashboard/properties/new` | Sí | Formulario multistep para crear propiedad (incluye paso de inventario) |
| `/dashboard/properties/[id]/edit` | Sí | Editar propiedad existente |
| `/dashboard/properties/owners` | Sí | Lista de propietarios/mandantes |
| `/dashboard/properties/owners/new` | Sí | Crear propietario |
| `/dashboard/properties/owners/[id]/edit` | Sí | Editar propietario |
| `/dashboard/crm` | Sí | Kanban pipeline de **deals** (oportunidades) por etapa |
| `/dashboard/crm/contacts` | Sí | Lista de todos los leads/contactos |
| `/dashboard/crm/[leadId]` | Sí | Detalle de lead: datos, propiedades de interés y sus deals abiertos/cerrados |
| `/dashboard/ai-agent` | Sí (admin) | Configurar agente IA de WhatsApp |
| `/dashboard/settings/agency` | Sí (admin) | Perfil de la inmobiliaria, slug, branding |
| `/dashboard/settings/billing` | Sí (admin) | Plan actual, historial de pagos, upgrade |
| `/dashboard/settings/team` | Sí (admin) | Invitar y gestionar asesores (invitaciones via Better Auth + Resend) |
| `/dashboard/website` | Sí | Preview de la página pública + elegir template |
| `/[slug]` | No | Página pública de la inmobiliaria (SSR, SEO) |
| `/[slug]/property/[id]` | No | Detalle público de propiedad (SSR, SEO) |

---

## 10. VARIABLES DE ENTORNO

### `NEXT_PUBLIC_` (cliente)

| Variable | Descripción | Dónde obtener |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | URL base del app (`https://tuapp.com`) | Cloudflare Workers → Custom Domains |
| `NEXT_PUBLIC_WOMPI_PUBLIC_KEY` | Clave pública Wompi (sandbox/prod) | Wompi Dashboard → Desarrolladores |
| `NEXT_PUBLIC_CLOUDFLARE_IMAGES_DELIVERY_URL` | Prefijo de entrega de Cloudflare Images (`https://imagedelivery.net/<hash>`) | Cloudflare Dashboard → Images |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site key del widget Turnstile en el form de leads | Cloudflare Dashboard → Turnstile |
| `NEXT_PUBLIC_META_APP_ID` | App ID de la app Meta Tech Provider, usado por el SDK de Embedded Signup | Meta for Developers → la app ya registrada |
| `NEXT_PUBLIC_META_CONFIG_ID` | Configuration ID de Embedded Signup | Meta Business Manager → WhatsApp Manager → Embedded Signup |

> **Nota:** ya no hay `NEXT_PUBLIC_SUPABASE_URL` ni `NEXT_PUBLIC_SUPABASE_ANON_KEY` — D1 no se consulta por URL/API key desde el cliente, es un binding privado del Worker.

### Secrets (servidor — `wrangler secret put`, nunca en `wrangler.jsonc`)

| Variable | Descripción | Dónde obtener |
|---|---|---|
| `WOMPI_PRIVATE_KEY` | Clave privada Wompi | Wompi Dashboard → Desarrolladores |
| `WOMPI_EVENTS_SECRET` | Secret para validar webhooks de Wompi | Wompi Dashboard → Eventos |
| `GEMINI_API_KEY` | API key global de respaldo de Google AI Studio (Gemini) | aistudio.google.com/apikey |
| `RESEND_API_KEY` | API key de Resend para emails | resend.com/api-keys |
| `RESEND_FROM_EMAIL` | Email remitente (`noreply@tuapp.com`) | Dominio verificado en Resend |
| `META_APP_SECRET` | App Secret de la app Meta Tech Provider; firma el intercambio de tokens y valida `X-Hub-Signature-256` del webhook | Meta for Developers → la app ya registrada → Configuración básica |
| `META_WEBHOOK_VERIFY_TOKEN` | Valor arbitrario propio, usado en el handshake `GET` de verificación del webhook | Se define al configurar el webhook en Meta for Developers |
| `ENCRYPTION_KEY` | Clave para cifrar tokens de WhatsApp Cloud API y Gemini en D1 (Web Crypto AES-GCM) | `openssl rand -hex 32` |
| `BETTER_AUTH_SECRET` | Secret de firma de sesiones de Better Auth | `openssl rand -hex 32` |
| `CLOUDFLARE_IMAGES_API_TOKEN` | Token con permiso "Cloudflare Images: Edit" | Cloudflare Dashboard → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID de Cloudflare | Cloudflare Dashboard → sidebar derecho |
| `TURNSTILE_SECRET_KEY` | Secret key para validar el token de Turnstile server-side | Cloudflare Dashboard → Turnstile |

### `.dev.vars` de ejemplo (equivalente local a `.env.local` para Wrangler)
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WOMPI_PUBLIC_KEY=pub_test_xxxx
NEXT_PUBLIC_CLOUDFLARE_IMAGES_DELIVERY_URL=https://imagedelivery.net/xxxx
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
NEXT_PUBLIC_META_APP_ID=1234567890
NEXT_PUBLIC_META_CONFIG_ID=1234567890

WOMPI_PRIVATE_KEY=prv_test_xxxx
WOMPI_EVENTS_SECRET=xxxx
GEMINI_API_KEY=AIza...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@tuapp.com
META_APP_SECRET=xxxx
META_WEBHOOK_VERIFY_TOKEN=xxxx
ENCRYPTION_KEY=64_chars_hex_generado_con_openssl
BETTER_AUTH_SECRET=64_chars_hex_generado_con_openssl
CLOUDFLARE_IMAGES_API_TOKEN=xxxx
CLOUDFLARE_ACCOUNT_ID=xxxx
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

---

## 11. INTEGRACIONES EXTERNAS

### Wompi (Pagos)
- **Paquete:** `fetch` nativo (API REST directa, no SDK oficial)
- **Docs:** https://docs.wompi.co
- **Flujo:**
  1. Frontend carga el Widget de Wompi con la `public_key` y el `amount`
  2. Usuario paga → Wompi redirige con `reference` en la URL
  3. `POST /api/webhooks/wompi` confirma el pago y actualiza `subscriptions`
- **Validación de webhook:** `checksum = SHA256(reference + status + amount_in_cents + currency + events_secret)`, calculado con `crypto.subtle.digest('SHA-256', ...)` del Web Crypto API (sin dependencias de Node)

### Meta WhatsApp Cloud API — Tech Provider propio + Embedded Signup (reemplaza a Plazbot)
- **Por qué sin intermediario:** el equipo ya tiene una app propia registrada ante Meta como Tech Provider (Business Solution Provider). Un proveedor como Plazbot existe para abstraer justamente lo que esa app ya resuelve (Business Verification, registro de números, mensajería), así que agregarlo sería una capa redundante, un costo recurrente y una dependencia externa sin beneficio para este MVP.
- **Conexión por tenant — Embedded Signup (una sola vez por inmobiliaria), solo para identificar el número:**
  1. El admin entra a `/dashboard/ai-agent` y hace clic en "Conectar WhatsApp"
  2. Se abre el flujo de Embedded Signup de Meta (`FB.login` con `NEXT_PUBLIC_META_CONFIG_ID`): el admin autoriza y selecciona/crea su WhatsApp Business Account y número desde la propia UI de Meta
  3. El SDK devuelve un `code` en el cliente, que se envía a `POST /api/whatsapp/connect`
  4. El Worker intercambia ese `code` por un access token de corta duración — **ese token no se guarda ni se usa para enviar mensajes** (ver más abajo) — y lo usa solo para leer `waba_id`/`phone_number_id` y suscribir ese WABA a los webhooks de la app. Guarda `waba_id`, `phone_number_id` y `display_number` en `ai_agent_configs`
- **Token para enviar mensajes — System User Token único a nivel de app, no uno por tenant (RESUELTO v1.7, ver §15 riesgo 10):** confirmado auditando una integración Tech Provider propia ya en producción (proyecto `WhatsflowAI-V2`) que el patrón correcto NO es guardar el token que devuelve el intercambio de Embedded Signup. Ese token por tenant no es la vía confiable para enviar mensajes a largo plazo. En su lugar:
  1. Una sola vez, a mano, en Meta Business Manager → Usuarios del sistema → crear un usuario de sistema (rol Admin)
  2. Asignarle como activo cada WABA que se vaya conectando (o el negocio completo, según cómo esté organizado el Business Manager)
  3. Generar un token para ese usuario de sistema con permisos `whatsapp_business_management` + `whatsapp_business_messaging`
  4. Ese token único se carga como el secret `META_SYSTEM_USER_TOKEN` del Worker y es el que se usa para **todas** las llamadas de envío a la Graph API, para todos los tenants — identificados igual por su `phone_number_id`, que sí es específico de cada uno
  - **Consecuencia en el schema:** `ai_agent_configs.whatsapp_access_token_enc` deja de ser necesario (no hay token por tenant que cifrar); se elimina del schema real al implementar la Fase 4, aunque ya existía en el schema de Drizzle de las fases anteriores — ver nota de migración en §15.
  - Asignar un WABA nuevo al usuario de sistema sigue siendo un paso manual (no hay un endpoint de Meta para automatizarlo desde el intercambio de Embedded Signup); para el MVP esto lo hace el equipo cada vez que un tenant se conecta, no el propio tenant.
- **Flujo de mensajes entrantes:** cliente WhatsApp → Meta → `POST` a la única URL de webhook registrada a nivel de la app (`/api/webhooks/whatsapp`), con `metadata.phone_number_id` en el payload → se resuelve el tenant por ese campo → Gemini arma la respuesta → se envía con `POST https://graph.facebook.com/v21.0/{phone_number_id}/messages` usando `META_SYSTEM_USER_TOKEN`
- **Ventana de 24h / templates — alcance reducido para el MVP (RESUELTO v1.7, ver §15 riesgo 11):** el agente del MVP solo **responde** a mensajes entrantes (nunca escribe primero), y una respuesta dentro de la misma conversación siempre cae dentro de la ventana de 24h por definición — no hace falta chequear nada para ese caso. El riesgo real (mandar un *template* aprobado fuera de la ventana) solo existiría si el producto mandara mensajes proactivos por WhatsApp (recordatorio de visita, reactivación de lead), y **eso no está en el alcance del MVP** — las notificaciones de CRM van por Resend (email), no por WhatsApp (ver blueprint §3, §11). Si de todas formas Meta rechaza un envío por estar fuera de ventana (código de error `131047`), se maneja igual que lo hace `WhatsflowAI-V2`: de forma reactiva — se captura el error y se informa, no se intenta prevenir calculando la ventana de antemano.
- **Variables:** `NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_CONFIG_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_SYSTEM_USER_TOKEN` (nuevo en v1.7, reemplaza el token por tenant)

```typescript
// src/app/api/webhooks/whatsapp/route.ts
import { getDb } from '@/lib/db/client'
import { decrypt } from '@/lib/crypto'
import { verifyMetaSignature } from '@/lib/whatsapp/graph-client'

export async function GET(req: Request) {
  const url = new URL(req.url)
  if (
    url.searchParams.get('hub.mode') === 'subscribe' &&
    url.searchParams.get('hub.verify_token') === process.env.META_WEBHOOK_VERIFY_TOKEN
  ) {
    return new Response(url.searchParams.get('hub.challenge'), { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256')
  if (!(await verifyMetaSignature(rawBody, signature, process.env.META_APP_SECRET!))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = JSON.parse(rawBody)
  const change = payload.entry?.[0]?.changes?.[0]?.value
  const incomingMessage = change?.messages?.[0]
  if (!incomingMessage) return new Response('OK', { status: 200 }) // ej. recibo de entrega, no un mensaje

  const phoneNumberId = change.metadata.phone_number_id
  const from = incomingMessage.from
  const message = incomingMessage.text?.body ?? ''

  const db = getDb() // instancia Drizzle sobre el binding D1 del Worker

  const config = await db.query.aiAgentConfigs.findFirst({
    where: (t, { eq }) => eq(t.whatsappPhoneNumberId, phoneNumberId),
    with: { tenant: true },
  })
  if (!config?.isActive) return new Response('OK', { status: 200 })

  const properties = await db.query.properties.findMany({
    where: (t, { and, eq }) => and(eq(t.tenantId, config.tenantId), eq(t.status, 'active')),
    columns: { title: true, type: true, operation: true, priceCents: true, city: true, areaM2: true, bedrooms: true, bathrooms: true },
    limit: 15,
  })

  const propertyContext = properties
    .map(p => `- ${p.title}: ${p.type}, ${p.operation}, $${(p.priceCents / 100).toLocaleString('es-CO')} COP, ${p.city}`)
    .join('\n') || 'Sin propiedades disponibles'

  const geminiKey = await decrypt(config.geminiKeyEnc)
  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `${config.systemPrompt}\n\nPropiedades disponibles:\n${propertyContext}` },
            { text: `Cliente: ${message}` },
          ],
        }],
      }),
    }
  )
  const geminiJson = await geminiRes.json()
  const reply = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No pude procesar tu mensaje, un asesor te contactará.'

  // Token de sistema único a nivel de app (ver §11 y §15 riesgo 10) — no uno
  // por tenant guardado en ai_agent_configs.
  await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.META_SYSTEM_USER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: from,
      text: { body: reply },
    }),
  })

  return new Response('OK', { status: 200 })
}
```

### Resend (Emails transaccionales)
- **Paquete:** `resend` (SDK basado en `fetch`, compatible con el runtime de Workers)
- **Casos de uso en MVP:**
  1. Invitación de asesores al equipo (vía flujo de invitación de Better Auth)
  2. Notificación al asesor cuando entra un nuevo lead
  3. Confirmación de visita agendada
  4. Magic link de login y verificación de email (disparado por Better Auth)
- **Variables:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

### Cloudflare Images (reemplaza Supabase Storage + `sharp`)
- **Por qué:** `sharp` depende de binarios nativos y no corre en el runtime de Workers; en vez de subir el archivo original al servidor y redimensionarlo ahí, Cloudflare Images recibe el upload directo desde el navegador y sirve variantes ya optimizadas desde su CDN
- **Variantes a configurar en el dashboard:** `public` (hasta 1920px, para galería y detalle) y `thumbnail` (320px, para cards y kanban)
- **Flujo de subida:**
  1. Cliente pide `POST /api/upload` con `{ context }`
  2. El Worker llama a la API de Cloudflare Images (`CLOUDFLARE_IMAGES_API_TOKEN`) para crear una Direct Creator Upload URL con metadata `{ tenant_id, context }`
  3. El navegador sube el archivo directo a esa URL (no pasa por el Worker)
  4. El cliente guarda el `image_id` devuelto en `properties.cover_image_id` / `property_images.image_id` / `tenants.logo_image_id`
  5. Para mostrar la imagen: `${NEXT_PUBLIC_CLOUDFLARE_IMAGES_DELIVERY_URL}/{image_id}/{variante}`
- **Límites MVP:** máx 20 imágenes por propiedad (se valida en la aplicación, no en Cloudflare Images)

### Cloudflare Turnstile (nuevo en v1.2 — ver §15 riesgo 2)
- **Por qué:** el formulario público de contacto (`POST /api/leads`) no tenía ninguna protección anti-spam/anti-bot en v1.1; al migrar a Cloudflare, agregar Turnstile es prácticamente gratis
- **Flujo:** el widget de Turnstile se renderiza en el formulario público, genera un `turnstile_token`, y `POST /api/leads` lo valida server-side contra la API de Siteverify de Cloudflare antes de insertar el lead
- **Variables:** `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`

### Leaflet + OpenStreetMap (Mapas)
- **Paquetes:** `leaflet`, `react-leaflet`, `@types/leaflet`
- **Costo:** gratuito (tiles de OpenStreetMap)
- **Uso:** mapa de ubicación en la página pública de detalle de propiedad
- **Nota MVP:** coordenadas se ingresan manualmente por el admin (sin geocodificación automática)
- **Sin cambios respecto a v1.1:** corre 100% en el cliente, no depende de Supabase ni Vercel

---

## 12. DISEÑO Y UI

### Paleta de Colores

| Token | HEX | Uso |
|---|---|---|
| `primary` | `#1B4FBF` | Botones principales, links, headers del dashboard |
| `primary-light` | `#3B82F6` | Hover states, fondos sutiles |
| `secondary` | `#0EA5E9` | Elementos de acento secundario |
| `accent` | `#F59E0B` | Badges de destacado, CTAs de alta urgencia |
| `success` | `#10B981` | Propiedades activas, stages completados |
| `danger` | `#EF4444` | Errores, propiedades vendidas, cancelaciones |
| `dark` | `#0F172A` | Texto principal |
| `gray` | `#64748B` | Texto secundario, placeholders |
| `light-gray` | `#F1F5F9` | Fondos de cards, zebra en tablas |
| `border` | `#CBD5E1` | Bordes de inputs, separadores |
| `white` | `#FFFFFF` | Fondos de páginas y cards |

### Tipografía
- **Dashboard:** `Inter` (Google Fonts) — weights: 400, 500, 600, 700
- **Páginas públicas:** `Urbanist` (Google Fonts) — moderna, legible en tamaños grandes
- **Tamaños:** 12px (captions), 14px (body sm), 16px (body), 18px (body lg), 24px (h3), 30px (h2), 36px+ (h1)

### Templates de Página Pública (3 opciones MVP)

| Template | Descripción visual | Referencia |
|---|---|---|
| `modern` | Header full-width con foto de fondo, grilla de 3 cols, cards con hover elevation | Wasi.co actual |
| `classic` | Header centrado con logo grande, lista de propiedades con imagen a la izquierda | Portales tradicionales |
| `minimal` | Sin sidebar, tipografía grande, fondo blanco, fotos a sangre | Inmobiliarias de lujo |

### `tailwind.config.ts` — extensión de colores

```typescript
extend: {
  colors: {
    primary: {
      DEFAULT: '#1B4FBF',
      light: '#3B82F6',
    },
    secondary: '#0EA5E9',
    accent: '#F59E0B',
  },
  fontFamily: {
    sans: ['Inter', 'sans-serif'],
    display: ['Urbanist', 'sans-serif'],
  }
}
```

---

## 13. CRITERIOS DE DONE

El MVP está listo para lanzar cuando:

1. Una inmobiliaria puede registrarse, crear su cuenta y completar el onboarding (slug, logo, colores) en menos de 10 minutos
2. Puede crear propiedades de los 4 tipos (apartamento, casa, local, lote) con imágenes, precio y ubicación
3. Puede registrar propietarios/mandantes y asociarlos a una propiedad, con código interno, tipo de mandato y comisión
4. Puede cargar un portafolio existente vía CSV (`bulk-import`) y cambiar el estado de varias propiedades a la vez (`bulk-status`)
5. La página pública es accesible en `/[slug]` con catálogo filtrable por tipo, operación y precio, y solo muestra propiedades con `visibility = 'published'`
6. Cada propiedad tiene su propia página pública con galería, mapa y botón de contacto por WhatsApp
7. Los leads que contactan por el formulario web (protegido con Turnstile) aparecen en el CRM bajo la etapa "Nuevo"
8. El admin puede asociar propiedades de interés a un lead, abrir un deal (oportunidad) sobre una de ellas, y mover ese deal entre etapas en el kanban con drag & drop
9. El admin puede agendar una visita con fecha/hora, opcionalmente ligada a un deal
10. El módulo de IA permite conectar un número de WhatsApp (Embedded Signup), configurar el agente y probarlo
11. El agente de WhatsApp responde mensajes con información de propiedades disponibles del tenant
12. El cobro de suscripción funciona end-to-end con Wompi en ambiente sandbox
13. Las páginas públicas tienen meta tags correctos para SEO (`title`, `description`, `og:image`, `og:title`)
14. El deploy en Cloudflare Workers funciona sin errores (`wrangler deploy`), con D1 migrado y todos los secrets cargados
15. Existe al menos una prueba que confirma que un usuario del tenant A no puede leer ni modificar datos del tenant B (sustituye la garantía que antes daba RLS)

---

## 14. DECISIONES TÉCNICAS

### Multitenant: schema único en D1 con `tenant_id`, aislamiento forzado en código (no RLS)
Un único D1 por el momento, igual que en v1.1 era un único Postgres. La diferencia clave: D1 no soporta Row Level Security, así que el aislamiento entre inmobiliarias ya no lo garantiza la base de datos sino la capa de repositorio (`lib/db/tenant-scope.ts`), que es de paso obligatorio para toda query de dominio. Es el cambio de mayor riesgo de esta migración (ver §15, riesgo 1). Si el volumen de datos de un tenant grande se vuelve un problema para un único D1 (hay un límite de tamaño por base), la vía de escape es una base D1 por tenant — D1 está pensado para que crear muchas bases sea barato — pero eso es una decisión de v2+, no del MVP.

### Hosting: Cloudflare Workers vía vinext (no Vercel)
vinext reimplementa la superficie de Next.js sobre Vite y corre nativamente en el runtime de Workers, con acceso directo a los bindings (D1, secrets) sin la distinción "Edge Runtime vs Node runtime" que existe en Vercel. Antes de arrancar la implementación, confirmar la compatibilidad de la versión exacta de Next.js con vinext (ver §15, riesgo 3): puede implicar subir de Next 14 a Next 15.

### Gemini y el webhook de WhatsApp corren en el mismo Worker (no en una función aparte)
En v1.1 esta lógica vivía en una Supabase Edge Function separada por dos razones: acceso directo al service role de la DB, y evitar el timeout de 10s de Vercel free. En Cloudflare ninguna de las dos aplica — el binding de D1 ya está disponible en cualquier Route Handler del mismo Worker, y el límite de CPU time de Workers es configurable y más generoso — así que se colapsa en un único artefacto de deploy. Se llama a Gemini por `fetch` directo al endpoint REST en vez de con el SDK `@google/generative-ai`, para no depender de su compatibilidad con el runtime de Workers (no verificada al momento de escribir este blueprint).

### WhatsApp Business Cloud API directa (Meta), sin proveedor intermedio
v1.1/v1.2 usaban Plazbot para abstraer el registro ante Meta y el envío/recepción de mensajes. Se retira porque el equipo ya opera una app propia registrada como Tech Provider (Business Solution Provider) ante Meta: ese registro es justamente lo que un proveedor como Plazbot resolvería, así que mantenerlo habría sido una capa redundante, un costo recurrente y una dependencia externa de más. Cada tenant conecta su propio número con el flujo estándar de **Embedded Signup**, sin que el equipo tenga que gestionar manualmente el Business Verification de cada inmobiliaria — eso ya lo cubre el rol de Tech Provider. Trade-off: el equipo asume directamente el manejo de tokens, la suscripción a webhooks por WABA y las reglas de mensajería de Meta (ventana de 24 horas, plantillas aprobadas) que antes quedaban ocultas detrás de Plazbot (ver §15).

### Token de sistema (system user) en vez de un token por tenant para enviar WhatsApp
Se descubrió auditando (solo lectura) una integración Tech Provider propia ya en producción (`WhatsflowAI-V2`) que el token que devuelve el intercambio de Embedded Signup no es lo que sostiene el envío de mensajes ahí — usan un único System User Token a nivel de app como fallback en absolutamente todas las llamadas de envío, y en la práctica es el único camino real (el campo de token por canal queda casi siempre vacío). Se adopta el mismo patrón: un secret `META_SYSTEM_USER_TOKEN` generado una sola vez a mano en Meta Business Manager, usado para todos los tenants, identificados por su `phone_number_id`. Trade-off: cada WABA nuevo que se conecta necesita un paso manual (asignarlo como activo al usuario de sistema) que el equipo hace, no el tenant — aceptable para el volumen de un MVP, se automatiza en v2 si hace falta.

### Better Auth en lugar de Supabase Auth
Supabase Auth desaparece junto con Supabase. Better Auth tiene adapter oficial para D1/Drizzle, corre dentro del Worker sin servicios externos adicionales, y cubre los dos requisitos de v1.1 (email/password + magic link) con plugins de primera parte. Alternativa considerada y descartada para MVP: Clerk/WorkOS (añaden costo recurrente por usuario activo que no aporta valor al MVP).

### Cloudflare Images en lugar de Supabase Storage + `sharp`
`sharp` usa binarios nativos y no corre en el runtime de Workers. En vez de replicar esa lógica con otra librería, se usa Cloudflare Images para el upload directo desde el navegador y el resize/optimización server-side, eliminando por completo el paso de "subir al servidor → redimensionar → subir a storage" de v1.1.

### Drizzle ORM como capa de acceso a D1
D1 no tiene un cliente equivalente al `supabase-js` con query builder incluido. Drizzle da tipado end-to-end sobre el schema, generación de migraciones versionadas (`drizzle/migrations`) y es la integración recomendada por Cloudflare para D1.

### Slugs como identificador público del tenant (no subdominios) — igual que en v1.1, pero el camino a v2 cambia
El MVP sigue usando `/[slug]` para no ampliar scope. La diferencia respecto a v1.1: antes el upgrade a subdominios propios (`inmobiliaria.tuapp.com`) requería DNS wildcard y certificados SSL por tenant gestionados a mano en Vercel; con Cloudflare, **Cloudflare for SaaS** (custom hostnames gestionados) resuelve eso de forma nativa, así que en v2 este upgrade es más simple de lo que originalmente se proyectaba.

### Leaflet + OSM en lugar de Google Maps
Sin cambios respecto a v1.1: evita el ciclo de facturación de Google Maps Platform para el MVP. Corre en el cliente, no depende de Supabase ni de Vercel/Cloudflare.

### Wompi como única pasarela en MVP
Sin cambios respecto a v1.1. La tabla `subscriptions` sigue siendo agnóstica a la pasarela.

### Geocodificación manual en MVP
Sin cambios respecto a v1.1.

### 3 templates fijos para página pública
Sin cambios respecto a v1.1.

### React Query para data fetching en dashboard
Sin cambios respecto a v1.1.

### Separar Lead de Deal/Oportunidad (inspirado en el CRM de Houzez)
Al revisar `houzez-crm`, un plugin de CRM inmobiliario maduro incluido en el tema WordPress que el equipo compartió, se identificó que modela "Lead" (el contacto) y "Deal" (la oportunidad de negocio) como entidades separadas, cada una con su propio ciclo: el lead solo se califica (nuevo/contactado/descartado) y un mismo lead puede tener varias oportunidades abiertas en paralelo (interesado en dos propiedades a la vez), cada una con su propio valor esperado (`deal_value_cents`), próxima acción y etapa de cierre. v1.4 conflacionaba ambas cosas en `leads.stage`, sin monto ni vínculo a una propiedad específica por oportunidad. Se adopta el split: `leads.stage` queda en `('new','contacted','disqualified')` y se agrega la tabla `deals` (lead + property + valor + etapa de venta), que es ahora lo que alimenta el kanban (`KanbanBoard.tsx`). Quedan fuera de esta iteración (diferido a v2, ver §15): stages/fuentes configurables por tenant, timeline de actividades y notas múltiples, y los campos de propiedad adicionales (lote, video, tour 360°, planos) que también salieron de esa revisión.

### Inventario de Propiedades como módulo propio, separado del CRM de leads
El perfil del usuario objetivo (§1) ya opera un portafolio de 20–200 propiedades en Wasi/Excel; tratar "propiedades" solo como un CRUD del catálogo público se quedaba corto para ese caso de uso real. Se agrega: (1) `property_owners` como entidad separada de `leads` — el propietario que entrega un inmueble en mandato no es lo mismo que un comprador/arrendatario captado por el CRM, y mezclarlos en la misma tabla habría sido confuso; (2) `visibility` como campo independiente de `status`, para poder cargar y preparar una propiedad (fotos, precio, mandato) antes de que aparezca en la página pública; (3) importación CSV y acciones masivas, porque crear 100+ propiedades una por una en el wizard es fricción de onboarding real para el usuario que viene de Excel, no un nice-to-have. Se descartó por ahora (queda para v2): historial de cambios de status (`property_status_history`) y reportes de inventario — chocaría con "Reportes y analytics avanzados" en la sección 3 (Fuera de Alcance).

---

## 15. GAPS Y RIESGOS IDENTIFICADOS AL MIGRAR A CLOUDFLARE

Esto es lo que v1.1 no necesitaba resolver (porque Supabase/Vercel lo resolvían por su cuenta) y que esta migración obliga a decidir explícitamente antes de implementar:

1. **Pérdida de RLS nativo.** D1 no tiene Row Level Security. El aislamiento multitenant pasa a ser una convención de código (§6, §14). Mitigación mínima para aprobar el MVP: todas las queries de dominio pasan por `lib/db/tenant-scope.ts`, y existe al menos una prueba automatizada que confirma el aislamiento entre dos tenants (criterio de done #13).
2. **El formulario público de leads no tenía protección anti-spam en v1.1.** `POST /api/leads` es un endpoint público sin autenticación; sin rate limiting ni captcha es un vector obvio de spam/abuso. Se agregó Cloudflare Turnstile en esta versión (§7, §11) — evaluar si además conviene una regla de Rate Limiting de Workers sobre ese endpoint.
3. ~~Compatibilidad de Next.js 14 con vinext sin confirmar.~~ **RESUELTO (v1.6):** `create-vinext-app` funciona, genera un proyecto App Router + TypeScript + Tailwind funcional con `--platform cloudflare --image-optimization cloudflare-images`. No hay un paquete `next` como tal — vinext reimplementa esa superficie de API sobre Vite, así que la pregunta de "versión de Next" no aplica igual que en v1.0–v1.5. **También resuelto:** la firma de `bindings.d1()` es `{ id?: string, name?: string, dev?: BindingDevOptions }` (de `@cloudflare/config`), confirmada leyendo los tipos instalados.
4. **`@google/generative-ai` sin verificar en el runtime de Workers.** Se optó por `fetch` directo al REST API de Gemini (§11) para eliminar el riesgo en vez de verificarlo; si en el futuro se prefiere volver al SDK, confirmar antes su compatibilidad.
5. **El modelo de "equipo/invitaciones" cambia de dueño.** En v1.1 la tabla `users` y sus políticas RLS eran propias; en v1.2 `user`/`session`/`account`/`verification` las gestiona Better Auth. El flujo de `/dashboard/settings/team` (invitar asesores) debe construirse sobre el mecanismo de invitación de Better Auth, no reinventarse.
6. **Backups y recuperación de D1 no estaban en el alcance original.** Documentar antes del lanzamiento cómo se hace un respaldo (Time Travel de D1, o `wrangler d1 export` periódico) — en v1.1 esto lo cubría Supabase de forma transparente.
7. **Dinero almacenado como `NUMERIC(14,2)` en v1.1 pasa a `INTEGER` (centavos) en D1**, porque SQLite no tiene un tipo decimal exacto. Esto es una mejora de corrección, pero implica que toda la capa de validación (`lib/validations/property.ts`, `lib/validations/lead.ts`) y la UI de montos deben trabajar en centavos y formatear solo en la vista — no es un cambio cosmético, hay que propagarlo.
8. **Límite de tamaño por base D1.** Verificar el límite vigente antes de aprobar el diseño de "un único D1 compartido" como definitivo; si el crecimiento proyectado lo supera, la vía de escape (D1 por tenant) debe quedar documentada antes, no decidirse en caliente en producción.
9. **Cloudflare Images requiere un plan que lo habilite.** Confirmar el costo y el plan necesario antes de dar esta pieza por definitiva, ya que reemplaza por completo a Supabase Storage.
10. ~~Token de WhatsApp Cloud API por tenant puede expirar.~~ **RESUELTO (v1.7):** se audita (solo lectura) una integración Tech Provider propia ya en producción (`WhatsflowAI-V2`) y se confirma que el patrón correcto es un **System User Token único a nivel de app** (`META_SYSTEM_USER_TOKEN`), generado una sola vez a mano en Meta Business Manager con permisos `whatsapp_business_management`/`whatsapp_business_messaging`, no el token que devuelve el intercambio de Embedded Signup. Ver §11 para el detalle y el paso manual pendiente (asignar cada WABA nuevo al usuario de sistema). Pendiente menor sin resolver: no hay evidencia en esa auditoría de que el token de sistema esté configurado explícitamente como "no expira" en el dashboard de Meta al generarlo — confirmar esa casilla al generarlo para este proyecto.
11. ~~Ventana de 24 horas y plantillas aprobadas de Meta.~~ **RESUELTO para el alcance del MVP (v1.7):** el agente del MVP solo responde a mensajes entrantes (nunca escribe primero), y una respuesta en la misma conversación siempre cae dentro de la ventana de 24h — no aplica el riesgo tal como está planteado. El riesgo real (template aprobado para mensaje proactivo) solo existiría si se mandaran mensajes de WhatsApp fuera de una respuesta directa, y eso no está en el alcance del MVP (las notificaciones de CRM van por Resend, no por WhatsApp). Si Meta igual rechaza un envío por ventana (error `131047`), se maneja de forma reactiva (capturar el error e informar), igual que lo hace `WhatsflowAI-V2` — no hay que construir un chequeo de ventana por adelantado.
12. **Una sola URL de webhook para todos los tenants.** Al ser una app Tech Provider, Meta envía todos los mensajes de todos los WABAs conectados a la misma URL; si la resolución por `phone_number_id` falla o ese índice no está bien mantenido, un mensaje puede quedar sin enrutar a ningún tenant. Vale la pena un log/alerta cuando llega un `phone_number_id` sin config asociada.
13. **Gaps de CRM/Inventario revisados contra `houzez-crm` pero diferidos a v2 (decisión explícita, no olvido):** stages/fuentes/next_action configurables por tenant en vez de `CHECK` fijos; timeline de `activities` y `notes` múltiples por lead/deal (hoy solo hay un campo `notes` de texto); tipos de consulta "avalúo" y "crédito hipotecario" en la captura de leads; y en Inventario: `land_area` (área de lote, distinta de `area_m2`), `video_url`, `virtual_tour_url` y una tabla `floor_plans` repetible. Si el piloto real muestra que alguno de estos bloquea el uso diario, revisar antes de congelar el schema de `deals`/`properties`.

---

## CHECKLIST DE APROBACIÓN

### Scope check
- [x] Flujo principal: 6 pasos exactos (el paso 5 se reformula para reflejar deals, sin agregar pasos)
- [x] Tablas en D1: 9 tablas de dominio (se agregan `property_owners` y `deals`) + 4 tablas gestionadas por Better Auth
- [x] Endpoints: 23 endpoints (14 de v1.1/v1.2 + 6 del módulo de Inventario + 3 de `deals`)
- [x] Integraciones: Wompi, Gemini (en el mismo Worker), WhatsApp Cloud API directa (Meta, app Tech Provider propia), Resend, Leaflet, Cloudflare Images, Cloudflare Turnstile — todas necesarias
- [x] Módulo de Inventario de Propiedades: propietarios/mandantes, código interno, mandato (exclusividad/comisión/vigencia), visibilidad pública independiente del status comercial, importación CSV y acciones masivas
- [x] Módulo de CRM: Lead (calificación de contacto) separado de Deal (oportunidad con valor sobre una propiedad concreta, pipeline propio)

### Claridad check
- [x] Nombres en `snake_case` en DB / `camelCase` en Drizzle, descriptivos y consistentes
- [x] SQL completo en dialecto SQLite/D1, listo para `wrangler d1 execute`
- [x] Todos los endpoints con request/response body tipados en TypeScript
- [x] Todas las variables de entorno y secrets listados con fuente

### Completitud check
- [x] Estructura de carpetas incluye todas las páginas y componentes mencionados
- [x] Criterios de done específicos y verificables para este proyecto, incluyendo la prueba de aislamiento multitenant
- [x] Decisiones técnicas justificadas con trade-offs explícitos
- [ ] **Pendiente antes de pasar a `APROBADO`:** de los 13 puntos de la sección 15, quedan resueltos 1, 3, 10 y 11 (ver changelog v1.6/v1.7); sigue pendiente el 9 (plan/costo de Cloudflare Images) antes de cerrar la Fase 1 del todo, y el resto son deuda técnica menor o de v2.

---

> **Estado:** `BORRADOR` → cambiar a `APROBADO` cuando esté revisado y listo para Antigravity
