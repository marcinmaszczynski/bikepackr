# User Profile Edit Implementation Plan

## Overview

Zamykamy S-05 z roadmapy: użytkownik może zarejestrować konto, zalogować się i edytować profil (nazwa wyświetlana + zmiana hasła). Auth scaffold istnieje — ten plan weryfikuje flow end-to-end (FR-001/002), naprawia niezgodność z PRD (baner weryfikacyjny email zamiast osobnej strony redirect) i dobudowuje brakującą stronę profilu (FR-004).

## Current State Analysis

Auth scaffold jest w pełni zaimplementowany: `src/pages/api/auth/signin.ts`, `signup.ts`, `signout.ts`, komponenty React (`SignInForm`, `SignUpForm`, `FormField`, `PasswordToggle`, `SubmitButton`, `ServerError`), middleware auth guard (`src/middleware.ts`), Topbar z warunkowym renderowaniem.

**Brakuje:**
- Strony `/profile` (nie istnieje)
- API endpoints do aktualizacji display name i zmiany hasła
- Display name w ogóle (brak tabeli `profiles`, brak pola w formularzu, brak w `user_metadata`)
- Banera weryfikacyjnego email inline — obecny flow: `signup.ts:19` redirectuje na `/auth/confirm-email` (osobna strona), co jest niezgodne z PRD ("baner, ale pełny dostęp")

**Wzorce do naśladowania:**
- Błędy: `context.redirect('/ścieżka?error=...')` — `signup.ts:16`, `signin.ts:16`
- Ochrona ścieżek: `PROTECTED_ROUTES` w `src/middleware.ts:4`
- Layout zawiera już `Banner.astro` — używa go do `missingConfigs`; ten sam komponent obsłuży baner weryfikacyjny

## Desired End State

Po ukończeniu planu:
- Rejestracja kieruje na `/dashboard` z banerem weryfikacyjnym (nie na osobną stronę)
- Zalogowany użytkownik z niezweryfikowanym emailem widzi baner na każdej chroniionej stronie
- `/profile` (protected) pozwala zmienić display name i hasło
- Topbar pokazuje `display_name` jeśli ustawione, inaczej email; jest linkiem do `/profile`

### Key Discoveries:

- `Banner.astro:1-13` — generyczny komponent ze slotem i wariantami `info/warning/error`; `Layout.astro:3,23-37` już go importuje i renderuje dla `missingConfigs` — wzorzec do skopiowania dla banera weryfikacyjnego
- `Layout.astro` nie odczytuje `Astro.locals` — wymaga dodania jednej linii w frontmatter
- `Topbar.astro:11` — `{user.email}` renderowany jako `<span>`, nie link
- Supabase Auth `updateUser({ data: { display_name } })` merguje user_metadata — zero migracji DB
- Zmiana hasła: `updateUser({ password })` nie weryfikuje starego hasła — wymaga jawnego re-auth przez `signInWithPassword` w endpoint `change-password.ts`

## What We're NOT Doing

- Brak pola display name w formularzu rejestracji (rejestracja zostaje 2-polowa)
- Brak avatara użytkownika (poza scope v1 per PRD §Non-Goals)
- Brak FR-003 reset hasła przez email (nice-to-have, parked w roadmapie)
- Brak tabeli `profiles` w Supabase (display name idzie w `user_metadata`)
- Brak zmiany emaila (nie jest w FR-004)

## Implementation Approach

Dwie fazy w zależności od charakteru zmian. Faza 1 naprawia istniejący flow i ustawia podstawy (baner inline, ochrona trasy `/profile`). Faza 2 buduje nową funkcjonalność (strona profilu + API endpoints + aktualizacja Topbar). Obydwie fazy są weryfikowalne end-to-end manualnie po ukończeniu.

## Critical Implementation Details

**Weryfikacja starego hasła:** Supabase `auth.updateUser({ password })` nie wymaga starego hasła — każdy z aktywną sesją mógłby zmienić hasło bez jego znajomości. Endpoint `change-password.ts` musi najpierw wywołać `signInWithPassword({ email: user.email!, password: currentPassword })` i odrzucić request jeśli ta operacja zwróci błąd, dopiero potem wywołać `updateUser({ password: newPassword })`.

**Baner weryfikacyjny w Layout.astro:** `Layout.astro` to plik `.astro` — Astro.locals jest dostępne przez `const { user } = Astro.locals;` w frontmatter. Baner pokazywać gdy `user && !user.email_confirmed_at`.

---

## Phase 1: Email verification banner & route setup

### Overview

Naprawia niezgodność z PRD: rejestracja kieruje na `/dashboard` zamiast osobnej strony, a baner weryfikacyjny pojawia się inline. Dodaje `/profile` do chronionych ścieżek.

### Changes Required:

#### 1. Middleware — dodanie /profile do PROTECTED_ROUTES

**File**: `src/middleware.ts`

