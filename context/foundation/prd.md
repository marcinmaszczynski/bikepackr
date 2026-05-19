---
project: "Bikepackr"
version: 1
status: draft
created: 2026-05-19
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 6
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

Bikepacking — podróżowanie na rowerze z własnym ekwipunkiem — wymaga planowania zestawu sprzętu przed każdym wyjazdem. Nawet doświadczeni bikepackerzy potrafią zapomnieć o kluczowych elementach; nowicjusze często nie mają świadomości, że każdy gram ma znaczenie i że bikepacking to sztuka kompromisów. Brak narzędzia, które uwzględni kontekst konkretnej podróży (lot samolotem, pogoda, teren, styl noclegu), powoduje wyjazdy z zapomnianym sprzętem lub z przeciążonym rowerem.

Wiedza o tym, co zabrać w danym kontekście, istnieje — pochodzi od doświadczonych bikepackerów — ale jest rozproszona i trudno dostępna dla początkujących. Bikepackr enkoduje tę wiedzę jako zestaw reguł i udostępnia ją każdemu, kto planuje wyjazd, w formie spersonalizowanej checklisty generowanej na podstawie odpowiedzi na ankietę kontekstową.

## User & Persona

### Primary persona

**Marta, 28 lat, pasjonatka jazdy na rowerze z ambicjami bikepackingowymi.**

Marta jeździ rekreacyjnie od kilku lat, ale dopiero zaczyna myśleć o dłuższych wyjazdach bikepacking. Planuje pierwszy overnight — jedną noc w lesie. Nie wie od czego zacząć: co zabrać, jak to spakować, ile to będzie ważyć. Kiedy szuka informacji w internecie, napotyka ogólne listy, które nie uwzględniają jej konkretnego kontekstu (pogody, stylu noclegu). Sięga po Bikepackr w momencie, gdy siada do planowania wyjazdu — zazwyczaj kilka dni lub tygodnie przed wyruszeniem.

### Secondary persona

Doświadczony bikepacker (nie jest targetem MVP), który wraca do aplikacji w trakcie podróży, żeby zweryfikować checklistę. Obsługiwany przez tę samą funkcjonalność.

## Success Criteria

### Primary

- 75% stworzonych planów podróży otrzymuje od użytkownika ocenę ≥ 4 w skali 1–6.
  *(Mierzone: suma ocen ≥ 4 / liczba ocenionych planów × 100%)*

### Secondary

- Użytkownik aktywnie wraca do swojego planu w aplikacji podczas trwania podróży (otwiera plan co najmniej raz po dacie startowej wyjazdu) — wskaźnik realnej przydatności w terenie.

### Guardrails

- Plany użytkownika są widoczne wyłącznie dla niego. Nieautoryzowany dostęp do cudzego planu jest niemożliwy.
- Aplikacja działa poprawnie na aktualnych wersjach Chrome, Firefox i Safari (desktop).

## User Stories

### US-01: Użytkownik planuje wyjazd i otrzymuje spersonalizowaną checklistę

- **Given** zalogowany użytkownik, który nie ma jeszcze planu na nadchodzący wyjazd
- **When** wypełnia formularz kontekstowy (styl podróży, nocleg, lot samolotem, teren, daty)
- **Then** widzi wygenerowaną checklistę ekwipunku i czynności, dopasowaną do kontekstu wyjazdu

#### Acceptance Criteria

- Reguły sztywne są bezwzględne: np. jeśli użytkownik zaznaczył lot samolotem — kuchenka gazowa nie pojawia się na liście.
- Checklista zawiera co najmniej 1 pozycję; brak czystego empty-state bez wyjaśnienia.
- Filozofia jazdy (fast&light vs oblężnicza) wpływa na proponowany zestaw — wyniki są różne dla różnych deklaracji.
- Generator zawsze zwraca wynik lub czytelną informację o błędzie; generowanie nigdy nie kończy się milczącą awarią.

## Functional Requirements

### Autentykacja

- FR-001: Użytkownik może zarejestrować konto podając email i hasło; e-mail weryfikacyjny jest wysyłany, ale nie blokuje dostępu do aplikacji. Priority: must-have
  > Socrates: Kontrargument rozważony: "weryfikacja emaila przed użyciem to za dużo friction". Rozwiązanie: zmieniono FR — weryfikacja nie blokuje; użytkownik widzi baner z prośbą o weryfikację, ale ma pełny dostęp.
