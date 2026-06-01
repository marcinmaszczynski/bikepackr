import React, { useState } from "react";
import type { Trip, ChecklistItem } from "@/lib/supabase";

const inputClass =
  "rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors";

interface Props {
  trip: Trip;
  initialItems: ChecklistItem[];
}

export function ChecklistView({ trip, initialItems }: Props): React.JSX.Element {
  const [items, setItems] = useState<ChecklistItem[]>(initialItems);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const grouped = items.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  const categoryOptions = Array.from(new Set([...items.map((i) => i.category), "Inne"]));

  const packedCount = items.filter((i) => i.is_packed).length;
  const totalCount = items.length;

  async function handleToggle(item: ChecklistItem) {
    const desired = !item.is_packed;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_packed: desired } : i)));
    try {
      const res = await fetch(`/api/trips/${trip.id}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_packed: desired }),
      });
      if (!res.ok) throw new Error("Nie udało się zaktualizować pozycji.");
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_packed: item.is_packed } : i)));
      setErrorMsg(err instanceof Error ? err.message : "Błąd.");
    }
  }

  async function handleDelete(item: ChecklistItem) {
    try {
      const res = await fetch(`/api/trips/${trip.id}/items/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Nie udało się usunąć pozycji.");
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Błąd.");
    }
  }

  async function handleAdd(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newName.trim() || !newCategory) return;
    setIsAdding(true);
    try {
      const res = await fetch(`/api/trips/${trip.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), category: newCategory }),
      });
      if (!res.ok) throw new Error("Nie udało się dodać pozycji.");
      const added = (await res.json()) as ChecklistItem;
      setItems((prev) => [...prev, added]);
      setNewName("");
      setNewCategory("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Błąd.");
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{trip.title ?? "Plan bez nazwy"}</h2>
        <span className="rounded-full bg-purple-600/30 px-3 py-1 text-sm text-purple-200">
          {packedCount}/{totalCount} spakowane
        </span>
      </div>

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

      {Object.entries(grouped).map(([category, categoryItems]) => (
        <div key={category}>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-blue-200/70 uppercase">{category}</h3>
          <ul className="space-y-1">
            {categoryItems.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.is_packed}
                  onChange={() => {
                    void handleToggle(item);
                  }}
                  className="size-4 shrink-0 accent-purple-400"
                />
                <span className={item.is_packed ? "text-white/40 line-through" : "text-white/90"}>{item.name}</span>
                <button
                  onClick={() => {
                    void handleDelete(item);
                  }}
                  className="ml-auto shrink-0 text-white/30 transition-colors hover:text-red-400"
                  aria-label={`Usuń ${item.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <form
        onSubmit={(e) => {
          void handleAdd(e);
        }}
        className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4"
      >
        <p className="text-sm font-medium text-blue-100/70">Dodaj pozycję</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
            }}
            placeholder="Nazwa pozycji"
            className={`flex-1 ${inputClass}`}
          />
          <select
            value={newCategory}
            onChange={(e) => {
              setNewCategory(e.target.value);
            }}
            className={inputClass}
          >
            <option value="" disabled>
              Kategoria
            </option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isAdding || !newName.trim() || !newCategory}
            className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-60"
          >
            {isAdding ? "…" : "Dodaj"}
          </button>
        </div>
      </form>

      <p className="text-xs text-white/40">Lista wygenerowana przez AI — może być niepełna.</p>
      <a href="/trips/new" className="text-sm text-purple-300 hover:underline">
        Wygeneruj nowy plan
      </a>
    </div>
  );
}
