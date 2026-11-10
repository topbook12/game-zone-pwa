/**
 * Tiny i18n — English now, Bangla toggle ready (Phase 1, Day 5).
 *
 * Design: flat module, zero dependencies, reactive via useSyncExternalStore
 * (hydration-safe: server always renders English, then switches after mount).
 * Preference persists in localStorage (`gz-lang`).
 */

import { useSyncExternalStore } from 'react'

export type Lang = 'en' | 'bn'

const en = {
  common: {
    playNow: 'Play now',
    backToHub: 'Back to hub',
    exitToHub: 'Exit to hub',
    best: 'Best:',
    score: 'Score',
    syncSynced: '☁ Synced to global leaderboard',
    syncRank: '— rank #{n}',
    syncQueued: '⏳ Saved — will sync when back online',
    syncOffline: '📴 Offline — score will sync automatically',
    langAria: 'Switch language',
  },
  hub: {
    appName: 'Game Zone',
    tagline: 'Play. Win. Repeat.',
    leaderboard: 'Leaderboard',
    leaderboardAria: 'Open global leaderboard',
    worksOffline: 'Works offline too',
    heroTitle: 'Play, win, have fun! 🎮',
    heroDesc:
      'Install on Android and play anytime — even without internet. Your scores and progress are saved right on your phone.',
    chipRacing: '🏎️ 3D Racing',
    chipQuiz: '🧠 Quiz',
    chipOffline: '📶 Offline mode',
    statRacing: 'Racing best',
    statQuiz: 'Quiz best',
    statPlays: 'Total plays',
    gamesTitle: 'Games',
    readyToPlay: 'Ready to play',
    comingSoon: 'Coming soon',
    soon: 'Soon',
    racingTitle: 'Turbo Rush',
    racingDesc: 'Pseudo-3D arcade racer — dodge traffic, hit checkpoints, fire the nitro!',
    racingAria: 'Play Turbo Rush',
    quizTitle: 'Brain Quiz',
    quizDesc: '6 categories, 60+ questions — test your knowledge and beat your best!',
    quizAria: 'Play Brain Quiz',
    installTitle: 'How to install on Android',
    installStep1: 'Open this page in the Chrome browser',
    installStep2: 'Tap the "Install" button above',
    installStep3: 'Or open the menu (⋮) → "Add to Home screen"',
    installStep4: 'Launch it like a real app from your home screen — works offline too!',
    installNote: 'After the first load, all games run completely offline',
    footerCopyright: 'Game Zone © 2025 • Version 1.3',
    footerOffline: 'Offline-ready PWA',
  },
  board: {
    title: 'Global Leaderboard',
    desc: 'Top 10 players worldwide. Updates every 30 seconds.',
    nameAria: 'Your player name',
    namePlaceholder: 'Your name',
    editNameAria: 'Edit player name',
    saved: 'Saved',
    tabRacing: '🏎️ Turbo Rush',
    tabQuiz: '🧠 Brain Quiz',
    empty: 'No scores yet — be the first champion! 🏆',
    live: 'Live from server',
    stale: 'Showing saved scores (offline)',
    refresh: 'Refresh',
    refreshAria: 'Refresh leaderboard',
  },
  quiz: {
    selectDesc: 'Pick a category — 15 seconds per question, faster answers earn bonus points!',
    bankLabel: 'Question bank:',
    playCatAria: 'Play {name} quiz',
    questionOf: 'Question {a}/{b}',
    scoreLabel: 'Score:',
    bestCat: 'Best score (this category):',
    complete: 'Quiz complete!',
    msgOutstanding: 'Outstanding! You are a genius! 🌟',
    msgExcellent: 'Excellent! Very well played! 🎉',
    msgGood: 'Good! A little more practice and you will be the best! 💪',
    msgPractice: 'No worries, practice makes perfect! 📚',
    newRecord: '🎊 New record!',
    correct: 'Correct',
    accuracy: 'Accuracy',
    playAgain: 'Play again',
    changeCategory: 'Change category',
    correctPts: '✅ Correct! +{n} points',
    timeUp: '⏰ Time is up! Correct answer: {ans}',
    wrong: '❌ Wrong! Correct answer: {ans}',
    answerAria: 'Answer {n}: {opt}',
    bestBadge: 'Best:',
  },
  racing: {
    appAria: 'Turbo Rush racing game',
    backAria: 'Back to game hub',
    menuBadge: 'OFFLINE READY · PWA',
    circuit: 'SUNSET RIDGE CIRCUIT',
    bestScore: 'Best score:',
    startRace: 'START RACE',
    kbTitle: 'KEYBOARD',
    kbLine1: '↑ / W Accelerate · ← → Steer',
    kbLine2: '↓ / S Brake · SHIFT Nitro · P Pause',
    touchTitle: 'TOUCH',
    touchLine1: 'On-screen pads to steer',
    touchLine2: 'Auto-gas ON · tap NITRO to boost',
    menuDesc:
      'Reach checkpoints to extend your 60-second timer. Dodge traffic, pass cars to charge nitro — every crash costs precious speed!',
    hudScore: 'SCORE',
    hudOvertakes: 'Overtakes',
    hudTime: 'TIME',
    hudDistance: 'DISTANCE',
    hudNitro: 'NITRO',
    hudKmh: 'KM/H',
    kbHint: '↑ Gas · ← → Steer · ↓ Brake · SHIFT Nitro · P Pause',
    rotate: 'Rotate your phone for the best experience',
    pauseAria: 'Pause game',
    muteAria: 'Mute',
    unmuteAria: 'Unmute',
    fsAria: 'Toggle fullscreen',
    steerLeftAria: 'Steer left',
    steerRightAria: 'Steer right',
    brake: 'BRAKE',
    brakeAria: 'Brake',
    nitro: 'NITRO',
    nitroAria: 'Nitro boost',
    paused: 'PAUSED',
    resume: 'RESUME',
    restart: 'RESTART',
    exit: 'EXIT TO HUB',
    timeUp: 'TIME UP!',
    newRecord: 'NEW RECORD!',
    finalScore: 'FINAL SCORE',
    statDistance: 'DISTANCE',
    statOvertakes: 'OVERTAKES',
    statTopSpeed: 'TOP SPEED',
    raceAgain: 'RACE AGAIN',
    mainMenu: 'MAIN MENU',
    go: 'GO!',
  },
  status: {
    offline: 'You are offline — games still work, scores save on your phone',
    updateTitle: 'New version available',
    updateDesc: 'Tap refresh to get the latest improvements.',
    updateAction: 'Refresh now',
  },
  install: {
    label: 'Install',
    aria: 'Install app',
  },
}

