"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: NotificationItem[]; unread: number };
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      // Silencioso: la campanita no debe tumbar el resto del dashboard.
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleMarkAllRead() {
    await fetch("/api/notifications", { method: "POST" });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  }

  async function handleItemClick(item: NotificationItem) {
    if (!item.read) {
      await fetch(`/api/notifications/${item.id}`, { method: "PATCH" });
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      setUnread((prev) => Math.max(0, prev - 1));
    }
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white hover:bg-light-gray transition-colors"
        title="Notificaciones"
      >
        <span className="material-symbols-outlined text-[18px] text-gray">notifications</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-lg border border-border bg-white shadow-lg z-50">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold text-dark">Notificaciones</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="p-4 text-xs text-gray text-center">Sin notificaciones todavía.</p>
          ) : (
            <ul>
              {items.map((item) => {
                const content = (
                  <div
                    className={`border-b border-border/60 px-3 py-2.5 text-xs hover:bg-light-gray transition-colors ${
                      item.read ? "" : "bg-primary/5"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {!item.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                      <span className="font-semibold text-dark">{item.title}</span>
                    </div>
                    {item.body && <p className="mt-0.5 text-gray">{item.body}</p>}
                    <p className="mt-0.5 text-[10px] text-gray">
                      {new Date(item.createdAt).toLocaleString("es-CO")}
                    </p>
                  </div>
                );

                return (
                  <li key={item.id}>
                    {item.link ? (
                      <Link href={item.link} onClick={() => handleItemClick(item)}>
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => handleItemClick(item)}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
