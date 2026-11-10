# 🗺 Game Zone — 100-Day Product Roadmap

**Principle:** every phase must stay cost-effective (client-first, free tiers, no idle servers)
and ship *premium-feeling* features players love. One release per week is enough — quality > speed.

> Current status (Day 25): Racing v2 ✅ · Quiz v2 ✅ · 2048 ✅ · Snake ✅ · Daily challenge ✅ · Achievements ✅ · PWA offline ✅ · Global leaderboard ✅ · Vercel deploy ✅ · **Phase 2 content ✅ (v2.0)**

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

## Phase 3 — Social & competition (Day 26–45)
- [ ] Weekly tournaments: reset window per game, winner badge on profile
- [ ] Player profile card: avatar (emoji picker), total plays, best ranks (all localStorage)
- [ ] Share button: Web Share API — "I scored X, beat me!" (free viral loop)
- [ ] Referral deep links (?ref=) — counts installs per referrer
- [ ] Web Push (VAPID, free): daily challenge reminder opt-in
- [ ] Anti-cheat pass #1: server-side plausibility checks on score POST (speed of plays, max score/game)

**Milestone:** players invite friends; leaderboards feel alive.

## Phase 4 — Monetization v1 (Day 46–70) 💰
> Goal: first revenue **without** hurting free play.
- [ ] Rewarded ads via an ad network (AdMob/Unity/StartApp — pick by BD eCPM): "Watch ad → +1 nitro / +1 lifeline / double coins"
- [ ] Coin economy: coins earned per play/ad (client ledger + server-verified ads EVENT log)
- [ ] Cosmetics shop: car colors, trails, quiz themes (pure client skins — no server cost)
- [ ] Daily coin cap + streak bonus (retention + controlled payout)
- [ ] Server: add `coin_events` table (Turso), sign ad-reward callbacks

**Milestone:** first ৳ income with honest, player-friendly ads.

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