export type Dict = typeof en

/** Bangla mirror — same keys, guaranteed by `Dict`. */
const bn: Dict = {
  common: {
    playNow: 'খেলুন',
    backToHub: 'হাবে ফিরুন',
    exitToHub: 'হাবে ফিরুন',
    best: 'সেরা:',
    score: 'স্কোর',
    syncSynced: '☁ গ্লোবাল লিডারবোর্ডে সিঙ্ক হয়েছে',
    syncRank: '— র‍্যাঙ্ক #{n}',
    syncQueued: '⏳ সেভ হয়েছে — ইন্টারনেট এলে সিঙ্ক হবে',
    syncOffline: '📴 অফলাইন — স্কোর নিজে থেকেই সিঙ্ক হবে',
    langAria: 'ভাষা পরিবর্তন',
  },
  hub: {
    appName: 'গেম জোন',
    tagline: 'খেলুন। জিতুন। আবার করুন।',
    leaderboard: 'লিডারবোর্ড',
    leaderboardAria: 'গ্লোবাল লিডারবোর্ড খুলুন',
    worksOffline: 'অফলাইনেও চলে',
    heroTitle: 'খেলুন, জিতুন, মজা নিন! 🎮',
    heroDesc:
      'Android-এ ইনস্টল করুন আর যখন খুশি খেলুন — ইন্টারনেট ছাড়াও! আপনার স্কোর আর প্রোগ্রেস সরাসরি ফোনেই সেভ থাকে।',
    chipRacing: '🏎️ 3D রেসিং',
    chipQuiz: '🧠 কুইজ',
    chipOffline: '📶 অফলাইন মোড',
    statRacing: 'রেসিং সেরা',
    statQuiz: 'কুইজ সেরা',
    statPlays: 'মোট খেলা',
    gamesTitle: 'গেমস',
    readyToPlay: 'খেলার জন্য প্রস্তুত',
    comingSoon: 'শীঘ্রই আসছে',
    soon: 'শীঘ্রই',
    racingTitle: 'Turbo Rush',
    racingDesc: 'সিউডো-3D রেসিং — ট্রাফিক এড়ান, চেকপয়েন্ট হিট করুন, নাইট্রো ফায়ার করুন!',
    racingAria: 'Turbo Rush খেলুন',
    quizTitle: 'ব্রেইন কুইজ',
    quizDesc: '৬ ক্যাটাগরি, ৬০+ প্রশ্ন — আপনার জ্ঞান পরীক্ষা করুন, সেরা স্কোর ছুঁয়ে ফেলুন!',
    quizAria: 'ব্রেইন কুইজ খেলুন',
    installTitle: 'Android-এ কীভাবে ইনস্টল করবেন',
    installStep1: 'Chrome ব্রাউজারে এই পেজটি খুলুন',
    installStep2: 'উপরের "Install" বাটনে ট্যাপ করুন',
    installStep3: 'অথবা মেনু (⋮) → "Add to Home screen"',
    installStep4: 'হোম স্ক্রিন থেকে আসল অ্যাপের মতো চালু করুন — অফলাইনেও চলবে!',
    installNote: 'প্রথমবার লোডের পর সব গেম সম্পূর্ণ অফলাইনে চলে',
    footerCopyright: 'গেম জোন © ২০২৫ • ভার্সন ১.৩',
    footerOffline: 'অফলাইন-রেডি PWA',
  },
  board: {
    title: 'গ্লোবাল লিডারবোর্ড',
    desc: 'সারা বিশ্বের সেরা ১০ জন খেলোয়াড়। প্রতি ৩০ সেকেন্ডে আপডেট হয়।',
    nameAria: 'আপনার প্লেয়ার নাম',
    namePlaceholder: 'আপনার নাম',
    editNameAria: 'প্লেয়ার নাম এডিট করুন',
    saved: 'সেভ হয়েছে',
    tabRacing: '🏎️ Turbo Rush',
    tabQuiz: '🧠 ব্রেইন কুইজ',
    empty: 'এখনো কোনো স্কোর নেই — প্রথম চ্যাম্পিয়ন হয়ে যান! 🏆',
    live: 'সার্ভার থেকে লাইভ',
    stale: 'সেভ করা স্কোর দেখানো হচ্ছে (অফলাইন)',
    refresh: 'রিফ্রেশ',
    refreshAria: 'লিডারবোর্ড রিফ্রেশ',
  },
  quiz: {
    selectDesc: 'ক্যাটাগরি বাছুন — প্রতি প্রশ্নে ১৫ সেকেন্ড, দ্রুত উত্তর দিলে বোনাস পয়েন্ট!',
    bankLabel: 'প্রশ্ন ব্যাংক:',
    playCatAria: '{name} কুইজ খেলুন',
    questionOf: 'প্রশ্ন {a}/{b}',
    scoreLabel: 'স্কোর:',
    bestCat: 'সেরা স্কোর (এই ক্যাটাগরিতে):',
    complete: 'কুইজ শেষ!',
    msgOutstanding: 'অসাধারণ! আপনি একজন প্রতিভাবান! 🌟',
    msgExcellent: 'চমৎকার! খুব সুন্দর খেলেছেন! 🎉',
    msgGood: 'ভালো! আরেকটু প্র্যাকটিস করলেই আপনি সেরা হবেন! 💪',
    msgPractice: 'সমস্যা নেই, প্র্যাকটিসেই সব পারা যায়! 📚',
    newRecord: '🎊 নতুন রেকর্ড!',
    correct: 'সঠিক',
    accuracy: 'নির্ভুলতা',
    playAgain: 'আবার খেলুন',
    changeCategory: 'ক্যাটাগরি বদলান',
    correctPts: '✅ সঠিক! +{n} পয়েন্ট',
    timeUp: '⏰ সময় শেষ! সঠিক উত্তর: {ans}',
    wrong: '❌ ভুল হয়েছে! সঠিক উত্তর: {ans}',
    answerAria: 'উত্তর {n}: {opt}',
    bestBadge: 'সেরা:',
  },
  racing: {
    appAria: 'Turbo Rush রেসিং গেম',
    backAria: 'গেম হাবে ফিরুন',
    menuBadge: 'অফলাইন রেডি · PWA',
    circuit: 'SUNSET RIDGE CIRCUIT',
    bestScore: 'সেরা স্কোর:',
    startRace: 'রেস শুরু',
    kbTitle: 'কীবোর্ড',
    kbLine1: '↑ / W চালু · ← → স্টিয়ার',
    kbLine2: '↓ / S ব্রেক · SHIFT নাইট্রো · P পজ',
    touchTitle: 'টাচ',
    touchLine1: 'স্ক্রিনের প্যাড দিয়ে স্টিয়ার',
    touchLine2: 'অটো-গ্যাস ON · নাইট্রোতে ট্যাপ করুন',
    menuDesc:
      'চেকপয়েন্টে পৌঁছে ৬০ সেকেন্ডের টাইমার বাড়ান। ট্রাফিক এড়ান, গাড়ি পাস করে নাইট্রো চার্জ করুন — প্রতিটি ক্র্যাশে দামি গতি হারাবেন!',
    hudScore: 'স্কোর',
    hudOvertakes: 'ওভারটেক',
    hudTime: 'সময়',
    hudDistance: 'দূরত্ব',
    hudNitro: 'নাইট্রো',
    hudKmh: 'কিমি/ঘ',
    kbHint: '↑ গ্যাস · ← → স্টিয়ার · ↓ ব্রেক · SHIFT নাইট্রো · P পজ',
    rotate: 'সেরা অভিজ্ঞতার জন্য ফোন ঘুরিয়ে ধরুন',
    pauseAria: 'গেম পজ করুন',
    muteAria: 'সাউন্ড বন্ধ',
    unmuteAria: 'সাউন্ড চালু',
    fsAria: 'ফুলস্ক্রিন টগল',
    steerLeftAria: 'বাঁয়ে স্টিয়ার',
    steerRightAria: 'ডানে স্টিয়ার',
    brake: 'ব্রেক',
    brakeAria: 'ব্রেক',
    nitro: 'নাইট্রো',
    nitroAria: 'নাইট্রো বুস্ট',
    paused: 'পজ হয়েছে',
    resume: 'চালু করুন',
    restart: 'আবার শুরু',
    exit: 'হাবে ফিরুন',
    timeUp: 'সময় শেষ!',
    newRecord: 'নতুন রেকর্ড!',
    finalScore: 'চূড়ান্ত স্কোর',
    statDistance: 'দূরত্ব',
    statOvertakes: 'ওভারটেক',
    statTopSpeed: 'সর্বোচ্চ গতি',
    raceAgain: 'আবার রেস',
    mainMenu: 'মূল মেনু',
    go: 'যাও!',
  },
  status: {
    offline: 'আপনি অফলাইনে আছেন — গেম আবারও চলবে, স্কোর ফোনে সেভ হবে',
    updateTitle: 'নতুন ভার্সন এসেছে',
    updateDesc: 'সর্বশেষ ফিচার পেতে রিফ্রেশ করুন।',
    updateAction: 'এখনই রিফ্রেশ',
  },
  install: {
    label: 'ইনস্টল',
    aria: 'অ্যাপ ইনস্টল করুন',
  },
}

const STRINGS: Record<Lang, Dict> = { en, bn }

const LANG_KEY = 'gz-lang'
const listeners = new Set<() => void>()

function readLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  try {
    return window.localStorage.getItem(LANG_KEY) === 'bn' ? 'bn' : 'en'
  } catch {
    return 'en'
  }
}

function subscribeLang(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  listeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

export function getLang(): Lang {
  return readLang()
}

export function setLang(lang: Lang): void {
  try {
    window.localStorage.setItem(LANG_KEY, lang)
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
  // Keep <html lang> in sync for screen readers
  document.documentElement.lang = lang === 'bn' ? 'bn' : 'en'
}

/** Reactive dictionary hook — SSR/hydration always renders English first. */
export function useI18n(): { lang: Lang; t: Dict } {
  const lang = useSyncExternalStore(subscribeLang, readLang, () => 'en' as Lang)
  return { lang, t: STRINGS[lang] }
}

/** Handy template helper: "Question {a}/{b}" → fmt(t.quiz.questionOf, { a: 1, b: 10 }). */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''))
}
