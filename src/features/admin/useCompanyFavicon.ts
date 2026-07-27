import { useEffect } from 'react'
import { useGetCompanyQuery } from './adminApi'

/**
 * Applies the company's uploaded icon as the browser-tab favicon. Falls back to
 * the app's default icon when none is set. Call once, near the app root.
 */
export function useCompanyFavicon(): void {
  const { data: company } = useGetCompanyQuery()
  const icon = company?.icon

  useEffect(() => {
    const link =
      document.querySelector<HTMLLinkElement>("link[rel='icon']") ??
      (() => {
        const el = document.createElement('link')
        el.rel = 'icon'
        document.head.appendChild(el)
        return el
      })()

    // Remember the original once, so removing the company icon can restore it.
    if (!link.dataset.default) link.dataset.default = link.getAttribute('href') ?? ''

    link.href = icon || link.dataset.default
  }, [icon])
}
