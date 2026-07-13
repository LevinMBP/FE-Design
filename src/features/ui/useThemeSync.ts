import { useEffect } from 'react'
import { useAppSelector } from '../../app/hooks'
import { selectTheme } from './uiSlice'
import { applyTheme, THEME_STORAGE_KEY } from './theme'

/**
 * Keeps the DOM + localStorage in sync with the theme preference in the store.
 * When the preference is 'system', it also re-applies whenever the OS flips.
 * Call once, high in the tree (App).
 */
export function useThemeSync(): void {
  const theme = useAppSelector(selectTheme)

  useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)

    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])
}
