"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-light transition-colors"
    >
      <span className="material-symbols-outlined text-[16px]">print</span>
      <span>Imprimir / Guardar PDF</span>
    </button>
  );
}
