import type { ReactNode } from 'react'
import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd'
import { useResolvedTheme } from '../features/ui/useResolvedTheme'

const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

/**
 * Wires Ant Design to our design system: brand primary color, StockFlo-matched
 * control sizing (default/"middle" = 32px, our --control-height-md), and the
 * light/dark algorithm bound to the app's resolved theme so AntD components
 * follow the theme toggle. Table header / Tag chrome is finished in
 * `shared/styles/antd-overrides.css` via CSS tokens so it re-resolves per theme.
 * `AntdApp` enables context-based message/notification.
 */
function AntdProvider({ children }: { children: ReactNode }) {
  const resolved = useResolvedTheme()
  const dark = resolved === 'dark'

  return (
    <ConfigProvider
      tag={{ variant: 'outlined' }}
      theme={{
        algorithm: dark
          ? antdTheme.darkAlgorithm
          : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: dark ? '#818cf8' : '#4f46e5',
          borderRadius: 6,
          borderRadiusLG: 10,
          borderRadiusSM: 4,
          fontSize: 13.5,
          fontFamily: FONT_FAMILY,
          controlHeight: 32,
        },
        components: {
          Table: {
            cellPaddingBlock: 8,
            cellPaddingInline: 12,
          },
          Button: {
            fontWeight: 500,
            // Darker fill than the bright accent so white button text stays
            // legible in dark mode; accent/links keep the brighter primary.
            colorPrimary: dark ? '#6366f1' : '#4f46e5',
            colorPrimaryHover: dark ? '#4f46e5' : '#4338ca',
            colorPrimaryActive: dark ? '#4338ca' : '#3730a3',
          },
          Tag: {
            borderRadiusSM: 4,
          },
          Form: {
            itemMarginBottom: 8
          }
        },
      }}
    >
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  )
}

export default AntdProvider
