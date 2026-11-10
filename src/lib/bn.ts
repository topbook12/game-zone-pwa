/**
 * বাংলা সংখ্যা ও localStorage হেল্পার (React 19 useSyncExternalStore ভিত্তিক)
 */

import { useSyncExternalStore } from 'react'

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']

/** ইংরেজি সংখ্যা → বাংলা সংখ্যা (123 → ১২৩) */
export function toBn(value: number | string): string {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)])
}

/* ---------------- localStorage external store ---------------- */

const storageListeners = new Set<() => void>()

function subscribeStorage(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  storageListeners.add(callback)
  window.addEventListener('storage', callback)
  return () => {
    storageListeners.delete(callback)
    window.removeEventListener('storage', callback)
  }
}

function notifyStorage(): void {
  storageListeners.forEach((listener) => listener())
}

/** localStorage থেকে সংখ্যা পড়া (না থাকলে fallback) */
export function readStoredNumber(key: string, fallback = 0): number {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return Number(raw) || fallback
  } catch {
    return fallback
  }
}

/** localStorage-এ সংখ্যা সেভ + সাবস্ক্রাইবারদের নোটিফাই */
export function writeStoredNumber(key: string, value: number): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, String(value))
    notifyStorage()
  } catch {
    /* স্টোরেজ ফুল/ব্লকড হলে চুপচাপ পাস */
  }
}

/** কম্পোনেন্টে প্রতিক্রিয়াশীলভাবে সংখ্যা পড়া — SSR-এ fallback ফেরত দেয় (হাইড্রেশন নিরাপদ) */
export function useStoredNumber(key: string, fallback = 0): number {
  return useSyncExternalStore(
    subscribeStorage,
    () => readStoredNumber(key, fallback),
    () => fallback
  )
}
