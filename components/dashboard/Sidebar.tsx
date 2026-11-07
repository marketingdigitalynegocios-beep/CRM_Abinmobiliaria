/**
 * Nav mínima: solo enlaza a lo que ya existe (Inventario + CRM, Fase 1/2).
 * Agente de IA/settings se agregan acá mismo cuando se construyan sus
 * páginas (Fase 3+, ver plan-implementacion.md) — evitar enlaces muertos
 * mientras tanto.
 */
const links = [
  { href: "/dashboard", label: "Resumen" },
  { href: "/dashboard/properties", label: "Propiedades" },
  { href: "/dashboard/properties/owners", label: "Propietarios" },
  { href: "/dashboard/crm", label: "Oportunidades" },
  { href: "/dashboard/crm/contacts", label: "Contactos" },
  { href: "/dashboard/website", label: "Mi página pública" },
  { href: "/dashboard/settings/agency", label: "Mi inmobiliaria" },
  { href: "/dashboard/settings/team", label: "Equipo" },
];

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-border bg-white md:block">
      <div className="px-5 py-5 text-lg font-semibold text-dark">SaaS Inmobiliario</div>
      <nav className="flex flex-col gap-1 px-3">
        {links.map((link) => (
          <a
            className="rounded-md px-3 py-2 text-sm font-medium text-gray hover:bg-light-gray hover:text-dark"
            href={link.href}
            key={link.href}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
