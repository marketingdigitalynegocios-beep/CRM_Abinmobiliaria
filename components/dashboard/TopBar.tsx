"use client";

import { authClient } from "../../lib/auth/client";

export function TopBar({ userName }: { userName: string }) {
  async function handleSignOut() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-white px-6 py-3">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray">{userName}</span>
        <button
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-dark hover:bg-light-gray"
          onClick={handleSignOut}
          type="button"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
