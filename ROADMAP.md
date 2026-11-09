# 🗺 Game Zone — 100-Day Product Roadmap

**Principle:** every phase must stay cost-effective (client-first, free tiers, no idle servers)
and ship *premium-feeling* features players love. One release per week is enough — quality > speed.

> Current status (Day 0): Racing ✅ · Quiz ✅ · PWA offline ✅ · Global leaderboard ✅ · Vercel deploy ✅

---

## Phase 1 — Foundation hardening (Day 1–10) ✅ Week 1
- [ ] **Day 1–2:** Vercel live + custom domain check, PWA install test on 2–3 real Android devices
- [ ] **Day 3–4:** Offline audit — airplane-mode test of both games, SW update flow (skipWaiting toast)
- [ ] **Day 5:** Localized app string file (English now, Bangla toggle ready)
- [ ] **Day 6–7:** Bug bash from first real players, fix top 5 issues
- [ ] **Day 8–10:** Privacy-friendly analytics (page-view only, self-hosted or Vercel Analytics free tier)

**Milestone:** a stable, installable, offline-proof v1.2 in real users' hands.

## Phase 2 — Content & retention (Day 11–25)
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
