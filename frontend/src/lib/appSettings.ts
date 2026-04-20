import { useSyncExternalStore } from 'react'
import type { Timeframe } from '@/types'

export type EditorTheme = 'light' | 'dark'
export type EditorWordWrap = 'on' | 'off'

export interface AppSettings {
  version: number
  apiBaseUrl: string
  defaults: {
    exchange: string
    symbol: string
    timeframe: Timeframe | ''
  }
  editor: {
    theme: EditorTheme
    fontSize: number
    wordWrap: EditorWordWrap
  }
}

const STORAGE_KEY = 'fettle.app-settings'
const STORAGE_EVENT = 'fettle:app-settings'
const STORAGE_VERSION = 1
const FALLBACK_API_BASE_URL = 'http://localhost:3001'

export const TIMEFRAME_OPTIONS: Timeframe[] = [
  '1s',
  '10s',
  '1m',
  '3m',
  '5m',
  '10m',
  '15m',
  '30m',
  '1h',
  '2h',
  '3h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
  '3M',
  '4M',
  '1y',
]

const DEFAULT_API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL ?? FALLBACK_API_BASE_URL
)

const DEFAULT_SETTINGS: AppSettings = {
  version: STORAGE_VERSION,
  apiBaseUrl: DEFAULT_API_BASE_URL,
  defaults: {
    exchange: '',
    symbol: '',
    timeframe: '',
  },
  editor: {
    theme: 'light',
    fontSize: 14,
    wordWrap: 'on',
  },
}

let cachedSettings = DEFAULT_SETTINGS
let cachedStorageValue: string | null | undefined

function isBrowser() {
  return typeof window !== 'undefined'
}

function clampFontSize(fontSize: number) {
  return Math.min(20, Math.max(12, Math.round(fontSize)))
}

function isTimeframe(value: unknown): value is Timeframe {
  return typeof value === 'string' && TIMEFRAME_OPTIONS.includes(value as Timeframe)
}

export function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim()
  const source = trimmed || FALLBACK_API_BASE_URL

  const candidate = /^https?:\/\//i.test(source) ? source : `http://${source}`

  try {
    const url = new URL(candidate)
    url.pathname = url.pathname.replace(/\/+$/, '')
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
  } catch {
    return trimmed.replace(/\/+$/, '')
  }
}

function sanitizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_SETTINGS
  }

  const raw = value as Partial<AppSettings>
  const rawDefaults = raw.defaults
  const rawEditor = raw.editor

  return {
    version: STORAGE_VERSION,
    apiBaseUrl: typeof raw.apiBaseUrl === 'string'
      ? normalizeApiBaseUrl(raw.apiBaseUrl)
      : DEFAULT_SETTINGS.apiBaseUrl,
    defaults: {
      exchange: typeof rawDefaults?.exchange === 'string' ? rawDefaults.exchange : '',
      symbol: typeof rawDefaults?.symbol === 'string' ? rawDefaults.symbol : '',
      timeframe: isTimeframe(rawDefaults?.timeframe) ? rawDefaults.timeframe : '',
    },
    editor: {
      theme: rawEditor?.theme === 'dark' ? 'dark' : 'light',
      fontSize: typeof rawEditor?.fontSize === 'number'
        ? clampFontSize(rawEditor.fontSize)
        : DEFAULT_SETTINGS.editor.fontSize,
      wordWrap: rawEditor?.wordWrap === 'off' ? 'off' : 'on',
    },
  }
}

function readFromStorage() {
  if (!isBrowser()) {
    cachedStorageValue = null
    cachedSettings = DEFAULT_SETTINGS
    return DEFAULT_SETTINGS
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === cachedStorageValue && cachedStorageValue !== undefined) {
      return cachedSettings
    }

    cachedStorageValue = raw

    if (!raw) {
      cachedSettings = DEFAULT_SETTINGS
      return cachedSettings
    }

    const parsed = JSON.parse(raw)
    cachedSettings = sanitizeSettings(parsed)
    return cachedSettings
  } catch {
    cachedStorageValue = null
    cachedSettings = DEFAULT_SETTINGS
    return cachedSettings
  }
}

function emitChange() {
  if (!isBrowser()) {
    return
  }

  window.dispatchEvent(new Event(STORAGE_EVENT))
}

function getSnapshot() {
  cachedSettings = readFromStorage()
  return cachedSettings
}

function subscribe(listener: () => void) {
  if (!isBrowser()) {
    return () => undefined
  }

  const handleChange = () => {
    readFromStorage()
    listener()
  }
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      readFromStorage()
      listener()
    }
  }

  window.addEventListener(STORAGE_EVENT, handleChange)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(STORAGE_EVENT, handleChange)
    window.removeEventListener('storage', handleStorage)
  }
}

export function getAppSettings() {
  return readFromStorage()
}

export function saveAppSettings(value: AppSettings) {
  const next = sanitizeSettings(value)
  cachedSettings = next

  if (isBrowser()) {
    cachedStorageValue = JSON.stringify(next)
    window.localStorage.setItem(STORAGE_KEY, cachedStorageValue)
    emitChange()
  }

  return next
}

export function resetAppSettings() {
  return saveAppSettings(DEFAULT_SETTINGS)
}

export function useAppSettings() {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_SETTINGS)
}

export function getDefaultAppSettings() {
  return DEFAULT_SETTINGS
}
