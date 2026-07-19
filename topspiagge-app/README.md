# Top Spiagge

App gestionale per stabilimenti balneari (iOS/Android/Web), costruita con Expo + React Native + TypeScript. Un unico codebase gira su iPhone, Android e browser.

## Moduli

- **Piantina** — mappa dello stabilimento con drag & drop per spostare prenotazioni tra ombrelloni.
- **Griglia** — vista compatta a matrice di tutti gli ombrelloni, filtrabile per fila e stato.
- **Quadro** — planning stagionale: griglia ombrelloni × giorni, tocca una cella libera per prenotare.
- **Conto** — cassa: catalogo articoli, acconti/saldo, split del conto, metodi di pagamento, emissione documento (simulata).
- **Statistiche** — incassi giornalieri/stagionali, grafico a barre, confronto storico, export CSV.
- **Archivi** — listini stagionali, CRM clienti, catalogo articoli/servizi.

Dati demo generati in memoria e persistiti su `AsyncStorage` (nessun backend reale).

## Avvio

```bash
npm install
npm run start   # Expo Dev Tools — scansiona il QR con Expo Go su iPhone/Android
npm run ios     # richiede macOS
npm run android
npm run web
```
