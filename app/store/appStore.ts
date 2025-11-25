import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useAppStore = defineStore('appStore', () => {
  const organizerId = ref<number | null>(null)

  const setOrganizerId = (id: number | null) => {
    organizerId.value = id
  }

  return {
    organizerId,
    setOrganizerId
  }
}, {
  persist: true
})
