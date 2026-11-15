# 🗺 Game Zone — v3 Roadmap: 100-Day Platform Plan

**Focus of v3:** a platform anyone can use — **zero errors, human-friendly UX, advanced
tooling** that finds bugs before players do. Every phase ships player-visible improvements
AND invisible quality infrastructure. One release per 10 days, quality > speed.

**Standing rules (apply to every phase):**
- Cost stays near zero — free tiers only, client-first compute, no idle servers
- Offline-first — every feature must work on a flaky 2G/3G connection
- Bangladesh-network budget — initial page < 300 KB JS, game chunk < 150 KB, images WebP
- Every phase ends with a **ship gate**: typecheck ✅ lint ✅ build ✅ E2E ✅ version bump ✅ SW bump ✅

> Archived: v2 roadmap (Phases 1–5, Day 1–90) is complete and shipped — see git history
> (`git log --oneline` tags v1.3 → v2.3). Racing, Quiz, 2048, Snake, Parking, coins, VIP,
> referral, push, cloud backup, global leaderboard all live.

---

## Phase 1 — Ship pipeline & zero-error baseline (Day 1–10) 🔧
> Goal: **every future bug is caught by a machine before a player sees it.**
- [ ] **Day 1–2:** Fix Vercel deploy pipeline (owner: create Vercel token → read failed-deploy logs → root-cause fix) — *blocked on owner token; bot + CI below already detect the outage*
- [x] **Day 2–3:** Post-deploy verification bot: `bun run verify:deploy` checks live sw.js version, `/api/version`, `/api/scores` health and the page footer against the local build; also runs as the CI `live-check` job (daily 03:00 UTC cron)
- [x] **Day 3–5:** GitHub Actions CI (free for public repos): frozen-lockfile install → strict typecheck → lint → **production build gate** on every push; daily live-site verification; badge in README
- [x] **Day 5–7:** Error sweep pass #1: `ignoreBuildErrors: false` (TS now FAILS the build), ESLint `no-unused-vars` gate re-enabled for `src/**`, 5 dead-code errors fixed (unused lang/ScoreRow/FOG_COLOR/actionTypes), leftover `src/lib/db.ts` + `prisma/` + `db/` + `tests/` dead files removed (v2.2 cleanup was incomplete)
- [x] **Day 8–10:** Version guard — `/api/version` (force-dynamic, no-store) serves the build version; `pwa-register` compares it to the bundled `APP_VERSION` every 30 min + on reconnect; if the server is newer the existing one-tap refresh card appears and reloads (stale phones self-heal)

**Milestone:** broken deploys become impossible to miss; stale phones self-heal.

## Phase 2 — User-friendly onboarding (Day 11–20) 🤝
> Goal: a first-time player (any age, any phone) understands everything in 30 seconds.
- [x] First-visit welcome tour: 3 steps — pick language → install PWA → play (dismissible, remembered)
- [x] How-to-play screen per game: one illustrated card, EN + বাংলা, reachable from menu AND hub
- [x] Friendlier failure copy: GameErrorBoundary cards rewritten ("We fixed nothing yet — tap reload"), recovery one-tap
- [x] Settings center: sound, vibration, data-saver (low graphics), language, reset progress — one dialog, all games
- [x] Touch-target & contrast audit: every button ≥ 44 px, WCAG AA contrast on all screens

**Milestone:** nobody needs a manual to play.

## Phase 3 — Advanced tooling I: automated QA (Day 21–30) 🤖
> Goal: all 5 games verified by robots on every commit.
- [ ] Playwright E2E suite in CI: racing accelerates on touch, quiz answers advance, 2048/snake swipe, parking solves a level — mobile + desktop profiles
- [ ] Lighthouse CI budgets: performance ≥ 85, accessibility ≥ 90, PWA installable, bundle-size caps — build fails if budget blown
- [ ] CI screenshots artifact: hub + every game at 375 px, reviewed on release
- [ ] Fix every issue the robots find (they will find some)

**Milestone:** regressions die in CI, never on a player's phone.

## Phase 4 — Performance & data economy (Day 31–40) ⚡
> Goal: fastest game hub in Bangladesh on a ৳150/day data pack.
- [ ] Lazy-load every game chunk (hub stays tiny; game code loads on tap)
- [ ] Asset diet: banners → WebP/AVIF, icons recompressed, audit all fonts
- [ ] FPS overlay (dev builds only) + quality-governor tuning from real numbers
- [ ] Storage manager UI: "how much space do I use", clear-cache without losing scores (queue-safe)
- [ ] Offline completeness check: full catalog + leaderboard cache + profile — airplane-mode certified

