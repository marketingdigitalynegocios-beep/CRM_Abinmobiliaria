import { buildImageUrl } from "@/lib/images/delivery-url";

export type PublicTemplate = "modern" | "classic" | "minimal";

interface AgencyHeaderProps {
  tenant: {
    slug: string;
    name: string;
    logoImageId: string | null;
    primaryColor: string;
    city: string | null;
    description: string | null;
    template?: PublicTemplate;
  };
}

/**
 * Header de la página pública. Varía según `tenant.template` (ver blueprint
 * §12, "3 templates de página pública"):
 * - modern: barra compacta, logo a la izquierda, alineado a la izquierda.
 * - classic: header centrado, logo grande, acento de color debajo.
 * - minimal: sin tarjeta de logo, solo tipografía grande, mucho blanco.
 *
 * Aplica `primaryColor` del tenant como CSS custom property
 * `--color-primary-tenant` (no pisa `--color-primary`, que es la marca del
 * SaaS, no la de cada inmobiliaria).
 */
export function AgencyHeader({ tenant }: AgencyHeaderProps) {
  const logoUrl = buildImageUrl(tenant.logoImageId, "thumbnail");
  const template = tenant.template ?? "modern";
  const style = { "--color-primary-tenant": tenant.primaryColor } as React.CSSProperties;

  if (template === "minimal") {
    return (
      <header className="bg-white" style={style}>
        <div className="mx-auto max-w-5xl px-6 pt-12 pb-8">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-dark">
            {tenant.name}
          </h1>
          {tenant.city && <p className="mt-2 text-base text-gray">{tenant.city}</p>}
        </div>
      </header>
    );
  }

  if (template === "classic") {
    return (
      <header className="border-b-4 bg-white text-center" style={{ ...style, borderBottomColor: tenant.primaryColor }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-10">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={tenant.name} className="h-20 w-20 rounded-full object-cover" src={logoUrl} />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-semibold text-white"
              style={{ backgroundColor: tenant.primaryColor }}
            >
              {tenant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="font-display text-2xl font-semibold text-dark">{tenant.name}</h1>
          {tenant.city && <p className="text-sm text-gray">{tenant.city}</p>}
        </div>
      </header>
    );
  }

  // modern (default)
  return (
    <header className="border-b border-border bg-white" style={style}>
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={tenant.name} className="h-12 w-12 rounded-full object-cover" src={logoUrl} />
        ) : (
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ backgroundColor: tenant.primaryColor }}
          >
            {tenant.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="font-display text-xl font-semibold text-dark">{tenant.name}</h1>
          {tenant.city && <p className="text-sm text-gray">{tenant.city}</p>}
        </div>
      </div>
    </header>
  );
}
