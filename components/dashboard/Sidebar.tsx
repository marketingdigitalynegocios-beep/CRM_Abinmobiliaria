"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient, useSession } from "../../lib/auth/client";
import { ThemeToggle } from "./ThemeToggle";

function buildNavItems(counts: { properties: number; opportunities: number }) {
  return [
    { label: "Resumen", href: "/dashboard", icon: "space_dashboard" },
    {
      label: "Propiedades",
      href: "/dashboard/properties",
      icon: "domain",
      badge: String(counts.properties),
    },
    { label: "Propietarios", href: "/dashboard/properties/owners", icon: "vpn_key" },
    {
      label: "Oportunidades",
      href: "/dashboard/crm",
      icon: "view_kanban",
      badge: String(counts.opportunities),
    },
    { label: "Contactos", href: "/dashboard/crm/contacts", icon: "contact_phone" },
    { label: "Calendario", href: "/dashboard/calendar", icon: "calendar_month" },
    { label: "Agente WhatsApp", href: "/dashboard/ai-agent", icon: "smart_toy" },
    { label: "Reportes", href: "/dashboard/reports", icon: "bar_chart" },
    { label: "Reseñas", href: "/dashboard/reviews", icon: "reviews" },
    { label: "Mi Web Pública", href: "/dashboard/website", icon: "public" },
    { label: "Configuración", href: "/dashboard/settings/agency", icon: "settings" },
  ];
}

const COLLAPSE_STORAGE_KEY = "sidebar-collapsed";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function isNavItemActive(
  itemHref: string,
  currentPath: string,
  allItems: { href: string }[]
) {
  if (itemHref === "/dashboard") return currentPath === "/dashboard";
  if (itemHref === currentPath) return true;
  if (!currentPath.startsWith(itemHref + "/")) return false;

  // Si existe otro ítem del menú con ruta más específica que coincide, este ítem padre no se marca
  const hasMoreSpecific = allItems.some(
    (other) =>
      other.href !== itemHref &&
      other.href.length > itemHref.length &&
      (currentPath === other.href || currentPath.startsWith(other.href + "/"))
  );
  return !hasMoreSpecific;
}

export function Sidebar({
  counts = { properties: 0, opportunities: 0 },
}: {
  counts?: { properties: number; opportunities: number };
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const navItems = buildNavItems(counts);

  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
    setCollapsed(stored);
    document.documentElement.dataset.sidebar = stored ? "collapsed" : "expanded";
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.documentElement.dataset.sidebar = next ? "collapsed" : "expanded";
    localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
  }

  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  const userName = session?.user?.name ?? "";
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  return (
    <aside
      className={`hidden md:flex fixed left-0 top-0 h-screen flex-col justify-between p-4 border-r border-border bg-white z-30 select-none transition-[width] duration-150 print:hidden ${
        collapsed ? "w-[72px] px-2" : "w-60"
      }`}
    >
      {/* Brand & Main Navigation */}
      <div className="space-y-4">
        {/* Brand Header con flecha para contraer/expandir */}
        <div
          className={`flex items-center justify-between px-1 py-1 ${
            collapsed ? "flex-col gap-2" : ""
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-sm shadow-xs tracking-tight">
              IE
            </div>
            {!collapsed && (
              <div className="leading-tight overflow-hidden">
                <div className="flex items-center gap-1 font-semibold text-sm text-dark truncate">
                  <span>InmoElite Prime</span>
                  <span
                    className="material-symbols-outlined text-primary text-[14px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    verified
                  </span>
                </div>
                <p className="text-[10px] text-gray uppercase tracking-wider font-medium">
                  Bogotá D.C. HQ
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expandir menú" : "Contraer menú"}
            className="p-1 rounded-md text-gray hover:text-dark hover:bg-light-gray transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">
              {collapsed ? "chevron_right" : "chevron_left"}
            </span>
          </button>
        </div>

        {/* Quick CTA */}
        <Link
          href="/dashboard/properties/new"
          title="Nueva Propiedad"
          className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-primary hover:bg-primary-light active:bg-primary text-white text-xs font-semibold shadow-xs transition-all duration-150"
        >
          <span className="material-symbols-outlined text-[16px]">add_home_work</span>
          {!collapsed && <span>+ Nueva Propiedad</span>}
        </Link>

        {/* Navigation Links */}
        <nav className="space-y-0.5 pt-1">
          {navItems.map((item) => {
            const isActive = pathname ? isNavItemActive(item.href, pathname, navItems) : false;

            return (
              <Link
                key={item.label}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150 ${
                  collapsed ? "justify-center px-0" : ""
                } ${
                  isActive
                    ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary"
                    : "text-gray hover:text-dark hover:bg-light-gray"
                }`}
              >
                <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? "justify-center" : ""}`}>
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      isActive ? "text-primary" : "text-gray"
                    }`}
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!collapsed && item.badge && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded font-mono ${
                      isActive ? "bg-primary text-white" : "bg-light-gray text-gray"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile, Dark Mode Switch, Collapse & Sign Out */}
      <div className="pt-3 border-t border-border/70 space-y-2">
        <div
          className={`flex items-center gap-2 p-2 rounded-md bg-light-gray/60 border border-border/50 ${
            collapsed ? "flex-col" : "justify-between"
          }`}
        >
          <Link
            href="/dashboard/settings/profile"
            title="Ver mi perfil"
            className={`flex items-center gap-2 min-w-0 rounded-md hover:bg-light-gray transition-colors -m-1 p-1 ${
              collapsed ? "flex-col" : ""
            }`}
          >
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold font-mono">
                {userName ? initialsFromName(userName) : "?"}
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-white rounded-full" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-xs font-semibold text-dark truncate">{userName || "..."}</p>
                <p className="text-[10px] text-gray truncate">{userRole ?? "Admin"}</p>
              </div>
            )}
          </Link>
          {!collapsed && <ThemeToggle />}
        </div>

        {collapsed && <ThemeToggle className="w-full" />}

        <button
          type="button"
          onClick={handleSignOut}
          title="Cerrar sesión"
          className={`flex items-center gap-2 w-full rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-gray hover:bg-light-gray hover:text-danger transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">logout</span>
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
