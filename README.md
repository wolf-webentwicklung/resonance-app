# Resona

A private web app for two people to feel each other without words.

**Live:** https://resona-app.com

---

## Deploy (one-time setup)

### 1. Supabase SQL Editor (run in order, once)

1. `supabase-schema.sql` — base tables
2. `supabase-migration.sql` — proposals, artwork reset, dissolve cleanup, realtime
3. `supabase-migration-2.sql` — still-here + nudge event types
4. `supabase-cleanup.sql` — wipes all data for a fresh start (optional)

### 2. Supabase Config

- Enable **Anonymous Sign-Ins** (Authentication → Providers)
- Enable **Email Provider** (Authentication → Providers → Email)
- Set **Site URL** to `https://resona-app.com`
- Add `https://resona-app.com` to **Redirect URLs** (Authentication → URL Configuration)
- Update `src/lib/supabase.js` with your `SUPABASE_URL` and `SUPABASE_KEY`

### 3. Upload

Everything in `dist/` → web root.

Future updates: only push code changes. No more SQL needed.

---

## Local Dev

```bash
npm install
npm run dev        # localhost:5173
npm run build      # → dist/
```

---

## Features

### Welcome Screen
Animated background with subtle ghost traces in emotional tone colors. Two options:
- **BEGIN** — start as new user (guest mode)
- **already have an account?** — sign in with email (magic link)

### Onboarding
3 screens after BEGIN:
1. *draw what you feel*
2. *your person discovers it*
3. *something grows between you*

### Account
- **Guest Mode** (default): anonymous login, account tied to device
- **Email** (optional): Settings → "Secure with Email" → magic link → account is permanent
- **Sign In**: Welcome screen → "already have an account?" → enter email → magic link → returns to existing pair
- Warning shown for guests: "your account is tied to this device"

### Pairing
- Create invite → share code or **"INVITE YOUR PERSON"** button (Web Share API)
- Tap code to copy
- Link format: `resona-app.com/?code=ABC123` — auto-fills on open
- Partner enters code → connected

### Traces
Choose tone (Nearness, Longing, Tension, Warmth, Playfulness) → draw gesture → sent to partner → partner discovers it → hold to reveal → glimpse of shared artwork.

**Tone Preview**: selecting a tone plays a short characteristic sound and flashes the screen in the tone's color before entering the drawing canvas.

### Discovery
Touch the space, move slowly. Proximity feedback in 4 zones:
- Far: faint haze
- Medium: glow + orbiting particles
- Close: strong pull, connection line
- Found: hold ring, haptic buzz

**Tone-based variation**:
- Nearness: larger search radius, easier to find
- Warmth: normal difficulty
- Playfulness: reveal point slowly drifts — you follow it
- Longing: smaller radius, harder
- Tension: smallest radius, hardest to find

### Resona Moments
Max 1 per reveal. 5-hour cooldown. Priority decides.

| Moment | Condition | Action |
|--------|-----------|--------|
| Twin Connection | Both sent within 15 min | Whisper word → partner receives it |
| Trace Convergence | Paths overlap >55% | Echo mark → partner sees it |
| Amplified Reveal | Gesture >3s, >8 dir changes | Automatic — longer reveal, deeper echo |

Words rotate from pool of 25. Marks rotate from pool of 15. Fresh selection each time.

### Sound & Haptics
Sounds (Web Audio API): found, reveal, moment, sent, incoming, artwork reveal, still-here, nudge, 5 tone previews.
Haptic feedback on proximity, hold, reveal, moments, send.

### Shared Artwork
Every trace adds to an invisible shared artwork. Uses temporal layering (older traces more diffuse, newer sharper) with composition offsets for organic growth. Only visible during brief glimpses after reveals, or during a full artwork reveal.

### Presence & Idle State
- Warm dot + "here" when partner is online
- Partner presence subtly warms the space and makes particles drift toward center
- Day counter since pairing
- **Residue echoes**: last 3 revealed traces remain as drifting ghosts (30 min / 60 min / 120 min)
- **Epoch progression**: space color gradually shifts warmer over weeks as trace count grows

### Still Here
When idle with nothing to send: hold the presence dot for 2 seconds → sends a soft light pulse to your partner's space ("your person is here"). Max once every 4 hours.

### Nudge
When your trace has been undiscovered for 2+ hours: "send a gentle reminder" appears. Tap → partner gets a notification ("your person is waiting"). Max once per undiscovered trace.

### Milestones
Silent, one-time text moments at trace counts 1, 10, 25, 50, 100 — e.g. "the first mark", "something is growing".

### Reunion
Settings → Plan a Reunion → pick date → partner accepts → artwork revealed on that day (20s animation).

### Reveal Artwork
Settings → Reveal Artwork → confirm → partner accepts → full reveal. Both see it independently.

### Start Fresh
Settings → Start Fresh → confirm → partner accepts → all artwork cleared. New chapter.

### Save Artwork
Settings → Save Artwork as Image → downloads 1080×1080 PNG with enhanced rendering.

### Dissolve
Settings → Dissolve Connection → all data deleted → partner notified in real-time.

### PWA
Installable (Android native prompt, iOS share sheet instructions). Browser notifications for background traces and nudges. Safe-area support.

---

## File Structure

```
resona/
├── src/
│   ├── App.jsx              All screens and components
│   ├── index.css            Animations
│   ├── main.jsx             Entry point
│   └── lib/
│       ├── audio.js         Web Audio sounds (incl. tone previews)
│       ├── constants.js     Tones, pools, config, drawArtwork, epochs
│       ├── haptics.js       Vibration feedback
│       ├── moments.js       Moment detection + cooldown
│       └── supabase.js      DB, auth, email, realtime, proposals, nudge
├── public/                  PWA assets
├── dist/                    Production build (deploy this)
├── supabase-schema.sql      Base schema (run once)
├── supabase-migration.sql   Migration 1 (run once)
├── supabase-migration-2.sql Migration 2: still-here + nudge (run once)
└── supabase-cleanup.sql     Reset all data (optional)
```

---

## Security

- Row Level Security on all tables
- Rate limit: 5 traces/day, 1 undiscovered max (DB function)
- Invite codes expire after 24h
- Artwork reset runs server-side (security definer)
- Anonymous auth + optional email linking + email sign-in (magic link)
- Publishable key safe with RLS

---

## Database Tables

| Table | Purpose |
|-------|---------|
| users | Auth rows (pair_id, push_token) |
| pairs | Connections (invite_code, status) |
| traces | Gestures (tone, position, discovery) |
| resonance_events | Moments, still-here, nudge events |
| artwork_contributions | Gesture paths for shared artwork |
| pair_proposals | Reunions, reveals, resets |
