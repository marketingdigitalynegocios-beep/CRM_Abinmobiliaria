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

/**
 * NEXT_PUBLIC_CLOUDFLARE_IMAGES_DELIVERY_URL todavía no está configurado
 * (pendiente de aprovisionar Cloudflare Images, ver plan-implementacion.md
 * §0). Sin esa variable, las imágenes recién subidas se muestran como una
 * casilla con el id en vez de romperse con una <img> sin src.
 */
const deliveryBaseUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGES_DELIVERY_URL;

function buildPreviewUrl(imageId: string) {
  if (!deliveryBaseUrl) return null;
  return `${deliveryBaseUrl}/${imageId}/public`;
}

/**
 * Sube directo a Cloudflare Images (ver blueprint §11 "Flujo de subida"): pide
 * una Direct Creator Upload URL a `/api/upload`, sube el archivo desde el
 * navegador a esa URL (no pasa por nuestro Worker), y guarda solo el
 * `image_id` devuelto.
 */
export function ImageUploader({ images, onChange, context, maxImages = 20 }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          const mintRes = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ context }),
          });
          if (!mintRes.ok) throw new Error("No se pudo iniciar la subida");
          const { upload_url, image_id } = (await mintRes.json()) as {
            upload_url: string;
            image_id: string;
          };

          const form = new FormData();
          form.set("file", file);
          const uploadRes = await fetch(upload_url, { method: "POST", body: form });
          if (!uploadRes.ok) throw new Error("Falló la subida a Cloudflare Images");

          uploaded.push({ id: image_id, url: buildPreviewUrl(image_id) ?? "" });
        }
        onChange([...images, ...uploaded]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al subir la imagen");
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

  return (
    <div>
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-md border-2 border-dashed px-4 py-8 text-center text-sm text-gray ${
          isDragActive ? "border-primary bg-primary-light/10" : "border-border"
        }`}
      >
        <input {...getInputProps()} />
        {uploading
          ? "Subiendo..."
          : isDragActive
            ? "Suelta las imágenes acá"
            : `Arrastra fotos o haz clic para elegirlas (${images.length}/${maxImages})`}
      </div>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((img) => (
            <div
              className="group relative aspect-square overflow-hidden rounded-md border border-border bg-light-gray"
              key={img.id}
            >
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="h-full w-full object-cover" src={img.url} />
              ) : (
                <div className="flex h-full items-center justify-center p-2 text-center text-[10px] break-all text-gray">
                  {img.id}
                </div>
              )}
              <button
                className="absolute top-1 right-1 hidden rounded-full bg-black/60 px-2 py-0.5 text-xs text-white group-hover:block"
                onClick={() => removeImage(img.id)}
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
