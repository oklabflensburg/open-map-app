import { useRuntimeConfig, useRouter } from '#imports'
import { useTokenStore } from '@/store/tokenStore'
import type { ThemeName } from '@/store/themeStore'

let refreshPromise: Promise<boolean> | null = null

export interface LoginResponse {
  message: string
  user_id?: string
  locale?: string
  theme?: ThemeName
  display_name?: string
  access_token?: string
  refresh_token?: string
}

export interface ApiResponse<T> {
  data: T
  status: number
}

export interface NominatimResult {
  lat: string
  lon: string
}

class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

const NOMINATIM_BASE_URL = 'https://nominatim.oklabflensburg.de'

export const fetchCoordinatesForAddress = async (
  query: string,
  limit = 1
): Promise<NominatimResult | null> => {
  const params = new URLSearchParams({ q: query, limit: String(limit), format: 'jsonv2' })
  const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`Nominatim request failed with status ${response.status}`)
  }

  const results = (await response.json()) as NominatimResult[]
  if (!Array.isArray(results) || results.length === 0) {
    return null
  }

  return results[0] ?? null
}

const redirectToLogin = async (clearTokens: () => void) => {
  clearTokens()

  if (!import.meta.client) return

  const router = useRouter()
  try {
    await router.replace('/app/login')
  } catch (error) {
    console.error('Navigation to /app/login failed', error)
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const config = useRuntimeConfig()
  const tokenStore = useTokenStore()
  const baseURL = config.public?.apiBase ?? ''
  const url = `${baseURL}${path}`

  const doFetch = async (): Promise<ApiResponse<T>> => {
    const headers = new Headers(options.headers ?? undefined)

    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    if (tokenStore.accessToken) {
      headers.set('Authorization', `Bearer ${tokenStore.accessToken}`)
    } else {
      headers.delete('Authorization')
    }

    const res = await fetch(url, { ...options, headers })
    const contentType = res.headers.get('content-type') ?? ''
    let data: unknown = null

    if (contentType.includes('application/json')) {
      try {
        data = await res.json()
      } catch {
        data = null
      }
    } else {
      try {
        data = await res.text()
      } catch {
        data = null
      }
    }

    if (!res.ok) {
      const message =
        (data && typeof data === 'object' && 'error' in data
          ? (data as { error?: string }).error
          : null) || res.statusText

      throw new ApiError(message, res.status, data)
    }

    return {
      data: data as T,
      status: res.status
    }
  }

  try {
    return await doFetch()
  } catch (err) {
    if (
      err instanceof ApiError &&
      err.status === 401 &&
      !url.includes('/refresh') &&
      !url.includes('/login')
    ) {
      if (!refreshPromise) {
        refreshPromise = (async () => {
          if (!tokenStore.refreshToken) {
            await redirectToLogin(tokenStore.clearTokens)
            throw new Error('Missing refresh token')
          }

          const refreshRes = await fetch(`${baseURL}/api/admin/refresh`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${tokenStore.refreshToken}`
            }
          })

          if (!refreshRes.ok) {
            await redirectToLogin(tokenStore.clearTokens)
            throw new Error('Refresh failed')
          }

          const data = (await refreshRes.json()) as LoginResponse
          if (!data.access_token) {
            await redirectToLogin(tokenStore.clearTokens)
            throw new Error('Refresh response missing access token')
          }

          tokenStore.setAccessToken(data.access_token)

          if (data.refresh_token) {
            tokenStore.setRefreshToken(data.refresh_token)
          }

          return true
        })()
      }

      try {
        await refreshPromise
      } finally {
        refreshPromise = null
      }

      return await doFetch()
    }

    throw err
  }
}
