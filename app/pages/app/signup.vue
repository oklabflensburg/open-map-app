<template>
  <div class="auth-page">
    <div class="app-card">
      <header class="auth-header">
        <h1>{{ t('signup') }}</h1>
        <p>{{ signupSubtitle }}</p>
      </header>

      <form class="app-form" @submit.prevent="signup" :aria-busy="isSubmitting" novalidate>
        <label for="signup-email">{{ t('email') }}</label>
        <input
          type="email"
          id="signup-email"
          name="email"
          v-model="email"
          autocomplete="email"
          :aria-invalid="Boolean(fieldErrors.email)"
          :aria-describedby="fieldErrors.email ? 'signup-form-error' : undefined"
          required
        >

        <label for="signup-password">{{ t('password') }}</label>
        <input
          type="password"
          id="signup-password"
          name="password"
          v-model="password"
          autocomplete="new-password"
          :aria-invalid="Boolean(fieldErrors.password)"
          :aria-describedby="fieldErrors.password ? 'signup-form-error' : undefined"
          required
        >

        <label for="signup-confirm-password">{{ t('confirm_password') }}</label>
        <input
          type="password"
          id="signup-confirm-password"
          name="confirmPassword"
          v-model="confirmPassword"
          autocomplete="new-password"
          :aria-invalid="Boolean(fieldErrors.confirmPassword)"
          :aria-describedby="fieldErrors.confirmPassword ? 'signup-form-error' : undefined"
          required
        >

        <transition name="fade">
          <p
            v-if="displayError"
            id="signup-form-error"
            class="feedback feedback--error"
            role="alert"
            aria-live="assertive"
          >
            {{ displayError }}
          </p>
        </transition>

        <div class="form-actions">
          <button class="app-button" type="submit" :disabled="isSubmitting">
            <span v-if="!isSubmitting">{{ t('signup_cta') }}</span>
            <span v-else>{{ t('signup_loading') }}</span>
          </button>
        </div>
      </form>

      <footer class="auth-footer">
        <span>{{ t('have_account') }}</span>
        <router-link to="/app/login">{{ t('login') }}</router-link>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiFetch } from '@/api'
import type { LoginResponse } from '@/api'

const { t } = useI18n()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const isSubmitting = ref(false)

const fieldErrors = reactive({
  email: null as string | null,
  password: null as string | null,
  confirmPassword: null as string | null,
})

const signupSubtitle = computed(() => t('signup_subtitle'))

const displayError = computed(() => {
  if (fieldErrors.email) return fieldErrors.email
  if (fieldErrors.password) return fieldErrors.password
  if (fieldErrors.confirmPassword) return fieldErrors.confirmPassword
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

watch(confirmPassword, (value) => {
  if (fieldErrors.confirmPassword && value.trim()) {
    fieldErrors.confirmPassword = null
    if (error.value === fieldErrors.confirmPassword) {
      error.value = null
    }
  }
})

const signup = async () => {
  error.value = null
  fieldErrors.email = null
  fieldErrors.password = null
  fieldErrors.confirmPassword = null

  const trimmedEmail = email.value.trim()
  const trimmedPassword = password.value.trim()
  const trimmedConfirmPassword = confirmPassword.value.trim()

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

  if (!trimmedConfirmPassword) {
    fieldErrors.confirmPassword = requiredFieldMessage.value
    return
  }
  if (trimmedPassword !== trimmedConfirmPassword) {
    fieldErrors.confirmPassword = t('password_mismatch')
    return
  }

  isSubmitting.value = true

  try {
    const { data, status } = await apiFetch<LoginResponse>('/api/admin/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: trimmedEmail,
        password: trimmedPassword,
        password_confirmation: trimmedConfirmPassword,
      }),
    })

    if (status === 200 || status === 201) {
      successMessage.value = data.message || t('signup_success')
    } else {
      error.value = t('signup_failed')
    }
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'data' in err) {
      const e = err as { data?: { error?: string } }
      error.value = e.data?.error || t('signup_failed')
    } else {
      error.value = t('signup_failed')
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>
