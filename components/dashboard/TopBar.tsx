"use client";

import Link from "next/link";
import { NotificationBell } from "./NotificationBell";

export function TopBar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white/95 dark:bg-slate-900/95 px-4 md:px-6 backdrop-blur-md shadow-2xs">
      {/* Left: Mobile Brand / Desktop Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        {/* Mobile brand indicator */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-xs">
            IE
          </div>
          <span className="font-semibold text-sm text-dark truncate">InmoElite</span>
        </div>

        {/* Desktop Search Bar */}
        <div className="relative hidden md:block w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar código (#INM-...), cliente o dirección..."
            className="w-full h-9 pl-9 pr-12 rounded-md border border-border bg-light-gray/50 text-xs text-dark placeholder:text-gray focus:border-primary focus:bg-white focus:outline-none transition-all"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none px-1.5 py-0.5 text-[10px] font-semibold text-gray bg-white rounded border border-border">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Quick Actions & User Name */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Quick actions for desktop */}
        <div className="hidden lg:flex items-center gap-2">
          <Link
            href="/dashboard/properties/new"
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-light shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Propiedad</span>
          </Link>
          <Link
            href="/dashboard/crm"
            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-dark hover:bg-light-gray transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-gray">view_kanban</span>
            <span className="hidden xl:inline">Pipeline</span>
          </Link>
        </div>

        <NotificationBell />
      </div>
    </header>
  );
}
