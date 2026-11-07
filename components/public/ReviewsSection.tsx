interface ReviewItem {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
}

export function ReviewsSection({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) return null;

  return (
    <section className="mt-10 border-t border-border pt-8">
      <h2 className="font-display text-xl font-semibold text-dark mb-4">Lo que dicen nuestros clientes</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => (
          <div key={review.id} className="rounded-lg border border-border bg-white p-4 shadow-xs">
            <div className="flex items-center gap-0.5 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className="material-symbols-outlined text-[16px]"
                  style={{ fontVariationSettings: i < review.rating ? "'FILL' 1" : "'FILL' 0" }}
                >
                  star
                </span>
              ))}
            </div>
            <p className="mt-2 text-sm text-dark leading-relaxed">&ldquo;{review.comment}&rdquo;</p>
            <p className="mt-2 text-xs font-semibold text-gray">— {review.authorName}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
