import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getTenantForTenant, listPropertiesForTenant, listTeamMembersForTenant } from "@/lib/db/tenant-scope";
import { AgencySettingsForm } from "@/components/dashboard/AgencySettingsForm";
import { PortalFeedCard } from "@/components/dashboard/PortalFeedCard";

export const metadata: Metadata = {
  title: "Mi Inmobiliaria | Configuración InmoElite",
};

export default async function AgencySettingsPage() {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const db = getDb(env.DB);
  const tenant = await getTenantForTenant(db, session.tenantId);
  if (!tenant) redirect("/login");

  const [{ properties }, teamMembers] = await Promise.all([
    listPropertiesForTenant(db, session.tenantId, { limit: 500 }),
    listTeamMembersForTenant(db, session.tenantId),
  ]);
  const activeProperties = properties.filter((p) => p.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Executive Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray mb-1">
            <span>Configuración</span>
            <span className="material-symbols-outlined text-[14px]">
              chevron_right
            </span>
            <span className="text-primary font-medium">Sede Principal &amp; Operaciones</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-dark">
            Configuración de la Inmobiliaria
          </h1>
          <p className="mt-1 text-sm text-gray">
            Administración institucional, portal público web, comisiones y suscripción.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/${tenant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-primary shadow-xs hover:bg-slate-50 transition-colors"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ver Mi Web Pública</span>
            <span className="material-symbols-outlined text-[14px]">
              open_in_new
            </span>
          </a>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border text-xs font-semibold">
        <Link
          href="/dashboard/settings/agency"
          className="flex items-center gap-2 border-b-2 border-primary px-4 py-3 text-primary -mb-px"
        >
          <span className="material-symbols-outlined text-[18px]">
            apartment
          </span>
          <span>Mi Inmobiliaria</span>
        </Link>
        <Link
          href="/dashboard/settings/team"
          className="flex items-center gap-2 border-b-2 border-transparent px-4 py-3 text-gray hover:text-dark transition-colors -mb-px"
        >
          <span className="material-symbols-outlined text-[18px]">
            group
          </span>
          <span>Equipo &amp; Asesores</span>
          <span className="rounded-full bg-light-gray px-2 py-0.5 text-[10px] text-gray">
            {teamMembers.length} miembro{teamMembers.length === 1 ? "" : "s"}
          </span>
        </Link>
      </div>

      {/* 12-Column Split: Form (8 cols) & Plan & Billing (4 cols) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Agency Form (8 cols) */}
        <div className="lg:col-span-8">
          <AgencySettingsForm
            initialValues={{
              name: tenant.name,
              phone: tenant.phone ?? undefined,
              whatsappNumber: tenant.whatsappNumber ?? undefined,
              email: tenant.email ?? undefined,
              website: tenant.website ?? undefined,
              city: tenant.city ?? undefined,
              address: tenant.address ?? undefined,
              primaryColor: tenant.primaryColor,
              description: tenant.description ?? undefined,
            }}
            logoImageId={tenant.logoImageId}
            slug={tenant.slug}
          />
        </div>

        {/* Right Column: Account Summary & Billing (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Account Summary Card — datos reales del tenant */}
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
            <div className="h-1.5 bg-gradient-to-r from-primary via-blue-500 to-emerald-500" />
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="rounded bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                  Cuenta Activa
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray font-medium">Inmuebles activos</span>
                  <span className="font-mono font-bold text-dark">{activeProperties}</span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-2.5">
                  <span className="text-gray font-medium">Asesores del equipo</span>
                  <span className="font-mono font-bold text-dark">{teamMembers.length}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60">
                <p className="text-[11px] text-gray leading-relaxed">
                  La facturación aún no está disponible — este MVP está en uso interno de una sola
                  empresa (ver plan-implementacion.md, Fase 5 diferida).
                </p>
              </div>
            </div>
          </div>

          <PortalFeedCard />

          {/* Colombian Compliance Card */}
          <div className="rounded-xl border border-border bg-white p-4 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-dark">
              <span className="material-symbols-outlined text-[18px] text-primary">
                security
              </span>
              <span>Protección de Datos &amp; Ley 1581</span>
            </div>
            <p className="text-[11px] text-gray leading-relaxed">
              Cumplimiento normativo Habeas Data para captación de leads en Colombia.
              El bot de WhatsApp solicita consentimiento explícito de tratamiento de datos personales.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