**Intent**: Dodać `/profile` do tablicy `PROTECTED_ROUTES` żeby niezalogowany użytkownik był przekierowany na `/auth/signin` gdy wejdzie na stronę profilu.

**Contract**: Jeden string `"/profile"` dopisany do istniejącej tablicy `PROTECTED_ROUTES` przy linii 4.

#### 2. Signup API — zmiana redirect po rejestracji

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Zmienić redirect po udanej rejestracji z `/auth/confirm-email` na `/dashboard` — użytkownik trafia od razu do aplikacji zgodnie z PRD ("weryfikacja nie blokuje dostępu").

**Contract**: Linia 19: `return context.redirect("/auth/confirm-email")` → `return context.redirect("/dashboard")`.

#### 3. Layout — baner weryfikacyjny email

**File**: `src/layouts/Layout.astro`

**Intent**: Wyświetlić baner `warning` gdy zalogowany użytkownik nie zweryfikował jeszcze adresu email. Baner ma pojawić się na wszystkich stronach które używają Layout (dashboard, trips, profile). Znika automatycznie gdy `user.email_confirmed_at` jest ustawione.

**Contract**: W frontmatter dodać `const { user } = Astro.locals;`. W `<body>`, po pętli `missingConfigs` a przed `<slot />`, dodać warunkowy `<Banner variant="warning">` z tekstem informującym o weryfikacji, renderowany gdy `user && !user.email_confirmed_at`.

### Success Criteria:

#### Automated Verification:

- Lint przechodzi bez błędów: `npm run lint`
- Build przechodzi: `npm run build`

#### Manual Verification:

- Po rejestracji nowego konta użytkownik ląduje na `/dashboard`, nie na `/auth/confirm-email`
- Dashboard niezweryfikowanego konta pokazuje żółty baner weryfikacyjny
- Baner zawiera czytelny tekst o konieczności weryfikacji emaila
- Niezalogowany użytkownik wchodzący na `/profile` jest przekierowany na `/auth/signin`
- Zalogowany użytkownik może wejść na `/profile` (wyświetla 404 lub pustą stronę — OK, będzie zbudowana w Phase 2)

**Implementation Note**: Po ukończeniu tej fazy i przejściu automated verification, zatrzymaj się i ręcznie przetestuj flow rejestracji (nowe konto) oraz dostępność `/profile`. Dopiero po potwierdzeniu przejdź do Phase 2.

---

## Phase 2: Profile edit page

### Overview

Buduje stronę `/profile` z dwiema sekcjami edycji (display name + zmiana hasła) oraz aktualizuje Topbar do wyświetlenia display_name i linkowania do profilu.

### Changes Required:

#### 1. Profile page

**File**: `src/pages/profile.astro`

**Intent**: Strona SSR profilu użytkownika. Odczytuje `user` z `Astro.locals`, pre-wypełnia display name z `user.user_metadata?.display_name`. Odczytuje `?success` i `?error` z query params do wyświetlenia feedback po submit. Renderuje `ProfileForm` jako client:load.

**Contract**: Strona chroniona przez middleware (Phase 1). Przekazuje do `ProfileForm` propsy: `displayName: string`, `successType?: "name" | "password"`, `serverError?: string`. Używa `src/layouts/Layout.astro` z `title="Profile"`.

#### 2. ProfileForm React component

**File**: `src/components/ProfileForm.tsx`

**Intent**: Interaktywny komponent z dwiema niezależnymi sekcjami formularza: (1) zmiana display name, (2) zmiana hasła. Każda sekcja ma własny submit → własny API endpoint. Wzorzec walidacji client-side identyczny jak w `SignUpForm.tsx`.

**Contract**: Props: `{ displayName: string; successType?: "name" | "password"; serverError?: string }`. Sekcja 1: `form[action="/api/profile/update-name"][method="POST"]` z polem `display_name`. Sekcja 2: `form[action="/api/profile/change-password"][method="POST"]` z polami `current_password`, `new_password`, `confirm_new_password` (min 6 znaków). Reuses `FormField`, `SubmitButton`, `ServerError`, `PasswordToggle` z `src/components/auth/`.

#### 3. API endpoint — update display name

**File**: `src/pages/api/profile/update-name.ts`

**Intent**: Aktualizuje `display_name` w `user_metadata` Supabase Auth dla zalogowanego użytkownika.

**Contract**: `POST`. Reads `display_name` from `formData`. Calls `supabase.auth.updateUser({ data: { display_name } })`. On success: `context.redirect("/profile?success=name")`. On error: `context.redirect("/profile?error=...")`. Requires active session (middleware zapewnia, że endpoint jest dostępny tylko dla zalogowanych).

#### 4. API endpoint — change password

**File**: `src/pages/api/profile/change-password.ts`

**Intent**: Zmienia hasło użytkownika po uprzedniej weryfikacji obecnego hasła przez re-auth. Wymaga jawnej weryfikacji `current_password` żeby zabezpieczyć przed zmianą hasła z przejętej sesji.

