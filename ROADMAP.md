# 🗺 Game Zone — 100-Day Product Roadmap

**Principle:** every phase must stay cost-effective (client-first, free tiers, no idle servers)
and ship *premium-feeling* features players love. One release per week is enough — quality > speed.

> Current status (Day 70): Racing v2 ✅ · Quiz v2 ✅ · 2048 ✅ · Snake ✅ · Daily challenge ✅ · Achievements ✅ · PWA offline ✅ · Global leaderboard ✅ · Vercel deploy ✅ · Phase 2 content ✅ · Phase 3 social ✅ (v2.1) · **Phase 4 monetization ✅ (v2.2)**

---

## Phase 1 — Foundation hardening (Day 1–10) ✅ DONE — shipped as v1.3
- [x] **Day 1–2:** Vercel deploy ready — vercel.json, Turso env wiring, 3-step guide in README
- [ ] **Day 1–2:** Custom domain — needs a purchased domain (manual, when ready)
- [ ] **Day 1–2:** PWA install test on 2–3 real Android devices (manual — guide in README)
- [x] **Day 3–4:** Offline audit — airplane-mode simulation passed: hub, both games, leaderboard cache, score queue auto-flush on reconnect
- [x] **Day 3–4:** SW update flow — waiting-worker detection + "New version — Refresh now" card (SKIP_WAITING, player stays in control)
- [x] **Day 4:** Offline indicator — amber "You are offline — games still work" banner
- [x] **Day 5:** Localized string file — full EN + বাংলা dictionaries (`src/lib/i18n.ts`), EN/বাংলা toggle in header, persists in localStorage
- [x] **Day 6–7:** Bug bash round 1 — fixed duplicate score flush on reconnect race, graceful 502 when DB env missing, `fmt` export build error
- [x] **Day 6–7:** `GameErrorBoundary` — a crashed game shows a friendly reload card instead of a white screen (low-end device safety)
- [x] **Day 8–10:** Privacy-friendly analytics — `@vercel/analytics`, page-view only, cookieless, Vercel free tier

**Milestone:** ✅ stable, installable, offline-proof v1.3 — ready for first real players.

## Phase 2 — Content & retention (Day 11–25) ✅ DONE — shipped as v2.0
- [x] Quiz question packs v2: Movies, Bangladesh GK, Math blitz added → **9 categories, 90+ questions** (bundle client-side = $0)
- [x] Daily challenge: date-seeded (mulberry32) — same 10 quiz questions AND same racing circuit (seeded track/hills/traffic) for every player, client-computed, offline-safe; streak counter + hub card with per-task checkmarks
- [x] Achievements: 14 badges (first play, play counts, racing 5k/20k, quiz 1000, 512/2048 tile, snake 200/500, daily streak 3/7, global top-10) with progress bars, sonner toasts on unlock, localStorage only
- [x] New game #1: **2048 Fusion** — swipe/keys, animated slides + merges, undo, win/keep-going, premium golden tiles
- [x] New game #2: **Snake Neon** — canvas glow snake, swipe + d-pad + keys, particles, speed levels, synthwave neon visuals
- [x] App assets: AI-generated 2048/Snake banners (37–53 KB), all banners → compressed JPG, icons recompressed (icon-512: 250 KB → 66 KB)
- [x] Racing v2 mobile pass: press-and-hold left/right half of screen steers, optional **tilt steering** (analog, persisted), bigger pads (84–88 px), analog steer input in engine
- [x] Racing v2 premium visuals: seeded procedural tracks (new every run), city skyline + stars + birds + lens streak, headlight cone, brake-light glow, traffic tail lights, reflective cat-eyes, nitro heat tint, speed-line boost

**Milestone:** ✅ daily-return habit loop (daily challenge + achievements) + 4-game hub shipped.

