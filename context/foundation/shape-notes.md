---
project: "Bikepackr"
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
created: 2026-05-18
updated: 2026-05-18  # finalized
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "primary persona"
      decision: "nowicjusze i osoby z małym doświadczeniem bikepacking"
    - topic: "filozofia jazdy"
      decision: "neutralna — użytkownik deklaruje podejście (fast&light vs oblężnicza) w ankiecie, aplikacja dostosowuje propozycje"
    - topic: "metoda auth"
      decision: "email + hasło klasyczne (rejestracja, weryfikacja, reset hasła)"
    - topic: "model ról"
      decision: "płaski — jeden typ użytkownika; każdy widzi tylko swoje plany; brak admina w MVP"
    - topic: "scope MVP v1"
      decision: "wycięte: avatar użytkownika, prognoza pogody (zewnętrzne API); zachowane: edycja checklisty, ocenianie planów"
    - topic: "timeline"
      decision: "5-6 tygodni po godzinach"
  frs_drafted: 11
  quality_check_status: accepted
---

## Quality cross-check

Cross-check przeprowadzony 2026-05-18. Status: **accepted**. Wszystkie 5 elementów greenfield obecne:
- Access Control: present
- Business Logic (one-sentence rule): present
- Project artifacts: present
- Timeline-cost acknowledged: present (6 tygodni, świadoma akceptacja)
- Non-Goals: present (7 wpisów)

---

## Non-Goals

- **Natywna aplikacja mobilna** — responsywna strona webowa jest w scope; instalowalna aplikacja iOS/Android jest poza scope v1.
- **Udostępnianie planów innym użytkownikom** — plany są prywatne w v1; brak publicznych profili, share linków, współpracy.
- **Przeliczanie łącznej wagi ekwipunku** — aplikacja rekomenduje co zabrać, ale nie agreguje wagi zestawu.
- **Reguły lotu samolotem (zakazy przewozowe)** — dedykowana logika "lot = zakaz kuchenek gazowych/aerozoli" jest poza scope v1; trafia do v2. *(Decyzja Sokratejska: uświadomiona, zaakceptowana.)*
- **Zewnętrzne API pogody real-time** — proxy pory roku + terenu zamiast rzeczywistej prognozy; integracja z API pogody trafia do v2.
- **Eksport planów (PDF/XLS/DOC)** — plany żyją wyłącznie w aplikacji; brak eksportu do zewnętrznych formatów.
- **Pamiętnik podróży / mini blog** — zapisywanie wspomnień, zdjęć, notatek z trasy jest odrębną funkcjonalnością poza scope.

---

## Timeline acknowledgment

Acknowledged on 2026-05-18: 6-tygodniowy MVP po godzinach pracy wymaga sustained dedication; użytkownik świadomie zaakceptował ten timeline po dwuetapowym scope-down (wycięcie avatara i zewnętrznego API pogody). Zakres jest mniejszy niż w seedzie, ale wciąż powyżej 3-tygodniowego standardu.

---

## Forward: tech-stack

*(Uwaga: ta sekcja nie jest częścią PRD. Zawiera forward notes dla 10x-tech-stack-selector.)*

- Seed wskazuje preferencję: **Next.js + TypeScript** jako stos frontendowy. Decyzja o frameworku i bazie danych należy do etapu doboru stosu, nie PRD.
- Integracja z AI provider wymagana dla FR-006 (generator planu). Konkretny provider to decyzja techniczna.

---

## Vision & Problem Statement

Bikepacking — podróżowanie na rowerze z własnym ekwipunkiem — wymaga planowania zestawu gear przed każdym wyjazdem. Nawet doświadczeni bikepackerzy potrafią zapomnieć o kluczowych elementach; nowicjusze często nie mają świadomości, że każdy gram ma znaczenie i że bikepacking to sztuka kompromisów. Brak narzędzia, które uwzględni kontekst konkretnej podróży (lot samolotem, pogoda, teren, styl noclegu), powoduje wyjazdy z zapomniętym sprzętem lub z przeciążonym rowerem.

