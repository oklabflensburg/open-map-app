// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['leaflet/dist/leaflet.css', '@/assets/styles/main.scss'],
  modules: ['@pinia/nuxt', '@pinia-plugin-persistedstate/nuxt', '@nuxtjs/i18n'],
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || ''
    }
  },
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [
      {
        code: 'en',
        iso: 'en-US',
        file: 'en.json',
        name: 'English'
      },
      {
        code: 'de',
        iso: 'de-DE',
        file: 'de.json',
        name: 'Deutsch'
      },
      {
        code: 'da',
        iso: 'da-DK',
        file: 'da.json',
        name: 'Dansk'
      }
    ],
    langDir: '../i18n/locales',
    detectBrowserLanguage: {
      fallbackLocale: 'en',
      redirectOn: 'root',
      useCookie: true,
      cookieKey: 'i18n_redirected',
      alwaysRedirect: false
    },
    vueI18n: '../i18n.config.ts'
  }
})
