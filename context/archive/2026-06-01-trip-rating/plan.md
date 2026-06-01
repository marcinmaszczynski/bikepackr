# Trip Rating Implementation Plan

## Overview

Implementacja oceniania planów w skali 1–6 (FR-010). Użytkownik ocenia plan przed wyjazdem (`pre_trip_rating`) i po powrocie (`post_trip_rating`) — obie opcjonalne. Główny Success Criterion produktu (75% planów z oceną ≥ 4) nie jest mierzalny bez tej funkcji.

## Current State Analysis

Baza danych ma już kolumny `pre_trip_rating` i `post_trip_rating` (INTEGER 1–6, nullable) w tabeli `trips` — migracja nie jest wymagana. Typ `Trip` w `src/lib/supabase.ts` eksportuje te pola. Brak UI i endpointu API dla ocen.

## Desired End State

Na stronie wyjazdu (`/trips/[id]`) poniżej checklisty pojawia się sekcja gwiazdkowego widgetu oceny:
- Przed datą startu wyjazdu — widget `pre_trip_rating` z etykietą „Ocena planu przed wyjazdem"
- Po dacie startu — widget `post_trip_rating` z etykietą „Ocena realizacji po powrocie"

Kliknięcie gwiazdki zapisuje ocenę natychmiast. Gwiazdki odzwierciedlają aktualną ocenę przy kolejnym otwarciu strony.

### Key Discoveries

- `src/lib/database.types.ts:59` — `pre_trip_rating: number | null`, `post_trip_rating: number | null` już istnieją
- `src/lib/supabase.ts:27` — typ `Trip` eksportowany, dostępny w komponentach React
- `src/pages/api/trips/[id]/items/[itemId].ts` — wzorzec PATCH endpointu: `context.locals.user`, `createClient`, parse body, validate, Supabase update, `Response.json(data)`
- `src/components/ChecklistView.tsx:13` — przyjmuje `trip: Trip` (zawiera `pre_trip_rating` i `post_trip_rating`)
- `src/pages/trips/[id].astro:16` — `supabase.from("trips").select("*")` — `*` już pobiera pola ocen
- Data wyjazdu: `trip.start_date` to string `YYYY-MM-DD`; porównanie leksykograficzne z `new Date().toISOString().slice(0, 10)` jest wystarczające dla klienta

## What We're NOT Doing

- Brak dodatkowej migracji Supabase (kolumny już istnieją)
- Brak triggerów ani powiadomień push o post-trip ocenie
- Brak wyświetlania ocen na dashboardzie (lista planów)
- Brak możliwości usunięcia oceny (można zmienić, nie wyczyścić)
- Brak oceny połówkowej (wyłącznie całe liczby 1–6)

## Implementation Approach

Dwie fazy: najpierw backend (endpoint API), potem UI (komponent gwiazdkowy + integracja). Wzorzec komponentu gwiazdkowego identyczny z ChecklistView: lokalny stan React + optimistic update + error banner.

## Phase 1: PATCH /api/trips/[id]/rating

### Overview

Nowy endpoint API przyjmujący ocenę pre lub post-trip i zapisujący do Supabase. RLS na poziomie bazy gwarantuje, że użytkownik może aktualizować tylko własne tripy.

### Changes Required

#### 1. Rating API endpoint

**File**: `src/pages/api/trips/[id]/rating.ts`

**Intent**: Dedykowany PATCH endpoint dla zapisu oceny tripu. Akceptuje dokładnie jedno pole (`pre_trip_rating` lub `post_trip_rating`) z wartością 1–6. Zwraca zaktualizowany trip.

**Contract**:
- `PATCH /api/trips/{id}/rating`
- Body: `{ pre_trip_rating: number }` lub `{ post_trip_rating: number }`, gdzie number ∈ [1, 6]
- 200: `{ pre_trip_rating: number | null, post_trip_rating: number | null }`
- 400: gdy brak wymaganego pola lub wartość poza zakresem
- 401: gdy użytkownik niezalogowany
- 404: gdy trip nie istnieje lub RLS odrzuca

```ts
// Walidacja — klucz i wartość:
const ALLOWED_FIELDS = ["pre_trip_rating", "post_trip_rating"] as const;
type RatingField = (typeof ALLOWED_FIELDS)[number];

const field = ALLOWED_FIELDS.find((f) => f in body) as RatingField | undefined;
const value = field ? (body as Record<string, unknown>)[field] : undefined;
if (!field || typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 6) {
  return new Response("Invalid rating field or value", { status: 400 });
}
```

### Success Criteria

#### Automated Verification

- `npm run lint` przechodzi bez błędów
- `npm run build` kończy się sukcesem

#### Manual Verification

- PATCH z `{ pre_trip_rating: 4 }` na istniejącym tripie zwraca 200 z zaktualizowanymi polami
- PATCH z wartością `0` lub `7` zwraca 400
- PATCH bez żadnego pola ratingu zwraca 400
- PATCH bez sesji (nieautoryzowany) zwraca 401
- PATCH na cudzym tripie zwraca 404 (RLS)

