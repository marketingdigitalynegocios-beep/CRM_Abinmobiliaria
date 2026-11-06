import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-light-gray">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar userName={session.user.name} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