- FR-002: Użytkownik może zalogować się do konta. Priority: must-have
  > Socrates: Brak kontrargumentu; FR-002 jest poprawny.
- FR-003: Użytkownik może zresetować hasło przez email. Priority: nice-to-have
  > Socrates: Kontrargument rozważony: "system e-mail transakcyjny zwiększa złożoność infrastruktury w MVP". Rozwiązanie: obniżono priorytet do nice-to-have — v1 dopuszcza manualny reset przez admina.
- FR-004: Użytkownik może edytować dane profilu (nazwa wyświetlana, zmiana hasła). Priority: must-have
  > Socrates: Brak kontrargumentu; FR-004 jest poprawny (zmiana hasła to wymóg bezpieczeństwa).

### Planowanie podróży

- FR-005: Zalogowany użytkownik może dostarczyć kontekst podróży w celu wygenerowania planu. Priority: must-have
  > Socrates: Kontrargument rozważony: "progresywna konfiguracja byłaby lepsza niż statyczna ankieta". Rozwiązanie: zmieniono opis FR — nie specyfikuje formy zbierania kontekstu (ankieta vs. progresywna); forma to decyzja UX/tech, nie wymaganie produktowe.
- FR-006: System generuje checklistę ekwipunku i czynności na podstawie kontekstu podróży; reguły sztywne są bezwzględne, kontekstowe uzupełnienie wypełnia przestrzeń poza nimi; pora roku/teren służy jako proxy warunków pogodowych. Priority: must-have
  > Socrates: Kontrargument rozważony: "halucynacje generatywne podcinają zaufanie jeśli lista jest absurdalna". Rozwiązanie: FR bez zmian; dodany NFR o przezroczystości — użytkownik zawsze wie, że lista może być niepełna.
- FR-007: Użytkownik może edytować wygenerowaną checklistę (dodawanie/usuwanie pozycji). Priority: must-have
  > Socrates: Brak kontrargumentu; edycja jest niezbędna — użytkownicy zawsze wiedzą coś, czego generator nie wie.
- FR-008: Użytkownik może zaznaczyć pozycję checklisty jako „spakowane". Priority: must-have
  > Socrates: Brak kontrargumentu; zaznaczanie jest must-have — kluczowy use case: weryfikacja ekwipunku w trakcie pakowania.
- FR-009: Użytkownik może wrócić do dowolnego swojego planu i przeglądać go w dowolnym momencie. Priority: must-have
  > Socrates: Brak kontrargumentu; persystencja planów to standard. Uwaga: offline access (tereny bez internetu) to oddzielna, świadoma decyzja techniczna.
- FR-011: Użytkownik może usunąć swój plan podróży. Priority: must-have
  > Socrates: Brak kontrargumentu; podstawowe zarządzanie danymi własnymi.

### Ocenianie

- FR-010: Użytkownik może ocenić wygenerowany plan w skali 1–6 w dwóch momentach: przed wyjazdem (ocena planu) i po powrocie (ocena realizacji) — obie opcjonalne. Priority: must-have
  > Socrates: Kontrargument rozważony: "ocena przed wyjazdem mierzy intencję, nie rezultat". Rozwiązanie: zmieniono FR — dwa etapy oceniania (przed/po), oba opcjonalne; post-trip ocena waliduje rzeczywistość.

## Non-Functional Requirements

- Plany użytkownika są widoczne wyłącznie dla niego; nieautoryzowany dostęp do cudzego planu jest niemożliwy przy poprawnym uwierzytelnieniu.
- Aplikacja zawsze informuje użytkownika, że wygenerowana lista jest generatywna i może być niepełna — nigdy nie prezentuje jej jako pełnej ani definitywnej.
- Aplikacja działa poprawnie na aktualnych wersjach Chrome, Firefox i Safari (desktop i mobile — responsywny layout). *(Uwaga: natywna aplikacja mobilna jest non-goal; responsywność webowa to nie to samo.)*
- Użytkownik widzi ciągły postęp wizualny podczas każdej operacji trwającej > 2 sekundy; wynik generowania pojawia się w czasie < 30 sekund od submitu kontekstu.

