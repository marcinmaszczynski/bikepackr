# AI Generation Scaffold Plan (F-02)

## Overview

Instalacja Vercel AI SDK, stworzenie modułu `hard-rules.ts` definiującego architekturę reguł sztywnych, oraz budowa strumieniującego endpointu testowego ze stroną demonstracyjną w celu empirycznej weryfikacji, że streaming AI działa poprawnie na Cloudflare Workers. F-02 odblokowuje S-01.

## Current State Analysis

- Brak jakiegokolwiek AI SDK w `package.json` (nie ma `ai`, `@ai-sdk/anthropic`, `@anthropic-ai/sdk`)
- API routes pattern: `src/pages/api/auth/*.ts` — eksportują `APIRoute` handler, zwracają `context.redirect(...)` lub `new Response(...)`
- `astro.config.mjs`: adapter Cloudflare, `astro:env/server` dla secretów (SUPABASE_URL, SUPABASE_KEY jako `optional: true`)
- Sekrety lokalne w `.dev.vars` (nie `.env`); produkcja przez `wrangler secret put`
- Znane ryzyko: zachowanie `@astrojs/cloudflare` v13 przy SSR streaming jest nieudokumentowane — empiryczny test jest celem F-02
- Tabela `trips` ma kolumnę `flew_by_plane BOOLEAN` — reguła lotnicza **parkowana do v2** (decyzja: tylko prosta flaga w DB, bez logiki w v1)

### Key Discoveries:

- `astro.config.mjs:19-20` — wzorzec `optional: true` dla env vars; typ to `string | undefined`; endpointy muszą sprawdzić przed użyciem
- `src/pages/api/auth/signin.ts:9-11` — wzorzec `if (!supabase) return redirect(...)` stosowany konsekwentnie; analogicznie dla ANTHROPIC_API_KEY
- `wrangler.jsonc` — `"nodejs_compat"` compatibility flag już włączony; Node.js `crypto`, `stream` API dostępne w Workers
- `CLAUDE.md` — "AI calls belong in `src/pages/api/` endpoints, streamed via Cloudflare's streaming support"

## Desired End State

Po ukończeniu planu:
- `ai` i `@ai-sdk/anthropic` zainstalowane w `package.json`
- `ANTHROPIC_API_KEY` w schemacie `astro.config.mjs` i dodana do `.dev.vars` przez użytkownika
- `src/lib/hard-rules.ts` — moduł z `evaluateHardRules(context)` i `buildHardRulesSection(context)`, importowany przez S-01
- `src/pages/api/generate/test.ts` — POST endpoint, streamuje tekst przez `streamText().toTextStreamResponse()`
- `src/components/GenerateTest.tsx` — React komponent z fetch + ReadableStream reader, pokazuje tokeny w real-time
- `src/pages/generate/test.astro` — strona testowa ładująca komponent
- Empirycznie zweryfikowane: tokeny pojawiają się w przeglądarce stopniowo (<30s, ciągły progress wizualny)

## What We're NOT Doing

- Nie dodajemy reguły `flew_by_plane → wyklucz kuchenki gazowe` — parkowane do v2 (kolumna istnieje w DB, logika nie)
- Nie budujemy pełnego UI generowania checklisty — to S-01
- Nie używamy Anthropic SDK bezpośrednio — wybrano Vercel AI SDK
- Nie przechowujemy wyników generowania — endpoint testowy, bez zapisu do DB
- Nie dodajemy auth guard na stronie testowej — tymczasowa strona deweloperska
- Strona `/generate/test` i endpoint `POST /api/generate/test` są tymczasowe — oba muszą zostać usunięte w S-01 lub przed pierwszym deploiem produkcyjnym (endpoint jest niezabezpieczony)

## Implementation Approach

Trzy fazy w sekwencji: najpierw sam setup SDK i env (faza 1, zero runtime code), potem moduł reguł (faza 2, czysta logika TS), na końcu endpoint + strona testowa (faza 3, weryfikacja empiryczna). Każda faza ma własny commit. Faza 3 jest blokowana manualnym krokiem: użytkownik musi dodać `ANTHROPIC_API_KEY` do `.dev.vars` przed testem lokalnym.

## Critical Implementation Details

**`streamText().toTextStreamResponse()` na Workers:** `toTextStreamResponse()` zwraca `Response` z `ReadableStream` body i nagłówkiem `Content-Type: text/plain; charset=utf-8`. API route w Astro zwraca ten obiekt bezpośrednio — nie przez Astro SSR. To omija potencjalne problemy z flushem adaptera `@astrojs/cloudflare`.

**`ANTHROPIC_API_KEY` jako `optional: true`:** Typ w `astro:env/server` to `string | undefined`. Endpoint sprawdza przed użyciem i zwraca `new Response("ANTHROPIC_API_KEY not configured", { status: 503 })`. Nie używamy wzorca redirect dla endpointów streamingowych.

**Model w teście:** `claude-haiku-4-5-20251001` — najszybszy i najtańszy do walidacji streamingu. S-01 wybierze docelowy model niezależnie.