**Implementation Note**: Po zakończeniu tej fazy i przejściu testów automatycznych — zatrzymaj się i zweryfikuj manualnie endpoint (curl lub DevTools) przed przejściem do fazy 2.

---

## Phase 2: TripRating component + ChecklistView integration

### Overview

Nowy komponent gwiazdkowy `TripRating` + wplecenie go do istniejącego `ChecklistView`. Logika wyboru pre/post na podstawie `start_date`.

### Changes Required

#### 1. TripRating component

**File**: `src/components/TripRating.tsx`

**Intent**: Samodzielny widget 6 gwiazdek z hover-preview i optimistic update. Wywołuje PATCH /api/trips/{tripId}/rating po kliknięciu. Pokazuje błąd w razie niepowodzenia (ten sam wzorzec error banner co ChecklistView).

**Contract**:
```ts
interface TripRatingProps {
  tripId: string;
  field: "pre_trip_rating" | "post_trip_rating";
  initialRating: number | null;
  label: string;
}
```

Stan wewnętrzny:
- `rating: number | null` — aktualna wartość (inicjalizowana z `initialRating`)
- `hovered: number | null` — indeks gwiazdki pod kursorem (null = brak)
- `isSaving: boolean` — request w locie
- `error: string | null` — komunikat błędu

Logika gwiazdki `i` (1–6): wypełniona jeśli `i <= (hovered ?? rating ?? 0)`.

#### 2. ChecklistView integration

**File**: `src/components/ChecklistView.tsx`

**Intent**: Dodanie sekcji oceny poniżej checklisty. Obliczenie `isPastTrip` po stronie klienta i wybranie odpowiedniego pola i etykiety dla `TripRating`.

**Contract**: Wstawić przed tagiem zamykającym `<div className="space-y-6">` (przed `<p>Lista wygenerowana...`):

```tsx
// Porównanie leksykograficzne dat YYYY-MM-DD jest poprawne
const isPastTrip = trip.start_date <= new Date().toISOString().slice(0, 10);
const ratingField = isPastTrip ? "post_trip_rating" : "pre_trip_rating";
const ratingLabel = isPastTrip ? "Ocena realizacji po powrocie" : "Ocena planu przed wyjazdem";
const ratingValue = isPastTrip ? trip.post_trip_rating : trip.pre_trip_rating;
```

### Success Criteria

#### Automated Verification

- `npm run lint` przechodzi bez błędów
- `npm run build` kończy się sukcesem

#### Manual Verification

- Trip z `start_date` w przyszłości: widać widget z etykietą „Ocena planu przed wyjazdem"
- Trip z `start_date` w przeszłości: widać widget z etykietą „Ocena realizacji po powrocie"
- Kliknięcie gwiazdki: gwiazdki aktualizują się natychmiast (optimistic), ocena persystuje po odświeżeniu
- Hover na gwiazdkach: preview fill do hoverowanej gwiazdki
- Błąd API: error banner pojawia się, gwiazdki wracają do poprzedniej wartości

**Implementation Note**: Przetestuj oba przypadki (pre/post) — zmień `start_date` tripu w Supabase Studio jeśli potrzebujesz tripu z przeszłości.

---

## Testing Strategy

### Manual Testing Steps

1. Otwórz trip z `start_date` za tydzień → widać widget „przed wyjazdem"
2. Kliknij 4 gwiazdki → odśwież → gwiazdki nadal wypełnione na 4
3. Zmień `start_date` tripu na miesiąc temu (przez Supabase Studio)
4. Odśwież stronę → widget zmienił się na „po powrocie"
5. Oceń realizację na 5 gwiazdek → odśwież → persystuje

## References

- Roadmap slice S-04: `context/foundation/roadmap.md` (linie 139–150)
- FR-010: `context/foundation/prd.md`
- Wzorzec PATCH: `src/pages/api/trips/[id]/items/[itemId].ts`
- Wzorzec React state: `src/components/ChecklistView.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: PATCH /api/trips/[id]/rating

#### Automated

- [x] 1.1 `npm run lint` przechodzi bez błędów — 7b1d5f5
- [x] 1.2 `npm run build` kończy się sukcesem — 7b1d5f5

#### Manual

- [x] 1.3 PATCH z `{ pre_trip_rating: 4 }` zwraca 200 — 7b1d5f5
- [x] 1.4 PATCH z wartością spoza zakresu zwraca 400 — 7b1d5f5
- [x] 1.5 PATCH bez sesji zwraca 401 — 7b1d5f5

### Phase 2: TripRating component + ChecklistView integration

#### Automated

- [x] 2.1 `npm run lint` przechodzi bez błędów — ad7e3f3
- [x] 2.2 `npm run build` kończy się sukcesem — ad7e3f3

#### Manual

- [x] 2.3 Trip z przyszłą datą → widget „przed wyjazdem" widoczny — ad7e3f3
- [x] 2.4 Trip z przeszłą datą → widget „po powrocie" widoczny — ad7e3f3
- [x] 2.5 Kliknięcie gwiazdki → persystuje po odświeżeniu — ad7e3f3
- [x] 2.6 Hover → preview fill poprawny — ad7e3f3
- [x] 2.7 Błąd API → error banner i rollback gwiazdek — ad7e3f3