**Contract**: `POST`. Reads `current_password`, `new_password`, `confirm_new_password` from `formData`. Validates `new_password === confirm_new_password` (client-side + server-side). Re-authenticates: `supabase.auth.signInWithPassword({ email: user.email!, password: current_password })` — jeśli błąd, redirect z error. Then: `supabase.auth.updateUser({ password: new_password })`. On success: `context.redirect("/profile?success=password")`. On error: `context.redirect("/profile?error=...")`.

#### 5. Topbar — link do profilu i display_name

**File**: `src/components/Topbar.astro`

**Intent**: Email użytkownika staje się klikalnymem linkiem do `/profile`. Wyświetla `display_name` jeśli ustawione, inaczej email — żeby użytkownik widział efekt edycji display name natychmiast po powrocie do Topbar.

**Contract**: Linia 11: `<span class="text-blue-100/70">{user.email}</span>` → `<a href="/profile" class="text-blue-100/70 hover:underline">{user.user_metadata?.display_name || user.email}</a>`. Styl `hover:underline` wystarczy — bez zmiany koloru (zachowanie stylu istniejących linków nav).

### Success Criteria:

#### Automated Verification:

- TypeScript nie zgłasza błędów: `npm run lint`
- Build produkcyjny przechodzi: `npm run build`

#### Manual Verification:

- `/profile` ładuje się z pre-wypełnionym display name (pusty przy pierwszym wejściu)
- Zapisanie display name → strona przeładowuje z `?success=name` → Topbar pokazuje nową nazwę zamiast emaila
- Zmiana hasła z błędnym obecnym hasłem → sekcja pokazuje komunikat błędu
- Zmiana hasła z niezgodnymi nowymi hasłami → walidacja client-side blokuje submit
- Zmiana hasła poprawna → redirect z `?success=password` → komunikat sukcesu na stronie
- Po zmianie hasła użytkownik pozostaje zalogowany
- Email w Topbar jest linkiem do `/profile` na wszystkich stronach
- Reuse komponentów: `FormField`, `SubmitButton`, `PasswordToggle` działają identycznie jak w auth formach

**Implementation Note**: Po ukończeniu tej fazy przetestuj pełne flow: rejestracja → baner weryfikacyjny → przejście na /profile → zmiana display name (widoczne w Topbar) → zmiana hasła → re-login z nowym hasłem.

---

## Testing Strategy

### Manual Testing Steps:

1. Zarejestruj nowe konto → sprawdź redirect na `/dashboard`, baner weryfikacyjny
2. Wejdź na `/profile` → sprawdź pustą sekcję display name
3. Ustaw display name → sprawdź czy Topbar pokazuje nową nazwę
4. Spróbuj zmienić hasło z błędnym obecnym hasłem → sprawdź komunikat błędu
5. Zmień hasło poprawnie → wyloguj → zaloguj nowym hasłem
6. Wejdź na `/profile` bez logowania → sprawdź redirect na `/auth/signin`

## Migration Notes

Brak migracji DB. Display name trafia do `auth.users.raw_user_meta_data` przez Supabase Auth API — zero SQL.

## References

- PRD: `context/foundation/prd.md` — FR-001, FR-002, FR-004
- Roadmap: `context/foundation/roadmap.md` — S-05
- Auth patterns: `src/pages/api/auth/signin.ts`, `signup.ts`
- Banner wzorzec: `src/layouts/Layout.astro:23-37`
- Form components: `src/components/auth/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Email verification banner & route setup

#### Automated

- [x] 1.1 Lint przechodzi bez błędów: `npm run lint`
- [x] 1.2 Build przechodzi: `npm run build`

#### Manual

- [x] 1.3 Po rejestracji nowego konta użytkownik ląduje na `/dashboard`, nie na `/auth/confirm-email`
- [x] 1.4 Dashboard niezweryfikowanego konta pokazuje żółty baner weryfikacyjny
- [x] 1.5 Niezalogowany użytkownik wchodzący na `/profile` jest przekierowany na `/auth/signin`

### Phase 2: Profile edit page

#### Automated

- [ ] 2.1 TypeScript nie zgłasza błędów: `npm run lint`
- [ ] 2.2 Build produkcyjny przechodzi: `npm run build`

#### Manual

- [ ] 2.3 `/profile` ładuje się z pre-wypełnionym display name
- [ ] 2.4 Zapisanie display name → Topbar pokazuje nową nazwę
- [ ] 2.5 Zmiana hasła z błędnym obecnym hasłem → komunikat błędu
- [ ] 2.6 Zmiana hasła poprawna → redirect z sukcesem; użytkownik pozostaje zalogowany
- [ ] 2.7 Email w Topbar jest linkiem do `/profile`
- [ ] 2.8 Pełne flow end-to-end: rejestracja → profil → zmiana hasła → re-login
