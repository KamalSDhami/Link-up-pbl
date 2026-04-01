import { create } from 'zustand'

export type ThemePreference = 'light' | 'dark'

interface ThemeState {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
  toggleTheme: () => void
}

const STORAGE_KEY = 'linkup-theme'

const getInitialTheme = (): ThemePreference => {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

const applyTheme = (theme: ThemePreference) => {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export const useThemeStore = create<ThemeState>((set) => {
  const initialTheme = getInitialTheme()
  applyTheme(initialTheme)

  return {
    theme: initialTheme,
    setTheme: (theme) => {
      applyTheme(theme)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, theme)
      }
      set({ theme })
    },
    toggleTheme: () => {
      set((state) => {
        const nextTheme: ThemePreference = state.theme === 'dark' ? 'light' : 'dark'
        applyTheme(nextTheme)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, nextTheme)
        }
        return { theme: nextTheme }
      })
    },
  }
})
