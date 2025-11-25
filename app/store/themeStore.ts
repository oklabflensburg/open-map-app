import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ThemeName = 'light' | 'dark'

export const useThemeStore = defineStore('themeStore', () => {
  const currentTheme = ref<ThemeName>('light')

  const setTheme = (theme: ThemeName) => {
    currentTheme.value = theme
    applyTheme(theme)
  }

  return {
    currentTheme,
    setTheme
  }
}, {
  persist: true
})

export const applyTheme = (theme: ThemeName) => {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.dataset.theme = theme

  if (document.body) {
    document.body.classList.remove('theme-light', 'theme-dark')
    document.body.classList.add(`theme-${theme}`)
  }
}
