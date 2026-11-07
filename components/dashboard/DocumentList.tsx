"use client";

import { useEffect, useRef, useState } from "react";

interface DocumentItem {
  id: string;
  type: "contract" | "mandate" | "id_copy" | "other";
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

const typeLabels: Record<DocumentItem["type"], string> = {
  contract: "Contrato",
  mandate: "Mandato",
  id_copy: "Copia de identificación",
  other: "Otro",
};

function formatSize(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentList({
  leadId,
  dealId,
  propertyId,
}: {
  leadId?: string;
  dealId?: string;
  propertyId?: string;
}) {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<DocumentItem["type"]>("contract");
  const [uploading, setUploading] = useState(false);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const params = new URLSearchParams();
      if (leadId) params.set("leadId", leadId);
      if (dealId) params.set("dealId", dealId);
      if (propertyId) params.set("propertyId", propertyId);

      const res = await fetch(`/api/documents?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as { documents: DocumentItem[] };
        setDocs(data.documents || []);
      }
    } catch (err: any) {
      console.error("Error loading documents:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, dealId, propertyId]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setUploading(true);
    setPendingFileName(selectedFile.name);
    setError(null);

    try {
      const form = new FormData();
      form.set("file", selectedFile);
      form.set("type", type);
      if (leadId) form.set("leadId", leadId);
      if (dealId) form.set("dealId", dealId);
      if (propertyId) form.set("propertyId", propertyId);

      const res = await fetch("/api/documents", { method: "POST", body: form });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "No se pudo subir el documento");
        return;
      }
      await load();
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error al subir el archivo");
    } finally {
      setUploading(false);
      setPendingFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro de que deseas eliminar este documento?")) return;
    setDeletingId(id);
    const prev = docs;
    setDocs((current) => current.filter((d) => d.id !== id));
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setDocs(prev);
        setError("No se pudo eliminar el documento");
      }
    } catch (err: any) {
      setDocs(prev);
      setError("Error de red al eliminar el documento");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray dark:text-slate-400 py-3">
        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
        <span>Cargando documentos adjuntos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Botón y selector de tipo de documento */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-dark dark:text-slate-300 whitespace-nowrap">
            Tipo:
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DocumentItem["type"])}
            className="h-9 rounded-lg border border-border dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-dark dark:text-slate-200 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          >
            <option value="contract">📄 Contrato</option>
            <option value="mandate">📝 Mandato</option>
            <option value="id_copy">🪪 Copia de identificación</option>
            <option value="other">📁 Otro</option>
          </select>
        </div>

        {/* Input de archivo oculto */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt,.md,.xls,.xlsx"
        />

        {/* Botón estilizado para subir */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 h-9 rounded-lg bg-primary hover:bg-primary-light px-4 text-xs font-semibold text-white shadow-2xs transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">
            {uploading ? "progress_activity" : "upload_file"}
          </span>
          <span>{uploading ? "Subiendo archivo..." : "Subir documento"}</span>
        </button>

        <span className="text-[11px] text-gray dark:text-slate-400 hidden sm:inline">
          PDF, Word, imágenes o texto (máx. 15MB)
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-2.5 text-xs text-danger">
          <span className="material-symbols-outlined text-[16px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Lista de documentos subidos abajo con opción de eliminar */}
      <div className="space-y-2">
        {/* Documento subiéndose en tiempo real */}
        {uploading && pendingFileName && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/10 p-3 text-sm animate-pulse">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="material-symbols-outlined text-[20px] text-primary animate-spin">
                progress_activity
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-dark dark:text-white text-xs">
                  {pendingFileName}
                </p>
                <p className="text-[11px] text-primary">Subiendo y guardando documento...</p>
              </div>
            </div>
            <span className="text-xs font-medium text-primary">Subiendo...</span>
          </div>
        )}

        {/* Lista de documentos ya subidos */}
        {docs.length === 0 && !uploading ? (
          <div className="rounded-lg border border-dashed border-border dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 text-center">
            <span className="material-symbols-outlined text-2xl text-gray dark:text-slate-500 mb-0.5">
              folder_open
            </span>
            <p className="text-xs font-medium text-gray dark:text-slate-400">
              Sin documentos adjuntos todavía.
            </p>
            <p className="text-[11px] text-gray dark:text-slate-500 mt-0.5">
              Haz clic en &quot;Subir documento&quot; para adjuntar contratos, escrituras o copias.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {docs.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border dark:border-slate-800 bg-white dark:bg-slate-850 p-3 text-sm transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-primary dark:text-blue-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">description</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-xs text-dark dark:text-white" title={doc.fileName}>
                      {doc.fileName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray dark:text-slate-400 mt-0.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {typeLabels[doc.type] || "Documento"}
                      </span>
                      <span>·</span>
                      <span>{formatSize(doc.sizeBytes)}</span>
                      <span>·</span>
                      <span>
                        {new Date(doc.createdAt).toLocaleDateString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acciones: Descargar y Eliminar */}
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`/api/documents/${doc.id}/download`}
                    download
                    className="inline-flex items-center gap-1 rounded-md border border-border dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-primary dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    <span>Descargar</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    className="inline-flex items-center gap-1 rounded-md border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/30 px-2.5 py-1.5 text-[11px] font-medium text-danger hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {deletingId === doc.id ? "progress_activity" : "delete"}
                    </span>
                    <span>{deletingId === doc.id ? "Eliminando..." : "Eliminar"}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
