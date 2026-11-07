"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const mobileTabs = [
  { href: "/dashboard", label: "Resumen", icon: "space_dashboard" },
  { href: "/dashboard/properties", label: "Propiedades", icon: "apartment" },
  { href: "/dashboard/crm", label: "Oportunidades", icon: "view_kanban" },
  { href: "/dashboard/ai-agent", label: "Agente IA", icon: "smart_toy", hasBadge: true },
  { href: "/dashboard/settings/agency", label: "Ajustes", icon: "settings" },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-white/95 px-2 backdrop-blur md:hidden shadow-lg safe-area-pb">
      {mobileTabs.map((tab) => {
        const isActive =
          tab.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors ${
              isActive ? "text-primary font-bold" : "text-gray hover:text-dark"
            }`}
          >
            <div className="relative">
              <span
                className={`material-symbols-outlined text-[22px] ${
                  isActive ? "text-primary" : "text-gray"
                }`}
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {tab.icon}
              </span>
              {tab.hasBadge && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              )}
            </div>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

