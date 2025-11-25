<template>
  <div class="auth-page">
    <div class="app-card">
      <header class="auth-header">
        <h1>{{ t('login') }}</h1>
        <p>{{ loginSubtitle }}</p>
      </header>

      <form class="app-form" @submit.prevent="login" :aria-busy="isSubmitting" novalidate>
        <label for="login-email">{{ t('email') }}</label>
        <input
          type="email"
          id="login-email"
          name="email"
          v-model="email"
          autocomplete="email"
          :aria-invalid="Boolean(fieldErrors.email)"
          :aria-describedby="fieldErrors.email ? 'login-form-error' : undefined"
          required
        >

        <label for="login-password">{{ t('password') }}</label>
        <input
          type="password"
          id="login-password"
          name="password"
          v-model="password"
          autocomplete="current-password"
          :aria-invalid="Boolean(fieldErrors.password)"
          :aria-describedby="fieldErrors.password ? 'login-form-error' : undefined"
          required
        >

        <div class="forgot-password-link">
          <router-link to="/app/forgot-password">{{ t('forgot_password') }}</router-link>
        </div>

        <transition name="fade">
          <p
            v-if="displayError"
            id="login-form-error"
            class="feedback feedback--error"
            role="alert"
            aria-live="assertive"
          >
            {{ displayError }}
          </p>
        </transition>

        <div class="form-actions">
          <button class="app-button" type="submit" :disabled="isSubmitting">
            <span v-if="!isSubmitting">{{ t('login_cta') }}</span>
            <span v-else>{{ t('login_loading') }}</span>
          </button>
        </div>
      </form>

      <footer class="auth-footer">
        <span>{{ t('need_account') }}</span>
        <router-link to="/app/signup">{{ t('signup') }}</router-link>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { apiFetch } from '@/api'
import type { LoginResponse } from '@/api'
import { useTokenStore } from '@/store/tokenStore'
import { useUserStore } from '@/store/userStore'
import { useThemeStore } from '@/store/themeStore'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const tokenStore = useTokenStore()
const userStore = useUserStore()
const themeStore = useThemeStore()

const { locale } = useI18n({ useScope: 'global' })
const selectedLocale = computed({
  get: () => locale.value,
  set: (value: string) => {
    locale.value = value
  },
})

const email = ref('')
const password = ref('')
const isPasswordVisible = ref(false)
const error = ref<string | null>(null)
const isSubmitting = ref(false)

const fieldErrors = reactive({
  email: null as string | null,
  password: null as string | null,
})

const loginSubtitle = computed(() => t('login_subtitle'))

const displayError = computed(() => {
  if (fieldErrors.email) return fieldErrors.email
  if (fieldErrors.password) return fieldErrors.password
  return error.value
})

const isValidEmail = (value: string) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailPattern.test(value)
}

const requiredFieldMessage = computed(() => t('event_error_required'))
const invalidEmailMessage = computed(() => t('organizer_form_invalid_email'))

watch(email, (value) => {
  if (fieldErrors.email && value.trim()) {
    const trimmed = value.trim()
    if (isValidEmail(trimmed)) {
      fieldErrors.email = null
      if (error.value === fieldErrors.email) {
        error.value = null
      }
    }
  }
})

watch(password, (value) => {
  if (fieldErrors.password && value.trim()) {
    fieldErrors.password = null
    if (error.value === fieldErrors.password) {
      error.value = null
    }
  }
})

const login = async () => {
  error.value = null
  fieldErrors.email = null
  fieldErrors.password = null

  const trimmedEmail = email.value.trim()
  const trimmedPassword = password.value.trim()

  // Validate email
  if (!trimmedEmail) {
    fieldErrors.email = requiredFieldMessage.value
    return
  }
  if (!isValidEmail(trimmedEmail)) {
    fieldErrors.email = invalidEmailMessage.value
    return
  }

  // Validate password
  if (!trimmedPassword) {
    fieldErrors.password = requiredFieldMessage.value
    return
  }

  isSubmitting.value = true

  try {
    const { data, status } = await apiFetch<LoginResponse>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        email: trimmedEmail,
        password: trimmedPassword,
      }),
    })

    if (status === 200 && data.message === 'login successful' && data.access_token && data.refresh_token) {
      tokenStore.setTokens(data.access_token, data.refresh_token)

      if (data.user_id) {
        userStore.setUserId(data.user_id)
      }

      if (data.display_name) {
        userStore.setDisplayName(data.display_name)
      }

      if (data.locale) {
        selectedLocale.value = data.locale
      }

      if (data.theme) {
        themeStore.setTheme(data.theme)
      }

      const redirectTarget = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
      router.replace(redirectTarget)
    } else {
      error.value = t('invalid_credentials')
    }
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'data' in err) {
      const e = err as { data?: { error?: string } }
      error.value = e.data?.error || t('login_failed')
    } else {
      error.value = t('login_failed')
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>
