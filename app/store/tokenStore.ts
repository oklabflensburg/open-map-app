import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

interface TokenPayload {
  accessToken?: string | null
  refreshToken?: string | null
}

export const useTokenStore = defineStore('tokenStore', () => {
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)

  const isAuthenticated = computed(() => Boolean(accessToken.value))

  const setTokens = ({ accessToken: access, refreshToken: refresh }: TokenPayload) => {
    if (typeof access !== 'undefined') {
      accessToken.value = access
    }

    if (typeof refresh !== 'undefined') {
      refreshToken.value = refresh
    }
  }

  const setAccessToken = (token: string | null) => {
    accessToken.value = token
  }

  const setRefreshToken = (token: string | null) => {
    refreshToken.value = token
  }

  const clearTokens = () => {
    accessToken.value = null
    refreshToken.value = null
  }

  return {
    accessToken,
    refreshToken,
    isAuthenticated,
    setTokens,
    setAccessToken,
    setRefreshToken,
    clearTokens
  }
}, {
  persist: true
})
