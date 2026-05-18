# Bikepackr - Każdy gram to decyzja

## Główny problem

Bikepacking to sztuka podróżowania na rowerze. Nie ważne czy jedziemy w krótką podróż - 
na jedną noc do lasu (overnight), czy na tripa dookoła świata - potrzebujemy zaplanować
co ze sobą zabierzemy i jak to zabierzemy. 

Nawet osoby doświadczone potrafią zapomnieć o istotnych elementach ekwipunku.
Osoby niedoświadczone często nie mają świadomości, że każdy gram ma znaczenie, a bikepacking 
to sztuka kompromisów. Im lżej, tym większa radość z czystej jazdy na rowerze.

Sam Bikepacking ma różne filozofie:
- forma oblężniczą - kiedy nie idziemy na kompromisy, waga nie ma dla nas takiego znaczenia
- fast&light - kiedy liczymy każdy gram, jesteśmy w stanie przeżyć z jedną parą spodenek kolarskich.

Celem aplikacji jest zebranie od użytkownika istotnych informacji, takich jak:
- czy lecisz samolotem na początek podróży?
- kiedy rozpoczynasz swoją podróż?
- czy masz zaplanowany ślad GPX?
- jak długa jest Twoja trasa?
- czy planujesz spać w hotelach (credit card bikepacking), czy chcesz zabrać własny 
system do nocowania?

Lista tych pytań może zmieniać się z czasem - jej źródłem będą doświadczeni bikepackerzy,
dzielący się swoim know how.

Następnie na podstawie odpowiedzi na te pytania system wygeneruje użytkownikowi checklisty ze sprzętem,
który powinien zabrać, przewidywaną wagę takiego zestawu, oraz praktyczne porady dotyczące podróży.

Przykładowo - jeśli użytkownik leci samolotem - nie może zabrać do niego kuchenki gazowej.
Jeśli trasa przebiega przez tereny górzyste - trzeba być przygotowanym na zmienne warunki pogodowe (np. niezbędna jest kurtka puchowa).

Jeśli podróżujemy po krajach takich jak Rumunia - koniecznym może okazać się gwizdek odstraszający 
niedźwiedzie czy gaz na dzikie psy pasterskie.

Jeśli śpimy w schroniskach górskich - powinniśmy zabrać liner do śpiwora, jeśli natomiast decydujemy
się na spanie pod chmurką - musimy zdecydować się na jeden z popularnych setupów - hamak, namiot czy bivy bag.


## Najmniejszy zestaw funkcjonalności

- Aplikacja Webowa w stacku technologicznym - next.js + typescript
- Rejestracja i logowanie do aplikacji wraz z podstawowymi funkcjonalnościami (edycja profilu, zapomniałem hasła, wgrywanie avatara)
- Tworzenie własnych planów podróży:
  - **Konfiguracja planu** - za pośrednictwem ankiety system zbiera informacje na temat podróży
  - **Generowanie planu**:
    - Na podstawie odpowiedzi na ankietę generowana jest checklista z ekwipunkiem do zabrania oraz czynnościami do wykonania
  - **Edycja planu** - użytkownik może edytować plan w formie checklisty - usuwać to, co uzna za zbędne, dodać do, czego nie przewidziała aplikacja
  - **Ocenianie planu** - użytkownik może ocenić wygenerowany plan podróży w skali od 1 do 6.
- Generator planu działa we współpracy z AI, w oparciu m.in. o:
  - sztywne reguły opisane w regułach - np. jeśli podróż samolotem - zakaz zabrania kuchenki gazowej - zaproponuj alkoholową
  - prognoza pogody - np. jeśli w regionie zapowiadane są upały, brak wahań temperatury - nie proponuj zabierania kurtki puchowej, rękawiczek czy czapki
- Użytkownik może w każdym momencie wrócić do swojego planu, np. w trakcie podróży zweryfikować ekwipunek, który zabrał

## Co nie wchodzi w zakres MVP

- Aplikacja mobilna
- Możliwość udostępniania innym swoich planów podróży
- Przeliczanie wagi naszego ekwipunku
- Porady dotyczące podróży w dany region
- Eksport planów do PDF, XLS czy DOC.
- Tworzenie pamiętnika podróży w formie mini bloga

## Kryteria sukcesu

- 75% stworzonych planów zyskuje oceny minimum 4 na 6.