Wiedza o tym, co zabrać w danym kontekście, istnieje — pochodzi od doświadczonych bikepackerów — ale jest rozproszona i trudno dostępna dla początkujących. Bikepackr enkoduje tę wiedzę jako zestaw reguł i udostępnia ją każdemu, kto planuje wyjazd, w formie spersonalizowanej checklisty generowanej na podstawie odpowiedzi na ankietę kontekstową.

## User & Persona

### Primary persona

**Marta, 28 lat, pasjonatka jazdy na rowerze z ambicjami bikepackingowymi.**

Marta jeździ rekreacyjnie od kilku lat, ale dopiero zaczyna myśleć o dłuższych wyjazdach bikepacking. Planuje pierwszy overnight — jedną noc w lesie. Nie wie od czego zacząć: co zabrać, jak to spakować, ile to ważyć. Kiedy szuka informacji w internecie, napotyka ogólne listy, które nie uwzględniają jej konkretnego kontekstu (pogody, stylu noclegu, czy podróży samolotem). Sięga po Bikepackr w momencie, gdy siada do planowania wyjazdu — zazwyczaj kilka dni lub tygodnie przed wyruszeniem.

## Access Control

Wieloużytkownikowa aplikacja webowa. Dostęp wyłącznie dla zalogowanych użytkowników.

- **Rejestracja**: email + hasło; weryfikacja adresu e-mail wymagana przed pierwszym logowaniem.
- **Logowanie**: email + hasło; reset hasła przez e-mail.
- **Model ról**: płaski — jeden typ użytkownika. Każdy zalogowany użytkownik widzi i edytuje wyłącznie własne plany podróży.
- **Niezalogowany użytkownik** trafiający na chroniony zasób jest przekierowany na stronę logowania.
- **Profil**: zmiana danych (nazwa, avatar, hasło) dostępna dla właściciela konta.

Brak roli administratora w MVP.

## Success Criteria

### Primary

- 75% stworzonych planów podróży otrzymuje od użytkownika ocenę ≥ 4 w skali 1–6.
  *(Mierzone: suma ocen ≥ 4 / liczba ocenionych planów × 100%)*

### Secondary

- Użytkownik aktywnie wraca do swojego planu w aplikacji podczas trwania podróży (otwiera plan co najmniej raz po dacie startowej wyjazdu) — wskaźnik realnej przydatności w terenie.

### Guardrails

- Plany użytkownika są widoczne wyłącznie dla niego. Nieautoryzowany dostęp do cudzego planu jest niemożliwy.
- Aplikacja działa poprawnie na aktualnych wersjach Chrome, Firefox i Safari (desktop).

---

## Business Logic

Na podstawie kontekstu podróży aplikacja rekomenduje minimalny bezpieczny zestaw gear, który użytkownik powinien zabrać.

Użytkownik dostarcza 6 inputów kontekstowych: datę startu (jako proxy pory roku i warunków), styl noclegu (hotel / namiot / hamak / bivy bag / schronisko), filozofię jazdy (fast&light lub oblężniczą), kraj/region podróży, oraz czas/długość trasy. Na tej podstawie aplikacja generuje cheklistę ekwipunku, gdzie każdy element wynika z co najmniej jednego dopasowanego kontekstu.

Reguły sztywne są nadrzędne wobec rekomendacji AI: określone kombinacje kontekstu wykluczają lub wymuszają konkretne elementy bezwzględnie (np. nocleg w schronisku → liner do śpiwora zamiast śpiwora; region z dziką fauną → odpowiedni odstraszacz). AI wypełnia przestrzeń poza regułami sztywnymi, generując kontekstowe sugestie. Użytkownik zawsze widzi, że lista pochodzi z AI i może być niekompletna — aplikacja nigdy nie prezentuje jej jako definitywnej.

## Non-Functional Requirements

