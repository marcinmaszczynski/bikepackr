# First Gated Generation — Plan Brief

> Full plan: `context/changes/first-gated-generation/plan.md`

## What & Why

S-01 to gwiazda przewodnia Bikepackr — najmniejszy end-to-end przepływ udowadniający że rdzeń produktu działa: użytkownik wypełnia formularz kontekstu wyjazdu i widzi wygenerowaną przez AI checklistę z zastosowanymi regułami sztywnymi. Odblokowane przez F-01 (DB schema) i F-02 (AI streaming na Workers) — obie foundations zarchiwizowane.

## Starting Point

Tabele `trips` i `checklist_items` z RLS są gotowe w Supabase; Vercel AI SDK (`ai@^6.0.191` + `@ai-sdk/anthropic@^3.0.79`) zainstalowany i zweryfikowany na Workers; `src/lib/hard-rules.ts` istnieje z regułą hostelową; wzorzec formularzy React (FormField, SubmitButton) gotowy. Brakuje: rozszerzonych reguł, endpointu generowania i UI formularza.

## Desired End State

Zalogowany użytkownik na `/trips/new` wypełnia 5 pól (nocleg, filozofia jazdy, region, data, czas trwania), klika "Generuj checklistę", widzi tokeny pojawiające się stopniowo, a po < 30 s — checklistę zgrupowaną per kategoria z informacją o zapisaniu. Rekord `trips` i pozycje `checklist_items` (source='ai') utrwalone w Supabase. Reguły sztywne bezwzględnie egzekwowane w prompcie.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| UX flow | Jedna strona (form + stream poniżej) | Zero nawigacji, prostszy routing dla MVP | Plan |
| API design | Jeden endpoint POST /api/generate/checklist | onFinish callback w streamText obsługuje INSERT items bez drugiego round-tripu | Plan |
| AI output format | Markdown z `## Kategoria` headerami | Czytelny wizualnie podczas streamingu; onFinish parsuje na structured items | Plan |
| Kategorie | AI określa kontekstualnie | Bardziej naturalne; różne wyjazdy mogą wymagać różnych kategorii | Plan |
| Pola formularza | 5 wymaganych, bez flew_by_plane | Reguła lotnicza parkowana do v2; brak pola którego reguła nie istnieje | Plan |
| Min jakość | Min 10 pozycji | Prosta, konkretna bariera; poniżej 10 items lista jest nieużyteczna | Plan |
| Język AI | Polski | Aplikacja targetuje polskich użytkowników (persona: Marta) | Plan |
| Błąd zapisu | Pokaż błąd + zachowaj stream | Weryfikacja przez GET /api/trips/:id/items-count po zakończeniu strumienia | Plan |
| Post-stream display | Markdown → zgrupowane listy | Użytkownik widzi progress i strukturalny wynik końcowy | Plan |
| Nowe hard rules | Namiot/hamak/bivy + fast_and_light | Pokrycie najczęstszych przypadków; reguły lotnicze parkowane | Plan |

## Scope

**In scope:**
- Rozszerzenie `src/lib/hard-rules.ts` (namiot/bivy/hamak + fast_and_light)
- `POST /api/generate/checklist` — trip INSERT + AI stream + items INSERT w onFinish
- `GET /api/trips/:id/items-count` — weryfikacja zapisu
- Strona `/trips/new` + komponent `TripContextForm` (multi-phase: form → streaming → success/error)
- Usunięcie tymczasowych plików F-02 (GenerateTest, /generate/test, /api/generate/test)
- Ochrona `/trips` w middleware

**Out of scope:**
- GET /trips/:id (widok zapisanego planu) → S-03
- Edycja/usuwanie pozycji → S-02
- is_packed toggle → S-02
- Ocenianie planu → S-04
- flew_by_plane w formularzu → v2
- Walidacja jakości AI semantycznie

## Architecture / Approach

```
/trips/new (Astro + TripContextForm client:load)
    │
    └── POST /api/generate/checklist
            ├── context.locals.user → user_id
            ├── supabase INSERT trips → trip_id
            ├── evaluateHardRules() → buildHardRulesSection()
            ├── streamText({ system: Polish prompt + hard rules, onFinish })
            │       └── onFinish: parseMarkdownToItems() → supabase INSERT checklist_items
            └── new Response(stream.body, { 'X-Trip-Id': trip_id })

Client after stream:
    GET /api/trips/:id/items-count → { count: N }
    count > 0 → success view (grouped by category)
    count === 0 → error view (banner + raw markdown)
```

`src/lib/checklist-parser.ts` — czysta funkcja `parseMarkdownToItems(text): ParsedItem[]` używana zarówno w `onFinish` (server) jak i w React component (client, dla structured view).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Extended hard-rules | Nowe reguły namiot/bivy/hamak + fast_and_light w TS | Niskie — pure TS, zero side-effectów |
| 2. AI generation endpoint | POST /api/generate/checklist + items-count check; usunięcie plików F-02 | onFinish closure + Supabase na Workers — pattern nieużywany wcześniej |
| 3. Trip form + streaming UI | Strona /trips/new, formularz, multi-phase streaming display | Dwufazowy render (streaming → structured view) wymaga solidnej maszyny stanów |

**Prerequisites:** F-01 + F-02 zarchiwizowane (done); `ANTHROPIC_API_KEY` w `.dev.vars`
**Estimated effort:** ~2-3 sesje, 3 fazy

## Open Risks & Assumptions

- `onFinish` closure ma dostęp do Supabase client przechwyconych przed streamingiem — zweryfikowane koncepcyjnie na podstawie wzorca Workers, ale nie testowane w tej konfiguracji; jeśli INSERT w onFinish zawiedzie — trip istnieje bez items (items-count check to wykryje)
- Parser markdown jest wrażliwy na format AI — prompt wymaga ścisłego formatu `## Kategoria` + `- item`; halucynacje AI mogą złamać parser i zwrócić 0 items
- Min 10 items jest requesem do promptu, nie twardą walidacją serwera — AI może zwrócić mniej

## Success Criteria (Summary)

- Zalogowany użytkownik widzi strumieniującą checklistę w < 30 s z ciągłym progress wizualnym (NFR)
- Reguły sztywne są bezwzględne: namiot → śpiwór + mata zawsze obecne; fast_and_light → krzesło campingowe nigdy nieobecne
- Rekord trips + checklist_items (source='ai') zapisane w Supabase po zakończeniu generowania
