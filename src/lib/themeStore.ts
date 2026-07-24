'use client'

import { useSyncExternalStore } from 'react'

export const THEME_STORAGE_KEY = 'theme-preference'
export type Theme = 'light' | 'dark'

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark'
}

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readThemeFromStorage(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : getSystemTheme()
  } catch {
    return getSystemTheme()
  }
}

/** Applies the theme to the DOM and persists it. Same shape as the shoot-mode
 * store's write path — single source of truth, storage event notifies other
 * tabs/subscribers. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // ignore storage errors (private mode, etc.)
  }
  notifyThemeSubscribers()
}

const listeners = new Set<() => void>()

export function notifyThemeSubscribers(): void {
  for (const listener of listeners) {
    listener()
  }
}

function subscribeTheme(onStoreChange: () => void): () => void {
  const onStorage = (event: StorageEvent): void => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      onStoreChange()
    }
  }
  window.addEventListener('storage', onStorage)
  listeners.add(onStoreChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    listeners.delete(onStoreChange)
  }
}

function getThemeSnapshot(): Theme {
  return readThemeFromStorage()
}

/** Current theme, reactive to toggles from anywhere (mirrors useShootModeOn). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => 'light')
}
