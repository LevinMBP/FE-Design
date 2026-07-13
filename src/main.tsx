import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './shared/styles/antd-overrides.css'
import App from './app/App.tsx'
import AntdProvider from './app/AntdProvider.tsx'
import { store } from './app/store.ts'
import { applyTheme, readStoredTheme } from './features/ui/theme.ts'

// Apply the saved theme before first paint to avoid a flash of the wrong theme.
applyTheme(readStoredTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <AntdProvider>
          <App />
        </AntdProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
)
