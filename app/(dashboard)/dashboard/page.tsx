import type { Metadata } from "next";

export const metadata: Metadata = { title: "Resumen" };

export default function DashboardHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-dark">Resumen</h1>
      <p className="mt-2 text-sm text-gray">
        Empieza publicando tus primeras propiedades desde{" "}
        <a className="font-medium text-primary" href="/dashboard/properties">
          Propiedades
        </a>
        .
      </p>
    </div>
  );
}
