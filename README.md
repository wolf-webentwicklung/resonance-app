# Resonance

Eine Web-App für zwei Nutzer, die eine asynchrone emotionale Verbindung über nonverbale „Traces" erzeugt.

**Live:** https://resonance.wolf-webentwicklung.de/

---

## Was ist Resonance?

Zwei Menschen sind exklusiv als Paar verbunden. Sie senden sich keine normalen Nachrichten, sondern **Traces** – Gesten mit emotionalem Ton, die der Partner auf einer dunklen Fläche (dem Resonance Space) suchen und entdecken muss. Jeder entdeckte Trace hinterlässt eine Spur in einem gemeinsamen, unsichtbaren Artwork, das nur in seltenen Momenten kurz sichtbar wird.

---

## Projektstruktur

```
resonance/
├── src/                    ← Quellcode
│   ├── main.jsx            ← Entry Point
│   ├── index.css           ← Globale Styles + Animationen
│   ├── App.jsx             ← Hauptkomponente (Welcome, Pairing, ResonanceSpace)
│   └── lib/
│       ├── constants.js    ← Tones, Utilities, Konfiguration
│       ├── supabase.js     ← Supabase Client, Auth, DB-Funktionen, Realtime
│       └── moments.js      ← Resonance Moment Detection (Cooldown, Priorität)
│
├── public/                 ← Statische Assets (werden beim Build nach dist/ kopiert)
│   ├── manifest.json       ← PWA-Manifest
│   ├── sw.js               ← Service Worker
│   ├── .htaccess           ← Apache SPA-Routing + Caching
│   ├── icon.svg            ← Favicon
│   ├── icon-192.png        ← PWA-Icon
│   ├── icon-512.png        ← PWA-Icon
│   └── apple-touch-icon.png
│
├── dist/                   ← Production Build (deployment-ready)
│
├── index.html              ← HTML-Template (Vite Entry)
├── package.json
├── vite.config.js
└── supabase-schema.sql     ← Datenbank-Schema (einmalig in Supabase ausführen)
```

---

## Tech Stack

- **Frontend:** React 18, Vite 5, Canvas API, Inline Styles
- **Backend:** Supabase (Auth, PostgreSQL, Realtime, RLS)
- **Hosting:** Apache mit SPA-Rewrite (.htaccess)
- **PWA:** manifest.json, Service Worker, App-Shell-Caching

---

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Öffnet auf `http://localhost:5173`.

### Build

```bash
npm run build
```

Output in `dist/`. Zum Deployen: alle Dateien aus `dist/` ins Web-Root hochladen.

---

## Supabase Setup

1. Neues Supabase-Projekt erstellen
2. **Authentication → Providers → Anonymous Sign-Ins → ON** aktivieren
3. SQL Editor → `supabase-schema.sql` komplett ausführen
4. In `src/lib/supabase.js` die `SUPABASE_URL` und `SUPABASE_KEY` anpassen
5. Unter **Realtime** sicherstellen, dass die Tables `traces`, `resonance_events`, `pairs` zur Publication gehören (wird vom Schema automatisch gemacht)

---

## Kernkonzepte

### Trace
Eine Nachricht besteht aus:
- **Emotional Tone** (Nearness, Longing, Tension, Warmth, Playfulness)
- **Geste** (freie Zeichnung auf Canvas)
- **Signal Type** (zufällig: Shimmer, Pulse, Drift, Flicker, Density, Wave)
- **Reveal Position** (zufällige Position im Space, wo der Partner suchen muss)

### Discovery
Der Partner sieht „SOMETHING IS HERE" und muss mit dem Finger die Fläche explorieren. Visuelles Feedback in 4 Proximity-Zonen. Bei Treffer: Hold-to-Reveal (1.5s).

### Reveal → Glimpse
Nach dem Reveal wird die Geste animiert angezeigt. Danach ein kurzer Glimpse auf das gesamte Shared Artwork (5 Sekunden, kreisförmig maskiert).

