import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useUserStore = defineStore('userStore', () => {
  const userId = ref<number | null>(null)
  const displayName = ref('')
  const emailAddress = ref('')
  const userAvatar = ref<string | null>(null)

  const setUserId = (id: number | null) => {
    userId.value = id
  }

  const setDisplayName = (name: string) => {
    displayName.value = name
  }

  const setEmailAddress = (email: string) => {
    emailAddress.value = email
  }

  const setUserAvatar = (avatarUrl: string | null) => {
    userAvatar.value = avatarUrl
  }

  return {
    userId,
    displayName,
    emailAddress,
    userAvatar,
    setUserId,
    setDisplayName,
    setEmailAddress,
    setUserAvatar
  }
}, {
  persist: true
})
