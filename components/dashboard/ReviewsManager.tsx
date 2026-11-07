"use client";

import { useEffect, useState } from "react";

interface ReviewItem {
  id: string;
  propertyId: string | null;
  authorName: string;
  rating: number;
  comment: string;
  isPublished: boolean;
  createdAt: string;
}

interface PropertyOption {
  id: string;
  title: string;
}

export function ReviewsManager({ properties }: { properties: PropertyOption[] }) {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch("/api/reviews");
    if (res.ok) {
      const data = (await res.json()) as { reviews: ReviewItem[] };
      setReviews(data.reviews);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!authorName.trim() || !comment.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: authorName.trim(),
          rating,
          comment: comment.trim(),
          propertyId: propertyId || undefined,
        }),
      });
      setAuthorName("");
      setComment("");
      setRating(5);
      setPropertyId("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTogglePublish(review: ReviewItem) {
    setReviews((prev) =>
      prev.map((r) => (r.id === review.id ? { ...r, isPublished: !r.isPublished } : r))
    );
    await fetch(`/api/reviews/${review.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !review.isPublished }),
    });
  }

  async function handleDelete(id: string) {
    setReviews((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/reviews/${id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="rounded-lg border border-border bg-white p-4 space-y-3">
        <h2 className="text-sm font-bold text-dark">Registrar una reseña</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Nombre del cliente"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            className="h-9 rounded-md border border-border px-3 text-sm text-dark focus:border-primary focus:outline-none"
          />
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="h-9 rounded-md border border-border px-3 text-sm text-dark focus:border-primary focus:outline-none"
          >
            <option value="">Sin propiedad asociada</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="material-symbols-outlined text-[22px] text-amber-400"
              style={{ fontVariationSettings: star <= rating ? "'FILL' 1" : "'FILL' 0" }}
            >
              star
            </button>
          ))}
        </div>
        <textarea
          placeholder="Qué dijo el cliente..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border px-3 py-2 text-sm text-dark focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-light disabled:opacity-50 transition-colors"
        >
          {submitting ? "Guardando..." : "Registrar reseña"}
        </button>
      </form>

      <div>
        <h2 className="text-sm font-bold text-dark mb-3">Reseñas registradas</h2>
        {loading ? (
          <p className="text-sm text-gray">Cargando...</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-gray">Sin reseñas todavía.</p>
        ) : (
          <ul className="space-y-2">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-white p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-dark">{review.authorName}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        review.isPublished
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-light-gray text-gray"
                      }`}
                    >
                      {review.isPublished ? "Publicada" : "Sin publicar"}
                    </span>
                  </div>
                  <p className="text-xs text-gray truncate">{review.comment}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTogglePublish(review)}
                    className="rounded border border-border px-2 py-1 text-[11px] font-medium text-primary hover:bg-light-gray transition-colors"
                  >
                    {review.isPublished ? "Despublicar" : "Publicar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(review.id)}
                    className="rounded border border-border px-2 py-1 text-[11px] font-medium text-gray hover:bg-red-50 hover:text-danger transition-colors"
                  >
                    Eliminar
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
