import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../app/store'
import { readStoredTheme, type ThemePreference } from './theme'

interface UiState {
  theme: ThemePreference
}

const initialState: UiState = {
  theme: readStoredTheme(),
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<ThemePreference>) {
      state.theme = action.payload
    },
  },
})

export const { setTheme } = uiSlice.actions
export const selectTheme = (state: RootState) => state.ui.theme

export default uiSlice.reducer
