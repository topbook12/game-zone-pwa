# 🗺 Game Zone — 100-Day Product Roadmap

**Principle:** every phase must stay cost-effective (client-first, free tiers, no idle servers)
and ship *premium-feeling* features players love. One release per week is enough — quality > speed.

> Current status (Day 10): Racing ✅ · Quiz ✅ · PWA offline ✅ · Global leaderboard ✅ · Vercel deploy ✅ · **Phase 1 hardening ✅ (v1.3)**

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

## Phase 2 — Content & retention (Day 11–25) ← NEXT
- [ ] Quiz question packs v2: Sports, Movies, Bangladesh GK, Math blitz (bundle client-side = $0)
- [ ] Daily challenge: seeded daily seed (same 10 questions/track for everyone, client-computed)
- [ ] Achievements (first win, 10 games, top-10 leaderboard…), stored in localStorage
- [ ] New game #1: **2048** (pure client, ~1 day build)
- [ ] New game #2: **Snake Neon** (pure client)
- [ ] App icon pack + better game banners (AI-generated, compressed < 60 KB each)

**Milestone:** daily-return habit loop (daily challenge + achievements).

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
