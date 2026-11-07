export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-light-gray px-6 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-8 shadow-sm">
        {children}
      </div>
    </main>
  );
}