**Milestone:** < 300 KB to first play; everything works offline.

## Phase 5 — Accessibility & localization deep pass (Day 41–50) 🌐
> Goal: playable by everyone — screen readers, low-end phones, Bangla-first users.
- [ ] Screen-reader pass: aria-live score updates, labeled controls in all 5 games
- [ ] `prefers-reduced-motion` support: animations calm down automatically
- [ ] 100% string coverage audit: EN + বাংলা including error messages, push text, ads
- [ ] Bangla numerals toggle (৳ score display mode)
- [ ] Keyboard-only play for desktop (tab order, visible focus)

**Milestone:** nobody is excluded by language, ability, or device.

## Phase 6 — Advanced tooling II: observability (Day 51–60) 📡
> Goal: the owner sees problems before players report them — $0 tooling.
- [ ] Tiny error reporter: `window.onerror` + `unhandledrejection` → POST `/api/log` → Turso table (rate-limited, no third-party service)
- [ ] Web Vitals collection via the same endpoint (LCP/INP/CLS per device class)
- [ ] Owner admin page (secret path): recent errors, live version, DB row counts, sync-queue health
- [ ] Daily uptime cron: health ping; if unhealthy → Web Push alert to the owner's own device
- [ ] Weekly digest: plays/coins/errors summary as a push to owner (Sunday)

**Milestone:** "it's broken" reports become "we knew before you did".

## Phase 7 — Content & fairness (Day 61–70) 🎯
> Goal: more to do, and everyone trusts the leaderboard.
- [ ] Parking: +20 levels (graduated difficulty), star ratings per level
- [ ] Quiz: +60 questions (Bangladesh GK emphasis), difficulty tags, per-category leaderboards
- [ ] Anti-cheat #2: server-side outlier detection (score distribution per device), shadow-flag + review list in admin page
- [ ] Monthly season badges (replaces plain weekly crowns) + hall-of-fame screen

**Milestone:** deeper content, tournament integrity.

## Phase 8 — New game #1: Bangla Word Puzzle (Day 71–80) 🔤
> Goal: viral, zero-asset, fully offline daily habit (Wordle-style, Bangla words).
- [ ] 5-letter Bangla word list (500+ curated words), daily seeded word + free practice mode
- [ ] Emoji-grid share result (Wordle-style spoiler-free share → WhatsApp/Facebook growth)
- [ ] Achievements, streaks, leaderboard category integration
- [ ] On-screen Bangla keyboard (mobile-first), hint system (uses coins — connects economy)

**Milestone:** a shareable daily habit that costs zero server money.

## Phase 9 — New game #2 + hub evolution (Day 81–90) 🧠
> Goal: memory game + a hub that feels like a console, not a list.
- [ ] Memory Match: icon-pair flipping, difficulty tiers, zero assets (SVG icons), offline
- [ ] Hub redesign: favorites, "continue playing" row, search/filter, recently-played
- [ ] App shortcuts: long-press icon → direct to daily challenge / specific game
- [ ] Richer install prompt: PWA screenshots for the install sheet (Android Chrome)

**Milestone:** 7 games, console-grade hub, home-screen-first experience.

## Phase 10 — Release engineering & v3.0 launch (Day 91–100) 🚀
> Goal: launch v3.0.0 like a product, not a push.
- [ ] QA marathon matrix: 2 low-end Androids + 1 mid phone + tablet + desktop, each online/offline
- [ ] API load sanity test (self-scripted, gentle — respect free tier)
- [ ] Docs: PLAYER_GUIDE.md (players, EN/বাংলা) + OWNER_GUIDE.md (VIP codes, DB ops, deploy runbook, incident playbook)
- [ ] Final sweep: robots green (CI + Lighthouse + E2E), version 3.0.0, SW v-final, celebration update card
- [ ] Launch: tag v3.0.0, release notes (EN+বাংলা), push notification to all opted-in devices

**Milestone:** v3.0.0 — a fast, friendly, self-monitoring platform that fixes itself.

---

## Owner manual actions (outside my reach)
1. **Vercel token** → unblock the deploy pipeline fix (Phase 1, Day 1–2) — *the current blocker*
2. **GitHub token reset** (security hygiene — old token exposed in chat)
3. Optional: custom domain (৳/year) for a branded URL
4. Optional: real ad-network account approval (adapter is ready — one constant swap)
