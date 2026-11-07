"use client";

import { useState } from "react";
import { authClient, useSession } from "../../lib/auth/client";

export function ProfileForm() {
  const { data: session, refetch } = useSession();
  const user = session?.user;
  const role = (user as { role?: string } | undefined)?.role;
  const phone = (user as { phone?: string } | undefined)?.phone;

  const [name, setName] = useState(user?.name ?? "");
  const [phoneValue, setPhoneValue] = useState(phone ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  async function handleProfileSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      const { error } = await authClient.updateUser({
        name,
        phone: phoneValue || undefined,
      } as never);
      if (error) {
        setProfileError(error.message ?? "No se pudo actualizar el perfil");
        return;
      }
      await refetch?.();
      setProfileSaved(true);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (error) {
        setPasswordError(error.message ?? "No se pudo cambiar la contraseña");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSaved(true);
    } finally {
      setSavingPassword(false);
    }
  }

  if (!user) {
    return <p className="text-sm text-gray">Cargando perfil...</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
      {/* Datos personales */}
      <form
        onSubmit={handleProfileSubmit}
        className="bg-white rounded-lg border border-border shadow-xs p-5 space-y-4"
      >
        <h2 className="text-sm font-bold text-dark">Datos personales</h2>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray">Nombre completo</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full h-9 px-3 rounded-md border border-border bg-white text-sm text-dark focus:border-primary focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray">Correo electrónico</label>
          <input
            type="email"
            value={user.email}
            disabled
            className="w-full h-9 px-3 rounded-md border border-border bg-light-gray text-sm text-gray"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray">Teléfono</label>
          <input
            type="tel"
            value={phoneValue}
            onChange={(e) => setPhoneValue(e.target.value)}
            placeholder="300 123 4567"
            className="w-full h-9 px-3 rounded-md border border-border bg-white text-sm text-dark focus:border-primary focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray">Rol</label>
          <input
            type="text"
            value={role ?? "advisor"}
            disabled
            className="w-full h-9 px-3 rounded-md border border-border bg-light-gray text-sm text-gray"
          />
        </div>

        {profileError && <p className="text-xs text-danger">{profileError}</p>}
        {profileSaved && <p className="text-xs text-success">Perfil actualizado.</p>}

        <button
          type="submit"
          disabled={savingProfile}
          className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-light disabled:opacity-60 transition-colors"
        >
          {savingProfile ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      {/* Cambiar contraseña */}
      <form
        onSubmit={handlePasswordSubmit}
        className="bg-white rounded-lg border border-border shadow-xs p-5 space-y-4"
      >
        <h2 className="text-sm font-bold text-dark">Cambiar contraseña</h2>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray">Contraseña actual</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="w-full h-9 px-3 rounded-md border border-border bg-white text-sm text-dark focus:border-primary focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray">Nueva contraseña</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
            className="w-full h-9 px-3 rounded-md border border-border bg-white text-sm text-dark focus:border-primary focus:outline-none"
          />
        </div>

        {passwordError && <p className="text-xs text-danger">{passwordError}</p>}
        {passwordSaved && <p className="text-xs text-success">Contraseña actualizada.</p>}

        <button
          type="submit"
          disabled={savingPassword}
          className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-dark hover:bg-light-gray disabled:opacity-60 transition-colors"
        >
          {savingPassword ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </form>
    </div>
  );
}
