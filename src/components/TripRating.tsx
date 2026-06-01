import React, { useState } from "react";

interface TripRatingProps {
  tripId: string;
  field: "pre_trip_rating" | "post_trip_rating";
  initialRating: number | null;
  label: string;
}

export function TripRating({ tripId, field, initialRating, label }: TripRatingProps): React.JSX.Element {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [hovered, setHovered] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRate(value: number) {
    const previous = rating;
    setRating(value);
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/rating`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Nie udało się zapisać oceny.");
    } catch (err) {
      setRating(previous);
      setError(err instanceof Error ? err.message : "Błąd.");
    } finally {
      setIsSaving(false);
    }
  }

  const displayValue = hovered ?? rating ?? 0;

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-medium text-blue-100/70">{label}</p>
      <div className="flex gap-1">
        {Array.from({ length: 6 }, (_, i) => i + 1).map((star) => (
          <button
            key={star}
            type="button"
            disabled={isSaving}
            onClick={() => {
              void handleRate(star);
            }}
            onMouseEnter={() => {
              setHovered(star);
            }}
            onMouseLeave={() => {
              setHovered(null);
            }}
            className="text-2xl leading-none transition-colors disabled:opacity-50"
            aria-label={`Ocena ${star}`}
          >
            <span className={star <= displayValue ? "text-yellow-400" : "text-white/20"}>★</span>
          </button>
        ))}
        {rating !== null && <span className="ml-2 self-center text-sm text-white/50">{rating}/6</span>}
      </div>
      {error && (
        <div className="flex items-start justify-between rounded-lg border border-red-400/30 bg-red-500/10 p-2 text-sm text-red-300">
          <span>{error}</span>
          <button
            onClick={() => {
              setError(null);
            }}
            className="ml-3 shrink-0 text-red-400 hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
