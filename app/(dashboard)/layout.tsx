import type { Metadata } from "next";
import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listDealsForTenant, listPropertiesForTenant } from "@/lib/db/tenant-scope";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Dashboard" } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(await headers());
  if (!session) redirect("/login");

  const db = getDb(env.DB);
  const [{ properties }, deals] = await Promise.all([
    listPropertiesForTenant(db, session.tenantId, { limit: 500 }),
    listDealsForTenant(db, session.tenantId),
  ]);
  const counts = {
    properties: properties.length,
    opportunities: deals.filter((d) => d.stage !== "closed_lost" && d.stage !== "closed_won").length,
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] dark:bg-[#0b1120] print:block print:bg-white">
      <Sidebar counts={counts} />
      <div className="dashboard-content flex flex-1 flex-col min-w-0 pb-16 md:pb-0 md:ml-60 print:ml-0 print:pb-0">
        <div className="sticky top-0 z-30 print:hidden">
          <TopBar />
        </div>
        <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto print:p-0 print:max-w-full">
          {children}
        </main>
      </div>
      <div className="print:hidden">
        <MobileBottomNav />
      </div>
    </div>
  );
}
