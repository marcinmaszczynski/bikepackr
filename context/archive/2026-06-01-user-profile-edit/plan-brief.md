# User Profile Edit — Plan Brief

> Full plan: `context/changes/user-profile-edit/plan.md`

## What & Why

S-05 domyka Stream B roadmapy: zamknięcie auth end-to-end (FR-001/002) i dobudowanie edycji profilu (FR-004). Auth scaffold istnieje, ale flow rejestracji jest niezgodne z PRD (redirect na osobną stronę zamiast banera inline) i brakuje strony profilu. Ten plan naprawia oba problemy.

## Starting Point

Zaimplementowane: sign-in, sign-up, sign-out, middleware auth guard, komponenty formularzy (FormField, SubmitButton itd.), Banner.astro (generyczny komponent ze slotem). Brakuje: strony `/profile`, API endpoints do aktualizacji danych, display name w ogóle (brak tabeli i brak pola), banera weryfikacyjnego inline.

## Desired End State

Użytkownik po rejestracji trafia na dashboard z żółtym banerem "zweryfikuj email" (bez przerywania dostępu). Na `/profile` może ustawić display name (widoczne w Topbar zamiast emaila) i zmienić hasło z weryfikacją starego. Email w Topbar jest klikalnymem linkiem do profilu.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Display name storage | Supabase Auth `user_metadata.display_name` | Zero migracji DB — jedno pole, jedno API call | Plan |
| Email verification UX | Baner inline w Layout.astro | PRD wymaga "baner, ale pełny dostęp" — obecna separate-page niezgodna | Plan |
| Signup redirect | `/dashboard` zamiast `/auth/confirm-email` | Użytkownik od razu używa aplikacji | Plan |
| Profile route | `/profile` | Spójność z flat-routes projektu (/dashboard, /trips) | Plan |
| Profile form structure | Dwie osobne sekcje z osobnymi submitami | Izolacja błędów per sekcja, prostszy API contract | Plan |
| Password change | In-app z re-auth (signInWithPassword) | `updateUser()` nie weryfikuje starego hasła — re-auth jest konieczny | Plan |
| Display name w sign-up | Pominięte | Niższe tarcie przy rejestracji; można ustawić na /profile | Plan |
| Nawigacja do /profile | Email w Topbar staje się linkiem | Naturalny wzorzec UX bez rozbudowania Topbar | Plan |

## Scope

**In scope:**
- Fix signup redirect → `/dashboard`
- Baner weryfikacyjny email w Layout.astro
- `/profile` dodane do PROTECTED_ROUTES
- Strona `/profile` (SSR, Astro)
- `ProfileForm.tsx` — dwie sekcje: display name + zmiana hasła
- `POST /api/profile/update-name` — aktualizacja `user_metadata.display_name`
- `POST /api/profile/change-password` — re-auth + updateUser
- Topbar: email → link do /profile, pokazuje display_name jeśli ustawione

**Out of scope:**
- FR-003 reset hasła przez email (parked)
- Avatar użytkownika (poza scope v1)
- Zmiana emaila
- Tabela `profiles` w Supabase
- Display name w formularzu rejestracji

## Architecture / Approach

Supabase Auth `user_metadata` jako storage dla display_name — brak migracji, merge semantics. Re-auth pattern dla zmiany hasła: `signInWithPassword` (weryfikacja) → `updateUser({ password })`. Komponenty formularza reużywają istniejące auth komponenty (`FormField`, `SubmitButton`, `PasswordToggle`). Baner weryfikacyjny integruje się w istniejący wzorzec `Banner.astro` w `Layout.astro`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Email verification banner & route setup | Fix signup redirect + baner inline + /profile protected | Baner może nie pojawić się gdy `email_confirmed_at` jest null w dev environment |
| 2. Profile edit page | /profile z display name + zmianą hasła + Topbar update | Re-auth pattern dla zmiany hasła wymaga ostrożności (signInWithPassword może zastąpić sesję) |

**Prerequisites:** Auth scaffold działający (weryfikacja w Phase 1).  
**Estimated effort:** ~1-2 sesje, 2 fazy.

## Open Risks & Assumptions

- W środowisku dev Supabase może auto-potwierdzać emaile — `email_confirmed_at` może być ustawione od razu. Baner testowany na nowym koncie w produkcji lub przez zresetowanie potwierdzenia w Supabase Studio.
- `signInWithPassword` w endpoint change-password tworzy nową sesję na serwerze — zakładamy, że cookie handling w SSR kliencie poprawnie propaguje nową sesję przez Set-Cookie headers w redirect response.

## Success Criteria (Summary)

- Po rejestracji użytkownik ląduje na `/dashboard` z banerem weryfikacyjnym (nie na `/auth/confirm-email`)
- Na `/profile` można ustawić display name (widoczne w Topbar) i zmienić hasło z weryfikacją starego
- Pełne flow end-to-end: rejestracja → profil → zmiana hasła → re-login nowym hasłem
