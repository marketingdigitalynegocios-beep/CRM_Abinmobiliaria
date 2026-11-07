import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { ProfileForm } from "@/components/dashboard/ProfileForm";

export const metadata: Metadata = { title: "Mi Perfil" };

export default async function ProfilePage() {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-dark">Mi Perfil</h1>
        <p className="mt-1 text-sm text-gray">
          Administra tus datos personales y tu contraseña de acceso.
        </p>
      </div>

      <ProfileForm />
    </div>
  );
}
