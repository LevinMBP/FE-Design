import { useEffect, useState } from 'react'
import { useAppSelector } from '../../app/hooks'
import { selectTheme } from './uiSlice'
import { resolveTheme } from './theme'

/**
 * The concrete 'light' | 'dark' currently in effect (resolving 'system' against
 * the OS and reacting to OS changes). Drives the AntD theme algorithm.
 */
export function useResolvedTheme(): 'light' | 'dark' {
  const preference = useAppSelector(selectTheme)
  const [resolved, setResolved] = useState(() => resolveTheme(preference))

  useEffect(() => {
    setResolved(resolveTheme(preference))
    if (preference !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setResolved(resolveTheme('system'))
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  return resolved
}
