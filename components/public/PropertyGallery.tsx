"use client";

import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

export function PropertyGallery({ images }: { images: { id: string; url: string }[] }) {
  const withUrl = images.filter((img) => img.url);

  if (withUrl.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg bg-light-gray text-sm text-gray">
        Sin fotos todavía
      </div>
    );
  }

  return (
    <PhotoProvider>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {withUrl.map((img) => (
          <PhotoView key={img.id} src={img.url}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              className="aspect-square w-full cursor-pointer rounded-md object-cover"
              src={img.url}
            />
          </PhotoView>
        ))}
      </div>
    </PhotoProvider>
  );
}