## Phase 3 — Social & competition (Day 26–45) ✅ DONE — shipped as v2.1
- [x] Weekly tournaments: "This week" / "All time" toggle per game, window resets Monday 00:00 UTC (`created_at >= weekStart`), weekly #1 gets 👑 crown in the list + *Weekly champion* title + a persistent weekly-wins counter on the profile
- [x] Player profile card: emoji avatar picker (16 options, header button shows your avatar), total plays, badges x/14, weekly wins, personal bests for all 4 games (all localStorage)
- [x] Share button: Web Share API on every game-over screen + profile — "I scored X in {game}! Can you beat me? 🎮" with clipboard fallback + toast, links carry the player's `?ref=` code (free viral loop)
- [x] Referral deep links (?ref=): captured once per device, URL cleaned after load, `referrals` table counts installs per referrer, profile shows "Friends joined" (edge-cached GET)
- [x] Web Push (VAPID, free): opt-in button on the Daily Challenge card, SW v8 push + notificationclick handlers, `/api/push/subscribe` registry (Turso), daily Vercel cron (13:00 UTC) sends only to devices in the ~5–10 PM local window, expired subs auto-pruned
- [x] Anti-cheat pass #1: per-game plausibility caps (racing 250k / quiz 20k / 2048 150k / snake 25k → 422) + per-device live play-speed floor 8 s (→ 429); offline-flushed scores carry their original ts and skip the floor; 422/429 are dropped client-side (never re-queued)

**Milestone:** ✅ players can invite friends, share scores, compete weekly; leaderboards feel alive.

## Phase 4 — Monetization v1 (Day 46–70) 💰 ✅ DONE — shipped as v2.2
> Goal: first revenue **without** hurting free play.
- [x] Coin economy: coins earned per play (racing /400, quiz /20, 2048 /200, snake /50 — per-run caps) + per ad, **client ledger** (`src/lib/coins.ts`, localStorage) + **server-verified event log** (`coin_events` on Turso, claim-then-send batch sync, offline-safe queue)
- [x] Rewarded ads: network-agnostic adapter layer (`src/lib/ads.ts`) with an **honest demo player** (labeled placeholder, 5 s countdown, close-early = no reward) — swap one constant when a real network (AdSense H5/AdMob/StartApp) is connected; placements: +2 nitro (racing menu), +1 lifeline (quiz), double coins (all 4 game-over screens), flat +25 coins
- [x] Daily limits: 400 play coins/day + 10 rewarded ads/day, mirrored server-side (UTC caps, per-device); daily streak bonus +5%/day (max +25%)
- [x] Cosmetics shop (`/shop` dialog via header coin pill): 6 car paints, 4 exhaust trails (incl. rainbow), 4 quiz themes — pure client skins (localStorage), prices 🪙 300–900, one free default each
- [x] Server: `coin_events` table self-migrates on first request (no manual db:init step), signed S2S ad-reward endpoint `/api/coins/ad-reward` (HMAC-SHA256 + nonce replay guard) ready for real networks
- [ ] Real ad network account + wiring (manual: needs AdSense H5 Games / AdMob approval) — adapter is ready
- [ ] Real-money payouts — deliberately NOT built (honest design: coins buy cosmetics only, no cash-out claims)

**Milestone:** ✅ monetization rails live with honest, player-friendly demo ads — first ৳ income starts the day a real network is plugged in.

## Phase 5 — Premium & scale (Day 71–90)
- [ ] **Premium tier (one-time or monthly):** ad-free, exclusive cars/themes, 2× daily coins
- [ ] Payment via bKash/Nagad merchant or Stripe (whichever clears for BD) — start manual VIP-code system (zero fee)
- [ ] Cloud sync for premium: backup progress to Turso per device
- [ ] New game #3: **Car Parking puzzle** (premium exclusive for 2 weeks)
- [ ] Performance: route-level code splitting, banner AVIF, budget < 200 KB JS per page

**Milestone:** paying users, zero infra bills.

## Phase 6 — Polish & launch v2.0 (Day 91–100)
- [ ] TWA packaging (Bubblewrap) → publish on **Google Play** as a lightweight wrapper (~$25 one-time)
- [ ] Landing page polish + SEO (titles, OG images)
- [ ] Full regression: offline, low-end Android (2 GB RAM device test), 3G throttle test
- [ ] Admin mini-dashboard (server route + secret key): DAU, plays, ad revenue vs coins out
- [ ] v2.0 release 🎉 + community feedback round

**Milestone:** Play Store presence + sustainable operation.

---

## Cost guardrails (enforced all 100 days)
1. No always-on servers — only serverless functions + edge cache.
2. All game assets/logic client-side; nothing > 100 KB ships without compression review.
3. Reads always edge-cached (`s-maxage`); writes batched/small.
4. Free tiers tracked monthly: Vercel Hobby, Turso Free, analytics free tier.
5. Any new feature must justify its monthly cost in taka before build.