**`flew_by_plane` w `hard-rules.ts`:** Funkcja `evaluateHardRules` przyjmuje `Pick<Trip, "accommodation_type" | "riding_philosophy">` — bez `flew_by_plane` w typie wejściowym. Kolumna jest w DB ale nie jest parametrem hard-rules w v1.

---

## Phase 1: SDK installation + env schema

### Overview

Instalujemy Vercel AI SDK (dwa pakiety), dodajemy `ANTHROPIC_API_KEY` do schematu env w `astro.config.mjs`. Faza czysto konfiguracyjna — żadne nowe pliki runtime.

### Changes Required:

#### 1. Instalacja pakietów

**Command**: `npm install ai @ai-sdk/anthropic`

**Intent**: Dodać Vercel AI SDK core (`ai`) oraz provider Anthropic (`@ai-sdk/anthropic`) do `dependencies`.

**Contract**: Po instalacji `package.json` zawiera `"ai": "..."` i `"@ai-sdk/anthropic": "..."` w `dependencies`.

#### 2. Env schema

**File**: `astro.config.mjs`

**Intent**: Zarejestrować `ANTHROPIC_API_KEY` jako server-side secret — identyczny wzorzec jak `SUPABASE_URL` i `SUPABASE_KEY`.

**Contract**:
```js
ANTHROPIC_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
```

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi bez błędów TypeScript

#### Manual Verification:

- `package.json` zawiera `ai` i `@ai-sdk/anthropic` w `dependencies`
- Użytkownik dodaje `ANTHROPIC_API_KEY=<wartość>` do `.dev.vars`

**Implementation Note**: Po ukończeniu Phase 1 poczekaj na potwierdzenie, że `.dev.vars` zawiera klucz, zanim przejdziesz do Phase 3.

---

## Phase 2: Hard-rules module

### Overview

Tworzymy `src/lib/hard-rules.ts` — moduł z czystą logiką reguł sztywnych, niezależny od AI SDK. Eksportuje dwie funkcje: `evaluateHardRules` (logika) i `buildHardRulesSection` (formatowanie do promptu).

### Changes Required:

#### 1. Moduł reguł sztywnych

**File**: `src/lib/hard-rules.ts` (nowy plik)

**Intent**: Enkodować reguły sztywne jako czystą funkcję TypeScript, izolowaną od logiki generowania AI. Wynik wstrzykiwany do promptu przez S-01.

**Contract**:
```ts
import type { Trip } from "@/lib/supabase";

type HardRuleContext = Pick<Trip, "accommodation_type" | "riding_philosophy">;

export interface HardRuleResult {
  excluded: string[];
  required: string[];
}

export function evaluateHardRules(context: HardRuleContext): HardRuleResult {
  const excluded: string[] = [];
  const required: string[] = [];

  if (context.accommodation_type === "hostel") {
    excluded.push("sleeping bag", "camping mattress", "tent");
    required.push("sleep sack / liner");
  }

  return { excluded, required };
}

export function buildHardRulesSection(context: HardRuleContext): string {
  const { excluded, required } = evaluateHardRules(context);
  const lines: string[] = [];

  if (excluded.length > 0) {
    lines.push(`MUST NOT include: ${excluded.join(", ")}.`);
  }
  if (required.length > 0) {
    lines.push(`MUST include: ${required.join(", ")}.`);
  }

  if (lines.length === 0) return "";
  return `\n\nHARD RULES (these override AI judgment and are absolute):\n${lines.join("\n")}`;
}
```

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi bez błędów TypeScript

---

## Phase 3: Streaming endpoint + test page

### Overview

Budujemy endpoint streamingowy `POST /api/generate/test` używający `streamText().toTextStreamResponse()` oraz minimalną stronę testową `/generate/test` z React komponentem konsumującym stream. Weryfikacja empiryczna: tokeny pojawiają się w przeglądarce stopniowo, pełna odpowiedź w < 30 sekund.

### Changes Required:

#### 1. Endpoint streamingowy

**File**: `src/pages/api/generate/test.ts` (nowy plik)

**Intent**: Empiryczna weryfikacja, że `streamText().toTextStreamResponse()` prawidłowo strumieniuje tokeny przez Cloudflare Workers bez buforowania.

**Contract**:
```ts
import type { APIRoute } from "astro";
import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { ANTHROPIC_API_KEY } from "astro:env/server";

export const POST: APIRoute = async (context) => {
  if (!ANTHROPIC_API_KEY) {
    return new Response("ANTHROPIC_API_KEY not configured", { status: 503 });
  }

  const body = (await context.request.json()) as { prompt?: string };
  const userPrompt =
    typeof body.prompt === "string"
      ? body.prompt
      : "List 10 essential items for a 3-day bikepacking trip in a tent. Be concise.";

  const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY });
  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: "You are a bikepacking gear expert. Be practical and concise.",
    prompt: userPrompt,
  });

  return result.toTextStreamResponse();
};
```

#### 2. React komponent testowy

**File**: `src/components/GenerateTest.tsx` (nowy plik)

**Intent**: Interfejs do manualnej weryfikacji streamingu — pokazuje tokeny w real-time, mierzy czas do zakończenia.