- Plany użytkownika są widoczne wyłącznie dla niego. Nieautoryzowany dostęp do cudzego planu jest niemożliwy przy poprawnym uwierzytelnieniu.
- Aplikacja zawsze informuje użytkownika, że wygenerowana lista pochodzi z AI i może być niepełna — nigdy nie prezentuje jej jako pełnej ani definitywnej.
- Aplikacja działa poprawnie na aktualnych wersjach Chrome, Firefox i Safari (desktop i mobile — responsywny layout). *(Uwaga: natywna aplikacja mobilna jest non-goal; responsywność webowa to nie to samo.)*
- Generowanie planu: użytkownik widzi ciągły postęp wizualny podczas każdej operacji trwającej > 2 sekundy; wynik pojawia się w czasie < 30 sekund od submitu kontekstu.

---

## User Stories

### US-01: Użytkownik planuje wyjazd i otrzymuje spersonalizowaną cheklistę

- **Given** zalogowany użytkownik, który nie ma jeszcze planu na nadchodzący wyjazd
- **When** wypełnia ankietę kontekstową (styl podróży, nocleg, lot samolotem, teren, daty)
- **Then** widzi wygenerowaną cheklistę ekwipunku i czynności, dopasowaną do kontekstu wyjazdu

#### Acceptance Criteria

- Reguły sztywne są bezwzględne: np. jeśli użytkownik zaznaczył lot samolotem — kuchenka gazowa nie pojawia się na liście.
- Checklista zawiera co najmniej 1 pozycję; brak czystego empty-state bez wyjaśnienia.
- Filozofia jazdy (fast&light vs oblężnicza) wpływa na proponowany zestaw — wyniki są różne dla różnych deklaracji.
- Generator zawsze zwraca wynik lub czytelną informację o błędzie; generowanie nigdy nie kończy się milczącą awarią.

---

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
- FR-006: System generuje cheklistę ekwipunku i czynności na podstawie kontekstu podróży (AI + reguły sztywne, pora roku/teren jako proxy pogody). Priority: must-have
  > Socrates: Kontrargument rozważony: "halucynacje AI podcinają zaufanie jeśli lista jest absurdalna". Rozwiązanie: FR bez zmian; dodany NFR o przezroczystości AI (użytkownik zawsze wie, że lista pochodzi z AI i może być niepełna).
- FR-007: Użytkownik może edytować wygenerowaną cheklistę (dodawanie/usuwanie pozycji). Priority: must-have
  > Socrates: Brak kontrargumentu; edycja jest niezbędna — użytkownicy zawsze wiedzą coś, czego AI nie wie.
- FR-008: Użytkownik może zaznaczyć pozycję checklisty jako „spakowane". Priority: must-have
  > Socrates: Brak kontrargumentu; zaznaczanie jest must-have — kluczowy use case: weryfikacja ekwipunku w trakcie pakowania.
- FR-009: Użytkownik może wrócić do dowolnego swojego planu i przeglądać go w dowolnym momencie. Priority: must-have
  > Socrates: Brak kontrargumentu; persystencja planów to standard. Uwaga: offline access (tereny bez internetu) to oddzielna, świadoma decyzja techniczna.
- FR-011: Użytkownik może usunąć swój plan podróży. Priority: must-have
  > Socrates: Brak kontrargumentu; podstawowe zarządzanie danymi własnymi.

### Ocenianie

- FR-010: Użytkownik może ocenić wygenerowany plan w skali 1–6 w dwóch momentach: przed wyjazdem (ocena planu) i po powrocie (ocena realizacji) — obie opcjonalne. Priority: must-have
  > Socrates: Kontrargument rozważony: "ocena przed wyjazdem mierzy intencję, nie rezultat". Rozwiązanie: zmieniono FR — dwa etapy oceniania (przed/po), oba opcjonalne; post-trip ocena waliduje rzeczywistość.

---

### Secondary persona

Doświadczony bikepacker (nie jest targetem MVP), który wraca do aplikacji w trakcie podróży, żeby zweryfikować cheklistę. Obsługiwany przez tę samą funkcjonalność.