### Resonance Moments
Seltene, besondere Momente mit zusätzlicher Ausdrucksmöglichkeit:

| Typ | Bedingung | Aktion |
|-----|-----------|--------|
| **Twin Connection** | Beide haben innerhalb von 5 Minuten gesendet | Whisper-Wort wählen → Partner empfängt es |
| **Trace Convergence** | Pfade zweier Traces überlappen sich zu >55% | Echo-Mark (Glyph) wählen → Partner sieht es |
| **Amplified Reveal** | Eingehende Geste ist besonders intensiv (>3s, >8 Richtungswechsel) | Reaktions-Geste zeichnen → wird beim nächsten Reveal eingeblendet |

**Regeln:**
- Maximal 1 Moment pro Reveal
- Mindestens 8 Stunden Abstand zwischen Moments (konfigurierbar in `MOMENT_COOLDOWN_HOURS`)
- Priorität: Twin Connection > Trace Convergence > Amplified Reveal
- Moments werden in `resonance_events` gespeichert und per Realtime an den Partner gesendet

### Shared Artwork
Jeder gesendete Trace wird als Artwork-Contribution gespeichert. Das Artwork ist **nicht** dauerhaft sichtbar – es erscheint nur im Glimpse nach einem Reveal.

---

## Deployment

### Apache

Alle Dateien aus `dist/` ins Web-Root hochladen. Die `.htaccess` sorgt für:
- SPA-Routing (alle Requests → index.html)
- Korrekte MIME-Types
- Caching für statische Assets

### PWA

Nach dem Deployment ist die App über den Browser installierbar:
- Android: „Zum Startbildschirm hinzufügen"
- iOS: Safari → Teilen → „Zum Home-Bildschirm"

---

## Datenbank-Tabellen

| Tabelle | Zweck |
|---------|-------|
| `users` | Nutzer (anonyme Auth-ID, pair_id, push_token) |
| `pairs` | Paare (invite_code, status: pending/active/dissolved) |
| `traces` | Traces (Geste, Tone, Position, Signal, discovered_at) |
| `resonance_events` | Resonance Moments (Typ, Tone, extra_data mit Whisper/Echo/Pulse) |
| `artwork_contributions` | Artwork-Pfade pro Trace |

Alle Tabellen haben Row Level Security (RLS) aktiviert. Nutzer sehen nur Daten ihres eigenen Pairs.

---

## Changelog

### v1.1.0 (aktuell)

**Kritische Fixes:**
- Whisper / Echo / Pulse werden jetzt tatsächlich an den Partner gesendet (via `resonance_events` + Realtime)
- Neue `IncomingMomentDisplay`-Komponente zeigt Partner-Moments an
- Resonance Moments: Cooldown (8h), Prioritätslogik, maximal 1 pro Reveal
- Verschärfte Trigger-Bedingungen (Twin: 5min statt 30, Convergence: 55% statt 40%, Amplified: strenger)
- Artwork-Hintergrund entfernt – Artwork nur noch im Glimpse sichtbar

**PWA:**
- manifest.json, Service Worker, Icons (192px, 512px, SVG, Apple Touch)
- Homescreen-installierbar auf Android und iOS

**Stabilität:**
- Reconnection bei App-Rückkehr (visibilitychange)
- Error-Toasts bei Netzwerkfehlern
- Unseen Events werden beim Start und bei Rückkehr geprüft

**UX:**
- Passive Reveal wird 3s vorher angekündigt („revealing itself…")
- Leerer Idle-Zustand zeigt „waiting for your first trace"
- Whisper/Echo-Picker: klarere Beschreibung („choose a whisper for your person")

### v1.0.0

- Erster funktionsfähiger Prototyp
- Auth, Pairing, Trace-Lifecycle, Discovery, Reveal, Glimpse
- Canvas-Rendering mit Perlin Noise
- Resonance Moments (nur lokal, ohne Persistierung)
