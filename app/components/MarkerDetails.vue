<template>
  <div class="marker-details" :class="`marker-details--${variant}`">
    <div v-if="coLocated && coLocated.length > 1" class="marker-details__stack">
      <p class="marker-details__stack-label">Mehrere Einträge an diesem Ort</p>
      <div class="marker-details__accordion" role="list">
        <button
          v-for="item in coLocated"
          :key="item.id"
          type="button"
          class="marker-details__accordion-item"
          :class="{ 'marker-details__accordion-item--active': item.id === activeId }"
          :aria-pressed="item.id === activeId"
          role="listitem"
          @click="selectMarker(item.id || '')"
        >
          <span class="marker-details__accordion-title">{{ item.monumentType || item.title }}</span>
          <span class="marker-details__accordion-subtitle">{{ formatAddress(item) }}</span>
        </button>
      </div>
    </div>

    <figure v-if="activeMarker.photoLink" class="marker-details__figure" @click="openModal">
      <img
        class="marker-details__photo"
        :src="activeMarker.photoLink"
        :alt="activeMarker.title"
        loading="lazy"
      />
      <figcaption class="marker-details__figcaption">Foto © Landesamt für Denkmalpflege</figcaption>
    </figure>

    <ul class="marker-details__list">
      <li class="marker-details__title"><strong>{{ activeMarker.monumentType || activeMarker.title }}</strong></li>
      <li class="marker-details__address">
        <span v-if="activeMarker.street || activeMarker.housenumber">
          {{ [activeMarker.street, activeMarker.housenumber].filter(Boolean).join(' ') }}
        </span><br>
        <span v-if="activeMarker.postcode || activeMarker.city">{{ [activeMarker.postcode, activeMarker.city].filter(Boolean).join(' ') }}</span>
      </li>
      <li class="marker-details__section">
        <strong>Beschreibung</strong><br>
        {{ activeMarker.description }}
      </li>
      <li class="marker-details__section" v-if="activeMarker.lastUpdate">
        <strong>Aktualisiert</strong><br>
        {{ activeMarker.lastUpdate }}
      </li>
      <li class="marker-details__section" v-if="activeMarker.monumentFunction">
        <strong>Merkmal</strong><br>
        {{ activeMarker.monumentFunction }}
      </li>
    </ul>

    <div
      v-if="isModalOpen && activeMarker.photoLink"
      class="marker-photo-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Photo preview"
      @click.self="closeModal"
    >
      <button class="marker-photo-modal__close" type="button" @click="closeModal" aria-label="Close photo">
        ×
      </button>
      <img :src="activeMarker.photoLink" :alt="activeMarker.title" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MarkerDetailsData } from '~/types/markers'

interface Props {
  marker: MarkerDetailsData
  variant?: 'sidebar' | 'sheet'
  coLocated?: MarkerDetailsData[]
}

const props = withDefaults(defineProps<Props>(), {
  coLocated: () => []
})
const emit = defineEmits<{
  'select-marker': [id: string]
}>()
const isModalOpen = ref(false)
const activeId = ref(props.marker.id || '')

watch(
  () => props.marker.id,
  (id) => {
    activeId.value = id || ''
  }
)

const activeMarker = computed(() => {
  const found = props.coLocated?.find((m) => m.id === activeId.value)
  return found || props.marker
})

const openModal = () => {
  if (!activeMarker.value.photoLink) return
  isModalOpen.value = true
  window.addEventListener('keydown', handleEscapeKey)
}

const closeModal = () => {
  isModalOpen.value = false
  window.removeEventListener('keydown', handleEscapeKey)
}

const handleEscapeKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    closeModal()
  }
}

const selectMarker = (id: string) => {
  if (!id) return
  activeId.value = id
  emit('select-marker', id)
}

const formatAddress = (marker: MarkerDetailsData) => {
  const street = [marker.street, marker.housenumber].filter(Boolean).join(' ')
  const city = [marker.postcode, marker.city].filter(Boolean).join(' ')
  return [street, city].filter(Boolean).join(' · ')
}
</script>

<style scoped>
.marker-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.marker-details__list {
  list-style: none;
  padding: 0.75rem;
  margin: 0;
  background: var(--surface-muted);
  border-radius: 12px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

.marker-details__title {
  padding-bottom: 0.5rem;
  font-size: 1.3rem;
}

.marker-details__address {
  margin: 0.25rem 0 0.75rem 0;
  color: var(--muted-text);
  line-height: 1.4;
}

.marker-details__section {
  padding: 0.5rem 0;
  margin: 0;
  color: var(--muted-text);
  line-height: 1.5;
}

.marker-details__figure {
  position: relative;
  margin: 0;
}

.marker-details__figcaption {
  background-color: var(--surface-muted);
  position: absolute;
  bottom: 0;
  right: 0;
  width: 100%;
  padding: 0.5rem 0.5rem;
  color: var(--muted-text);
  font-size: 0.8rem;
}

.marker-details__link {
  color: var(--accent-primary);
  text-decoration: none;
  font-weight: 600;
}

.marker-details__link:hover {
  text-decoration: underline;
}

.marker-details__photo {
  width: 100%;
  border-radius: 12px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
  cursor: pointer;
}

.marker-photo-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 4000;
  padding: 1rem;
}

.marker-photo-modal img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
}

.marker-photo-modal__close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  border: none;
  background: rgba(255, 255, 255, 0.9);
  color: #0f172a;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.4rem;
  line-height: 1;
}

.marker-details__stack {
  background: var(--surface-muted);
  border-radius: 12px;
  padding: 0.75rem 0.75rem 0.25rem;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

.marker-details__stack-label {
  margin: 0 0 0.25rem;
  font-size: 0.9rem;
  color: var(--muted-text);
}

.marker-details__accordion {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.marker-details__accordion-item {
  width: 100%;
  text-align: left;
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--border-soft);
  background: var(--surface-primary);
  color: var(--color-text);
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;
}

.marker-details__accordion-item:hover {
  border-color: var(--accent-primary);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
}

.marker-details__accordion-item--active {
  border-color: var(--accent-primary);
  box-shadow: 0 6px 18px rgba(37, 99, 235, 0.18);
  transform: translateY(-1px);
}

.marker-details__accordion-title {
  display: block;
  font-weight: 700;
}

.marker-details__accordion-subtitle {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.85rem;
  color: var(--muted-text);
}
</style>
