"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

export interface UploadedImage {
  id: string;
  url: string;
}

interface ImageUploaderProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  context: "property" | "agency_logo";
  maxImages?: number;
}

const deliveryBaseUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGES_DELIVERY_URL;

function buildPreviewUrl(imageId: string): string | null {
  if (!imageId) return null;
  if (imageId.startsWith("http://") || imageId.startsWith("https://") || imageId.startsWith("data:")) {
    return imageId;
  }
  if (!deliveryBaseUrl) return null;
  return `${deliveryBaseUrl}/${imageId}/public`;
}

export function ImageUploader({ images, onChange, context, maxImages = 20 }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setError(null);
      const remaining = maxImages - images.length;
      const files = acceptedFiles.slice(0, Math.max(remaining, 0));
      if (files.length === 0) return;

      setUploading(true);
      try {
        const uploaded: UploadedImage[] = [];
        for (const file of files) {
          try {
            const mintRes = await fetch("/api/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ context }),
            });
            if (mintRes.ok) {
              const { upload_url, image_id } = (await mintRes.json()) as {
                upload_url: string;
                image_id: string;
              };

              const form = new FormData();
              form.set("file", file);
              const uploadRes = await fetch(upload_url, { method: "POST", body: form });
              if (uploadRes.ok) {
                uploaded.push({ id: image_id, url: buildPreviewUrl(image_id) ?? "" });
                continue;
              }
            }
          } catch {
            // En desarrollo local sin credenciales reales de Cloudflare Images,
            // usamos la imagen como DataURL local.
          }

          // Fallback a DataURL para visualización local inmediata
          const dataUrl = await readFileAsDataUrl(file);
          uploaded.push({ id: dataUrl, url: dataUrl });
        }
        onChange([...images, ...uploaded]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al procesar la imagen");
      } finally {
        setUploading(false);
      }
    },
    [images, onChange, context, maxImages]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    disabled: uploading || images.length >= maxImages,
  });

  function removeImage(id: string) {
    onChange(images.filter((img) => img.id !== id));
  }

  function handleAddUrl() {
    if (!urlInput.trim()) return;
    const cleanUrl = urlInput.trim();
    if (images.length >= maxImages) {
      setError(`Límite máximo de ${maxImages} imágenes alcanzado.`);
      return;
    }
    onChange([...images, { id: cleanUrl, url: cleanUrl }]);
    setUrlInput("");
    setShowUrlInput(false);
  }

  return (
    <div className="space-y-3">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center text-xs transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5 dark:bg-primary/10"
            : "border-border hover:border-primary/50 bg-slate-50/50 dark:bg-slate-800/40"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center gap-1.5">
          <span className="material-symbols-outlined text-[28px] text-primary">
            add_photo_alternate
          </span>
          <p className="font-semibold text-dark text-xs">
            {uploading
              ? "Procesando fotos..."
              : isDragActive
              ? "Suelta las imágenes aquí"
              : `Arrastra fotos o haz clic para elegirlas (${images.length}/${maxImages})`}
          </p>
          <p className="text-[11px] text-gray">Formatos admitidos: JPG, PNG, WebP</p>
        </div>
      </div>

      {/* URL Add Input Accordion */}
      <div className="flex items-center justify-between text-xs pt-1">
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-primary hover:underline font-medium flex items-center gap-1 text-[11px]"
        >
          <span className="material-symbols-outlined text-[14px]">link</span>
          <span>{showUrlInput ? "Ocultar opción de URL" : "+ Agregar por URL o enlace web"}</span>
        </button>
        <span className="text-[11px] text-gray">
          {images.length} de {maxImages} fotos añadidas
        </span>
      </div>

      {showUrlInput && (
        <div className="flex gap-2 p-2.5 rounded-lg border border-border bg-light-gray/40 dark:bg-slate-800">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Pega la URL de la imagen (https://...)"
            className="flex-1 h-8 rounded border border-border px-2.5 text-xs text-dark focus:border-primary focus:outline-none bg-white dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={handleAddUrl}
            disabled={!urlInput.trim()}
            className="h-8 px-3 rounded bg-primary text-white text-xs font-semibold hover:bg-primary-light disabled:opacity-50 transition-colors"
          >
            Agregar
          </button>
        </div>
      )}

      {error && <p className="text-xs text-danger font-medium">{error}</p>}

      {/* Grid of uploaded images */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 pt-1">
          {images.map((img, idx) => {
            const displayUrl =
              img.url ||
              (img.id.startsWith("http://") ||
              img.id.startsWith("https://") ||
              img.id.startsWith("data:")
                ? img.id
                : buildPreviewUrl(img.id));

            return (
              <div
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-slate-100 dark:bg-slate-800 shadow-2xs"
                key={`${img.id}-${idx}`}
              >
                {displayUrl ? (
                  <img
                    alt={`Foto ${idx + 1}`}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                    src={displayUrl}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-2 text-center text-[10px] break-all text-gray">
                    {img.id.slice(0, 24)}
                  </div>
                )}

                {/* Badge if cover/index */}
                {idx === 0 && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.2 text-[9px] font-bold text-white uppercase tracking-wider backdrop-blur-2xs">
                    Portada
                  </span>
                )}

                {/* Remove button */}
                <button
                  className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-600 transition-colors shadow-sm"
                  onClick={() => removeImage(img.id)}
                  title="Eliminar foto"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