## Business Logic

Na podstawie kontekstu podróży aplikacja rekomenduje minimalny bezpieczny zestaw ekwipunku, który użytkownik powinien zabrać.

Użytkownik dostarcza 6 inputów kontekstowych: datę startu (jako proxy pory roku i warunków), styl noclegu (hotel / namiot / hamak / bivy bag / schronisko), filozofię jazdy (fast&light lub oblężniczą), kraj/region podróży, oraz czas/długość trasy. Na tej podstawie aplikacja generuje checklistę ekwipunku, gdzie każdy element wynika z co najmniej jednego dopasowanego kontekstu.

Reguły sztywne są nadrzędne wobec sugestii kontekstowych: określone kombinacje kontekstu wykluczają lub wymuszają konkretne elementy bezwzględnie (np. nocleg w schronisku → liner do śpiwora zamiast śpiwora; region z dziką fauną → odpowiedni odstraszacz). Sugestie kontekstowe wypełniają przestrzeń poza regułami sztywnymi. Użytkownik zawsze widzi, że lista może być niekompletna — aplikacja nigdy nie prezentuje jej jako definitywnej.

## Access Control

Wieloużytkownikowa aplikacja webowa. Dostęp wyłącznie dla zalogowanych użytkowników.

- **Rejestracja**: email + hasło; weryfikacja adresu e-mail wysyłana automatycznie, ale nie blokuje dostępu — użytkownik widzi baner z prośbą o weryfikację i ma pełny dostęp.
- **Logowanie**: email + hasło; reset hasła przez e-mail (FR-003, nice-to-have).
- **Model ról**: płaski — jeden typ użytkownika. Każdy zalogowany użytkownik widzi i edytuje wyłącznie własne plany podróży.
- **Niezalogowany użytkownik** trafiający na chroniony zasób jest przekierowany na stronę logowania.
- **Profil**: zmiana danych (nazwa wyświetlana, zmiana hasła) dostępna dla właściciela konta. Avatar użytkownika jest poza scope MVP — zob. Non-Goals i Open Questions #1.

Brak roli administratora w MVP.

## Non-Goals

- **Natywna aplikacja mobilna** — responsywna strona webowa jest w scope; instalowalna aplikacja iOS/Android jest poza scope v1.
- **Udostępnianie planów innym użytkownikom** — plany są prywatne w v1; brak publicznych profili, share linków, współpracy.
- **Przeliczanie łącznej wagi ekwipunku** — aplikacja rekomenduje co zabrać, ale nie agreguje wagi zestawu.
- **Reguły lotu samolotem (zakazy przewozowe)** — dedykowana logika "lot = zakaz kuchenek gazowych/aerozoli" jest poza scope v1; trafia do v2. *(Decyzja Sokratejska: uświadomiona, zaakceptowana.)*
- **Zewnętrzne API pogody real-time** — proxy pory roku + terenu zamiast rzeczywistej prognozy; integracja z zewnętrznym API pogody trafia do v2.
- **Eksport planów (PDF/XLS/DOC)** — plany żyją wyłącznie w aplikacji; brak eksportu do zewnętrznych formatów.
- **Pamiętnik podróży / mini blog** — zapisywanie wspomnień, zdjęć, notatek z trasy jest odrębną funkcjonalnością poza scope.
- **Avatar użytkownika** — wycięty ze scope v1 per decyzja shaping; edycja profilu obejmuje wyłącznie nazwę wyświetlaną i zmianę hasła.
- **Offline access** — aplikacja wymaga połączenia z siecią; dostęp bez internetu (tereny bez zasięgu) jest poza scope v1.

## Open Questions

1. **Niespójność: avatar profilu** — Frontmatter `gray_areas_resolved` w shape-notes wycina avatar użytkownika ze scope MVP; FR-004 nie wymienia avatara. Oryginalna sekcja Access Control w shape-notes wzmiankuje jednak "avatar" przy edycji profilu. PRD rozstrzyga: avatar poza scope v1 (per FR-004 i `gray_areas_resolved`), co wymaga potwierdzenia. — Właściciel: Marcin. Blokuje: nie (PRD przyjmuje wersję bez avatara; dostosowanie Access Control i Non-Goals w prd.md jeśli decyzja inna).
