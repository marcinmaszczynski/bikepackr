import React, { useState } from "react";

const accommodationLabels: Record<string, string> = {
  hotel: "Hotel / Pensjonat",
  tent: "Namiot",
  hammock: "Hamak",
  bivy: "Bivy bag",
  hostel: "Hostel / Schronisko",
};

interface TripSummary {
  id: string;
  title: string | null;
  start_date: string;
  accommodation_type: string;
  created_at: string;
}

interface Props {
  initialTrips: TripSummary[];
}

export function PlanList({ initialTrips }: Props): React.JSX.Element {
  const [trips, setTrips] = useState<TripSummary[]>(initialTrips);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/trips/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Nie udało się usunąć planu.");
      setTrips((prev) => prev.filter((t) => t.id !== id));
      setPendingDeleteId(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Błąd.");
    } finally {
      setDeletingId(null);
    }
  }

  if (trips.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/10 p-8 text-center backdrop-blur-xl">
        <p className="text-blue-100/60">Nie masz jeszcze żadnych planów.</p>
        <a href="/trips/new" className="mt-4 inline-block text-sm text-purple-300 hover:underline">
          Wygeneruj swój pierwszy plan →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errorMsg && (
        <div className="flex items-start justify-between rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300">
          <span>{errorMsg}</span>
          <button
            onClick={() => {
              setErrorMsg(null);
            }}
            className="ml-3 shrink-0 text-red-400 hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}
      <ul className="space-y-3">
        {trips.map((trip) => (
          <li key={trip.id}>
            <div className="relative rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl transition-colors hover:bg-white/20">
              <a href={`/trips/${trip.id}`} className="block p-5 pr-20 text-white">
                <p className="font-semibold">{trip.title ?? "Plan bez nazwy"}</p>
                <p className="mt-1 text-sm text-blue-100/60">
                  {trip.start_date} · {accommodationLabels[trip.accommodation_type] ?? trip.accommodation_type}
                </p>
              </a>
              {pendingDeleteId === trip.id ? (
                <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2">
                  <button
                    onClick={() => {
                      void handleDelete(trip.id);
                    }}
                    disabled={deletingId === trip.id}
                    className="rounded px-2 py-1 text-xs text-red-400 transition-colors hover:text-red-300 disabled:opacity-50"
                  >
                    {deletingId === trip.id ? "…" : "Usuń"}
                  </button>
                  <button
                    onClick={() => {
                      setPendingDeleteId(null);
                    }}
                    className="rounded px-2 py-1 text-xs text-white/60 transition-colors hover:text-white"
                  >
                    Anuluj
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setPendingDeleteId(trip.id);
                  }}
                  className="absolute top-1/2 right-4 -translate-y-1/2 text-lg text-white/30 transition-colors hover:text-red-400"
                  aria-label={`Usuń plan ${trip.title ?? "bez nazwy"}`}
                >
                  ×
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
