<template>
  <div class="auth-page">
    <div class="app-card">
      <header class="auth-header">
        <h1>{{ t('forgot_password') }}</h1>
        <p>{{ forgotPasswordSubtitle }}</p>
      </header>

      <form class="app-form" @submit.prevent="submitRequest" :aria-busy="isSubmitting" novalidate>
        <label for="forgot-email">{{ t('email') }}</label>
        <input
          type="email"
          id="forgot-email"
          name="email"
          v-model="email"
          autocomplete="email"
          :aria-invalid="Boolean(fieldErrors.email)"
          :aria-describedby="fieldErrors.email ? 'forgot-form-error' : undefined"
          required
        >

        <transition name="fade">
          <p
            v-if="displayError"
            id="forgot-form-error"
            class="feedback feedback--error"
            role="alert"
            aria-live="assertive"
          >
            {{ displayError }}
          </p>
        </transition>

        <transition name="fade">
          <p
            v-if="successMessage"
            class="feedback feedback--success"
            role="status"
            aria-live="polite"
          >
            {{ successMessage }}
          </p>
        </transition>

        <div class="form-actions">
          <button class="app-button" type="submit" :disabled="isSubmitting">
            <span v-if="!isSubmitting">{{ t('forgot_password_cta') }}</span>
            <span v-else>{{ t('forgot_password_loading') }}</span>
          </button>
        </div>
      </form>

      <footer class="auth-footer">
        <span>{{ t('remember_password') }}</span>
        <router-link to="/app/login">{{ t('login') }}</router-link>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiFetch } from '@/api'

interface ForgotPasswordResponse {
  message?: string
}

const { t } = useI18n()

const email = ref('')
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const isSubmitting = ref(false)

const fieldErrors = reactive({
  email: null as string | null,
})

const forgotPasswordSubtitle = computed(() => t('forgot_password_subtitle'))

const displayError = computed(() => {
  if (fieldErrors.email) return fieldErrors.email
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

const submitRequest = async () => {
  error.value = null
  successMessage.value = null
  fieldErrors.email = null

  const trimmedEmail = email.value.trim()

  if (!trimmedEmail) {
    fieldErrors.email = requiredFieldMessage.value
    return
  }
  if (!isValidEmail(trimmedEmail)) {
    fieldErrors.email = invalidEmailMessage.value
    return
  }

  isSubmitting.value = true

  try {
    const { data, status } = await apiFetch<ForgotPasswordResponse>('/api/admin/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email: trimmedEmail,
      }),
    })

    if (status === 200) {
      successMessage.value = data.message || t('forgot_password_success')
    } else {
      error.value = t('forgot_password_failed')
    }
  } catch (err: unknown) {
    if (typeof err === 'object' && err && 'data' in err) {
      const e = err as { data?: { error?: string } }
      error.value = e.data?.error || t('forgot_password_failed')
    } else {
      error.value = t('forgot_password_failed')
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>
