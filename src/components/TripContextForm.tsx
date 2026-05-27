import React, { useState } from "react";
import { parseMarkdownToItems } from "@/lib/checklist-parser";

type Phase = "form" | "streaming" | "verifying" | "success" | "error";

interface GroupedCategory {
  category: string;
  items: string[];
}

const inputClass =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors";

const labelClass = "mb-1 block text-sm text-blue-100/80";

export function TripContextForm(): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>("form");
  const [streamedText, setStreamedText] = useState("");
  const [parsedItems, setParsedItems] = useState<GroupedCategory[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [accommodationType, setAccommodationType] = useState("");
  const [ridingPhilosophy, setRidingPhilosophy] = useState("");
  const [region, setRegion] = useState("");
  const [startDate, setStartDate] = useState("");
  const [tripDurationDays, setTripDurationDays] = useState("");
  const [title, setTitle] = useState("");

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setPhase("streaming");
    setStreamedText("");

    try {
      const res = await fetch("/api/generate/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accommodation_type: accommodationType,
          riding_philosophy: ridingPhilosophy,
          region,
          start_date: startDate,
          trip_duration_days: Number(tripDurationDays),
          title: title || undefined,
        }),
      });

      if (!res.ok) {
        setPhase("error");
        setErrorMessage(await res.text());
        return;
      }

      const fetchedTripId = res.headers.get("X-Trip-Id");

      const reader = (res.body as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setStreamedText((prev) => prev + decoder.decode(value, { stream: true }));
      }

      setPhase("verifying");

      if (!fetchedTripId) {
        setPhase("error");
        setErrorMessage("Brak identyfikatora planu w odpowiedzi.");
        return;
      }

      const countRes = await fetch(`/api/trips/${fetchedTripId}/items-count`);
      const countData = (await countRes.json()) as { count: number };

      if (countData.count > 0) {
        setStreamedText((current) => {
          const flat = parseMarkdownToItems(current);
          const groupMap = flat.reduce<Record<string, string[]>>((acc, { name, category }) => {
            (acc[category] ??= []).push(name);
            return acc;
          }, {});
          const grouped = Object.entries(groupMap).map(([cat, items]) => ({ category: cat, items }));
          setParsedItems(grouped);
          return current;
        });
        setPhase("success");
      } else {
        setPhase("error");
        setErrorMessage("Nie udało się zapisać checklisty. Poniżej znajdziesz wygenerowany tekst.");
      }
    } catch (err) {
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setIsLoading(false);
    }
  }

  if (phase === "streaming" || phase === "verifying") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-blue-100/60">
          {phase === "verifying" ? "Zapisywanie checklisty…" : "Generowanie checklisty…"}
        </p>
        <pre className="min-h-32 rounded-lg border border-white/10 bg-white/5 p-4 font-mono text-sm whitespace-pre-wrap text-white/90">
          {streamedText}
          {phase === "streaming" && <span className="animate-pulse">▋</span>}
        </pre>
      </div>
    );
  }

  if (phase === "success") {
    const totalItems = parsedItems.reduce((sum, g) => sum + g.items.length, 0);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Twoja checklista</h2>
          <span className="rounded-full bg-purple-600/30 px-3 py-1 text-sm text-purple-200">{totalItems} pozycji</span>
        </div>
        {parsedItems.map(({ category, items }) => (
          <div key={category}>
            <h3 className="mb-2 text-sm font-semibold tracking-wide text-blue-200/70 uppercase">{category}</h3>
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-white/90">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-purple-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-xs text-white/40">Lista wygenerowana przez AI — może być niepełna.</p>
        <button
          onClick={() => {
            setPhase("form");
            setStreamedText("");
            setParsedItems([]);
          }}
          className="text-sm text-purple-300 hover:underline"
        >
          Wygeneruj nową checklistę
        </button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-300">
          {errorMessage ?? "Wystąpił błąd podczas generowania."}
        </div>
        {streamedText && (
          <pre className="rounded-lg border border-white/10 bg-white/5 p-4 font-mono text-sm whitespace-pre-wrap text-white/70">
            {streamedText}
          </pre>
        )}
        <button
          onClick={() => {
            setPhase("form");
            setErrorMessage(null);
          }}
          className="text-sm text-purple-300 hover:underline"
        >
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="accommodation_type" className={labelClass}>
          Nocleg <span className="text-red-400">*</span>
        </label>
        <select
          id="accommodation_type"
          value={accommodationType}
          onChange={(e) => {
            setAccommodationType(e.target.value);
          }}
          required
          className={inputClass}
        >
          <option value="">— wybierz —</option>
          <option value="hotel">Hotel / Pensjonat</option>
          <option value="tent">Namiot</option>
          <option value="hammock">Hamak</option>
          <option value="bivy">Bivy bag</option>
          <option value="hostel">Hostel / Schronisko</option>
        </select>
      </div>

      <div>
        <label htmlFor="riding_philosophy" className={labelClass}>
          Filozofia jazdy <span className="text-red-400">*</span>
        </label>
        <select
          id="riding_philosophy"
          value={ridingPhilosophy}
          onChange={(e) => {
            setRidingPhilosophy(e.target.value);
          }}
          required
          className={inputClass}
        >
          <option value="">— wybierz —</option>
          <option value="fast_and_light">Fast &amp; Light (lekko i szybko)</option>
          <option value="expedition">Ekspedycyjny</option>
        </select>
      </div>

      <div>
        <label htmlFor="region" className={labelClass}>
          Region <span className="text-red-400">*</span>
        </label>
        <input
          id="region"
          type="text"
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
          }}
          placeholder="np. Tatry, Szkocja, Alpy"
          required
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="start_date" className={labelClass}>
          Data startu <span className="text-red-400">*</span>
        </label>
        <input
          id="start_date"
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
          }}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="trip_duration_days" className={labelClass}>
          Czas trwania (dni) <span className="text-red-400">*</span>
        </label>
        <input
          id="trip_duration_days"
          type="number"
          min="1"
          value={tripDurationDays}
          onChange={(e) => {
            setTripDurationDays(e.target.value);
          }}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="title" className={labelClass}>
          Nazwa planu
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
          placeholder="Nazwa planu (opcjonalnie)"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-60"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Generuję…
          </span>
        ) : (
          "Generuj checklistę"
        )}
      </button>
    </form>
  );
}
