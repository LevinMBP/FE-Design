export type ThemePreference = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'venturo.theme'

export function readStoredTheme(): ThemePreference {
  const value = window.localStorage.getItem(THEME_STORAGE_KEY)
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : 'system'
}

/** Resolve a preference to a concrete theme, consulting the OS for 'system'. */
export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return pref
}

/** Apply the resolved theme to the document so CSS `[data-theme]` rules kick in. */
export function applyTheme(pref: ThemePreference): void {
  document.documentElement.dataset.theme = resolveTheme(pref)
}
