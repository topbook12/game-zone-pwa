# 🎮 Game Zone — Offline-Ready PWA Game Hub

A **cost-effective, offline-first game platform** (PWA) built with Next.js 16 + TypeScript.
Install it on Android from the browser — it runs **fully offline** after the first load,
scores are saved on-device, and a tiny global leaderboard syncs through a serverless API.

**Games included:** 🏎️ Turbo Rush (pseudo-3D racing, seeded daily circuits) · 🧠 Brain Quiz (9 categories, 90+ questions) · 🎯 2048 Fusion · 🐍 Snake Neon

**v2.0 highlights (Day 11–25):** 2 new games (2048 + Snake Neon) · Daily Challenge (date-seeded quiz + circuit, streaks) ·
14 achievements with progress + toasts · racing mobile overhaul (hold-left/right-half steering, optional tilt steering, bigger pads) ·
racing premium visuals (procedural tracks, skyline/stars/birds, headlight cone, tail lights, nitro tint) ·
EN/বাংলা toggle · offline score queue · SW update card · compressed assets (icon-512 250→66 KB, banners < 55 KB).

**v2.1 highlights (Day 26–45, Phase 3 — social & competition):**
- 🏆 **Weekly tournaments** — every game has a "This week" leaderboard that resets Monday 00:00 UTC; the weekly #1 gets a 👑 crown and a *Weekly champion* badge
- 👤 **Player profile card** — emoji avatar picker (16 options), plays / badges / weekly-win stats, personal bests, all stored on-device
- 📤 **Share button** — every game-over screen and the profile share via the Web Share API ("I scored X, can you beat me? 🎮"), clipboard fallback on desktop
- 🔗 **Referral deep links** — profile shows your personal `?ref=code` invite link; friends who open it are counted (one per device, edge-cached counter)
- 🔔 **Daily reminder (Web Push)** — opt-in button on the Daily Challenge card; free VAPID push sent daily at ~7 PM local time via Vercel cron
- 🛡 **Anti-cheat pass #1** — server-side plausibility caps per game + per-device play-speed floor on live submissions (offline-flushed scores are never punished)
- Full EN/বাংলা for every new string · SW v8 with push + notification-click handling

---

## 🚀 Deploy to Vercel (5 minutes, free)

1. **Import the repo on Vercel**
   - Go to [vercel.com/new](https://vercel.com/new) → sign in with GitHub → pick this repo.
   - Framework preset: **Next.js** (auto-detected). Build command and output are auto — no changes needed.

2. **Add environment variables** (Project → Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `TURSO_DATABASE_URL` | `libsql://game-topu11111.aws-ap-south-1.turso.io` |
   | `TURSO_AUTH_TOKEN` | *(the Turso token you created — keep it secret)* |
   | `VAPID_PUBLIC_KEY` | *(public key from `bunx web-push generate-vapid-keys` — one pair works for dev + prod)* |
   | `VAPID_PRIVATE_KEY` | *(matching private key — keep it secret)* |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | *(same public key — needed by the browser to subscribe)* |
   | `CRON_SECRET` | *(any random string — protects the daily push cron endpoint)* |

3. **(Recommended) Set function region** — Project → Settings → Functions → Region: **Mumbai (bom1)**.
   Your Turso DB lives in `aws-ap-south-1` (Mumbai), so this gives the lowest latency for
   Bangladesh players and faster DB round-trips.

4. Click **Deploy**. Done — your PWA is live at `https://your-app.vercel.app`.

> The database tables are already created. If you ever use a **new** Turso database, run `bun run db:init` locally once (with the same env vars in `.env.local`) — it creates the `scores`, `referrals` and `push_subs` tables.
> The daily push cron is registered in `vercel.json` (once a day, 13:00 UTC) — Vercel Hobby includes it free.

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
    api/scores/route.ts   # Leaderboard GET (weekly/all) + POST with anti-cheat
    api/referral/route.ts # ?ref= invite counter (POST once/device, GET count)
    api/push/subscribe/   # Web Push subscription registry (POST/DELETE)
    api/push/daily/       # Cron target: sends the daily reminder push
  components/
    game-hub.tsx          # Home: game cards, stats, install button
    racing-game.tsx       # Turbo Rush UI (HUD, controls, overlays)
    quiz-game.tsx         # Brain Quiz UI
    leaderboard.tsx       # Weekly + all-time top-10 dialog (offline-cached)
    profile-dialog.tsx    # Avatar, stats, crowns, invite link
    share-button.tsx      # Web Share API button (clipboard fallback)
    push-reminder-button.tsx # Daily reminder opt-in toggle
    install-prompt.tsx    # Android "Install app" button
    pwa-register.tsx      # SW registration + score sync init
  lib/
    racing/engine.ts      # Pseudo-3D racing engine (segments, physics, AI)
    racing/sprites.ts     # Cars/billboards drawn procedurally (no image assets)
    racing/audio.ts       # Web Audio synthesized engine/SFX (no audio files)
    quiz-questions.ts     # English question bank (bundled = offline)
    leaderboard.ts        # Offline-first score sync (queue + cache)
    profile.ts            # Avatar, referral code, weekly crowns
    share.ts              # Web Share helpers
    push.ts               # Push opt-in/subscribe client
    tournament.ts         # ISO week helpers (shared client/server)
    game-store.ts         # localStorage reactive store
    turso.ts              # Server-only Turso client
public/
  manifest.json           # PWA manifest (installable, standalone)
  sw.js                   # Service Worker (offline shell + push handlers)
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

## 🔐 Security notes

- The Turso token, VAPID private key and CRON secret live only in environment variables — never in the repo.
- Anti-cheat pass #1 (Phase 3): per-game plausibility caps (422) + per-device live play-speed floor (429) on `POST /api/scores`; offline-flushed scores carry their original timestamp and skip the speed floor.
- The daily push cron endpoint requires `Authorization: Bearer $CRON_SECRET` (set automatically by Vercel when the env var exists).