**Contract**:
```tsx
import { useState } from "react";

export function GenerateTest() {
  const [prompt, setPrompt] = useState(
    "List 10 essential items for a 3-day bikepacking trip in a tent."
  );
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOutput("");
    setError(null);
    setElapsed(null);
    setStreaming(true);
    const start = Date.now();

    try {
      const response = await fetch("/api/generate/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok || !response.body) {
        setError(`Error: ${response.status}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setOutput((prev) => prev + decoder.decode(value, { stream: true }));
      }

      setElapsed(Date.now() - start);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">F-02: Streaming Test</h1>
      <p className="text-sm text-gray-500 mb-4">
        Tymczasowa strona weryfikacji. Zostanie usunięta w S-01.
      </p>
      <form onSubmit={handleSubmit} className="mb-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="w-full border rounded p-2 mb-2 font-mono text-sm"
        />
        <button
          type="submit"
          disabled={streaming}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {streaming ? "Streaming…" : "Generate"}
        </button>
      </form>
      {elapsed !== null && (
        <p className="text-sm text-green-600 mb-2">
          ✓ Completed in {(elapsed / 1000).toFixed(1)}s
        </p>
      )}
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <pre className="bg-gray-100 p-4 rounded whitespace-pre-wrap text-sm min-h-24 font-mono">
        {output || (streaming ? "▋" : "Output will appear here…")}
      </pre>
    </div>
  );
}
```

#### 3. Strona testowa

**File**: `src/pages/generate/test.astro` (nowy plik)

**Intent**: Minimalna strona Astro ładująca komponent testowy po stronie klienta.

**Contract**:
```astro
---
import { GenerateTest } from "@/components/GenerateTest";
---

<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <title>F-02 Streaming Test</title>
  </head>
  <body>
    <GenerateTest client:load />
  </body>
</html>
```

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi bez błędów TypeScript
- `npm run build` kończy się sukcesem

#### Manual Verification:

- Strona `/generate/test` ładuje się w przeglądarce lokalnie (`npm run dev`)
- Po kliknięciu "Generate" tokeny pojawiają się w textarea stopniowo (nie wszystkie naraz po zakończeniu)
- Pełna odpowiedź pojawia się w ciągu 30 sekund od kliknięcia
- Licznik czasu wyświetla się po zakończeniu streamingu
- `wrangler tail` (opcjonalnie) nie pokazuje błędów CPU timeout

---

## Testing Strategy

### Manual Testing Steps:

1. Dodaj `ANTHROPIC_API_KEY=<twój_klucz>` do `.dev.vars`
2. Uruchom `npm run dev`
3. Otwórz `http://localhost:4321/generate/test`
4. Kliknij "Generate" i obserwuj, czy tokeny pojawiają się stopniowo w real-time
5. Zweryfikuj, że licznik czasu < 30s po zakończeniu

## References

- Roadmap: `context/foundation/roadmap.md` — F-02, 3 unknowns
- PRD: `context/foundation/prd.md` — FR-006, NFR (ciągły progress wizualny, < 30s)
- Infrastructure: `context/foundation/infrastructure.md` — ryzyko streaming flush
- Supabase client pattern: `src/lib/supabase.ts`
- Auth API route pattern: `src/pages/api/auth/signin.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: SDK installation + env schema

#### Automated

- [x] 1.1 `npm install ai @ai-sdk/anthropic` — pakiety zainstalowane w dependencies
- [x] 1.2 ANTHROPIC_API_KEY dodany do env schema w astro.config.mjs
- [x] 1.3 `npm run lint` przechodzi bez błędów TypeScript

#### Manual

- [x] 1.4 `package.json` zawiera `ai` i `@ai-sdk/anthropic` w dependencies
- [x] 1.5 Użytkownik dodał `ANTHROPIC_API_KEY=<wartość>` do `.dev.vars`

### Phase 2: Hard-rules module

#### Automated

- [ ] 2.1 `src/lib/hard-rules.ts` istnieje z poprawnymi typami i eksportami
- [ ] 2.2 `npm run lint` przechodzi bez błędów TypeScript

### Phase 3: Streaming endpoint + test page

#### Automated

- [ ] 3.1 `src/pages/api/generate/test.ts` istnieje i eksportuje `POST: APIRoute`
- [ ] 3.2 `src/components/GenerateTest.tsx` istnieje i eksportuje `GenerateTest`
- [ ] 3.3 `src/pages/generate/test.astro` istnieje i importuje `GenerateTest` z `client:load`
- [ ] 3.4 `npm run lint` przechodzi bez błędów TypeScript
- [ ] 3.5 `npm run build` kończy się sukcesem

#### Manual

- [ ] 3.6 Strona `/generate/test` ładuje się poprawnie w przeglądarce
- [ ] 3.7 Po kliknięciu "Generate" tokeny pojawiają się stopniowo w real-time (streaming widoczny wizualnie)
- [ ] 3.8 Pełna odpowiedź pojawia się w ciągu 30 sekund — NFR spełniony
- [ ] 3.9 Licznik czasu wyświetla się po zakończeniu streamingu
