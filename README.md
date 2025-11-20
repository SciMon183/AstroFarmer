# AstroFarmer

Interaktywny panel do monitorowania szklarni orbitalnej TechnoZOne. Projekt łączy dane z mikrokontrolera ESP oraz warstwę wizualną tworzoną w czystym HTML/CSS/JS. Panel automatycznie pobiera próbki z bazy, renderuje kafelki z ostatnimi odczytami i dokłada wykresy trendów w czasie rzeczywistym.

## Funkcje

- **Aktualne odczyty** – sekcja „Unikalne odczyty” pokazuje kluczowe czujniki (VOC, UV, ciśnienie, CO₂ itd.) wraz z etykietami stanu.
- **Wielopoziomowe pomiary** – „Podzielone piętra” prezentują dane z dwóch półek (temperatura, wilgotność, gleba) obok siebie.
- **Wykresy** – każdy kafelek ma osadzony wykres Chart.js bazujący na 48 ostatnich rekordach z API.
- **Automatyczne odświeżanie** – panel pobiera nowe dane co 5 minut i aktualizuje zarówno wartości, jak i wizualizacje.
- **Responsywny layout** – header centruje logotypy, a sekcje kart i pięter przechodzą w układy jedno-kolumnowe na urządzeniach mobilnych.

## Struktura

```
AstroFarmer/
├── web/
│   ├── index.html   # główny layout panelu
│   ├── main.css     # stylowanie + media queries
│   └── main.js      # logika pobierania danych i rysowania wykresów
└── img/             # logo i grafiki używane na stronie
```

## Uruchomienie lokalne

1. Otwórz katalog `web/` w ulubionym edytorze lub zainstaluj prosty serwer, np.:
   ```bash
   cd web
   python3 -m http.server 4173
   ```
2. Wejdź na `http://localhost:4173` i potwierdź, że dashboard ładuje się poprawnie.
3. Jeśli chcesz podłączyć prawdziwe dane, upewnij się, że API z mikrokontrolera działa pod `http://10.0.20.254:8000/readings`.

> **Uwaga:** gdy API jest niedostępne, panel korzysta z placeholderów, więc interfejs zawsze coś pokazuje.

## Dalszy rozwój

- Eksport CSV/Excel poza obecny JSON.
- Panel sterowania urządzeniami (np. oświetlenie, wentylacja).
- Tryb nocny/dzienny zsynchronizowany z zegarem w headerze.

Miłego hackowania! 
