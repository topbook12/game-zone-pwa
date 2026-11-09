# 🎮 Game Zone — Offline-Ready PWA Game Hub

A **cost-effective, offline-first game platform** (PWA) built with Next.js 16 + TypeScript.
Install it on Android from the browser — it runs **fully offline** after the first load,
scores are saved on-device, and a tiny global leaderboard syncs through a serverless API.

**Games included:** 🏎️ Turbo Rush (pseudo-3D racing) · 🧠 Brain Quiz (6 categories)

---

## 🚀 Deploy to Vercel (5 minutes, free)

1. **Import the repo on Vercel**
   - Go to [vercel.com/new](https://vercel.com/new) → sign in with GitHub → pick this repo.
   - Framework preset: **Next.js** (auto-detected). Build command and output are auto — no changes needed.

2. **Add 2 environment variables** (Project → Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `TURSO_DATABASE_URL` | `libsql://game-topu11111.aws-ap-south-1.turso.io` |
   | `TURSO_AUTH_TOKEN` | *(the Turso token you created — keep it secret)* |

3. **(Recommended) Set function region** — Project → Settings → Functions → Region: **Mumbai (bom1)**.
   Your Turso DB lives in `aws-ap-south-1` (Mumbai), so this gives the lowest latency for
   Bangladesh players and faster DB round-trips.

4. Click **Deploy**. Done — your PWA is live at `https://your-app.vercel.app`.

> The database tables are already created. If you ever use a **new** Turso database, run `bun run db:init` locally once (with the same env vars in `.env.local`).

### Manual test after deploy (Android)

1. Open the site in Chrome → tap **Install** (or menu ⋮ → *Add to Home screen*).
2. Launch from the home screen → the app opens fullscreen like a native app.
3. Turn on airplane mode → open the app → **games still work**, scores save locally.
4. Go back online → queued scores sync to the global leaderboard automatically.

---

## 💰 Cost architecture (designed to stay ~$0)

| Layer | Choice | Why it's cheap |
|---|---|---|
| Game logic | 100% client-side Canvas + React | Zero server compute, zero bandwidth after first load (SW cache) |
| App shell | Next.js static shell + Service Worker | Repeat visits/offline = **0 bytes** from server |
| Leaderboard reads | Vercel edge cache (`s-maxage=30, stale-while-revalidate`) | Almost no read hits the database |
| Leaderboard writes | 1 tiny INSERT per game-over | µs-scale, effectively free on Turso free tier |
| Database | Turso (libSQL) free tier | 9 GB storage, billions of row reads/month — far more than needed |
| Hosting | Vercel Hobby | Free for non-commercial, generous static + function limits |
| Audio | Web Audio API synthesis | No audio files to download |

**Player-side:** after the first visit, the Service Worker serves everything from cache.
A returning player can play an entire session offline using ~0 data.

**Scalability path:** Turso free tier comfortably handles millions of score rows.
When ads/coins arrive (see ROADMAP), add tables — no infrastructure change needed.

---

## 🗂 Project structure

```
src/
  app/
    page.tsx              # Entry → <GameHub/>
    api/scores/route.ts   # The ONLY API: leaderboard GET/POST
  components/
    game-hub.tsx          # Home: game cards, stats, install button
    racing-game.tsx       # Turbo Rush UI (HUD, controls, overlays)
    quiz-game.tsx         # Brain Quiz UI
    leaderboard.tsx       # Global top-10 dialog (offline-cached)
    install-prompt.tsx    # Android "Install app" button
    pwa-register.tsx      # SW registration + score sync init
  lib/
    racing/engine.ts      # Pseudo-3D racing engine (segments, physics, AI)
    racing/sprites.ts     # Cars/billboards drawn procedurally (no image assets)
    racing/audio.ts       # Web Audio synthesized engine/SFX (no audio files)
    quiz-questions.ts     # English question bank (bundled = offline)
    leaderboard.ts        # Offline-first score sync (queue + cache)
    game-store.ts         # localStorage reactive store
    turso.ts              # Server-only Turso client
public/
  manifest.json           # PWA manifest (installable, standalone)
  sw.js                   # Service Worker (offline shell + strategies)
  icons/                  # PWA icons (192/512/maskable/apple/favicon)
scripts/
  init-turso.ts           # One-time DB bootstrap (bun run db:init)
```

## 🛠 Local development

```bash
bun install
cp .env.example .env.local   # fill in your Turso URL + token
bun run dev                  # http://localhost:3000
bun run lint                 # ESLint
bun run db:init              # create leaderboard tables (new DBs only)
```

## 🔐 Security notes (later, by design)

- The Turso token lives only in environment variables — never in the repo.
- Score anti-cheat (server-side plausibility checks, per-device rate limits) is
  planned as a later phase; the current schema keeps `device_id` per row so
  checks can be added without migration.
