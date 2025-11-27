<template>
  <div class="maplibre-base-container">
    <div class="map-switcher-dropdown">
      <button 
        class="map-switch-button" 
        @click="dropdownOpen = !dropdownOpen"
        @blur="handleBlur"
      >
       ▼
      </button>
      <div v-if="dropdownOpen" class="dropdown-menu">
        <NuxtLink v-if="!isOnDenkmalkarte" to="/" class="dropdown-item">Denkmalkarte</NuxtLink>
        <NuxtLink v-if="!isOnKulturkarte" to="/culture/abc" class="dropdown-item">Kulturkarte</NuxtLink>
      </div>
    </div>
    <div ref="mapContainer" class="maplibre-base" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, computed } from 'vue'
import { useRoute } from '#imports'
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import maplibregl from 'maplibre-gl'

interface Props {
  center?: [number, number]
  zoom?: number
  style?: StyleSpecification | string
}

const props = withDefaults(defineProps<Props>(), {
  center: () => [9.53205485, 54.79443515], // Default: Flensburg
  zoom: 12,
  style: () => ({
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tiles.oklabflensburg.de/sgm/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="dc:rights">OpenStreetMap</a> contributors'
      }
    },
    layers: [
      {
        id: 'osm',
        type: 'raster',
        source: 'osm'
      }
    ]
  } as StyleSpecification)
})

const emit = defineEmits<{
  'map-loaded': [map: MapLibreMap]
  'map-destroyed': []
}>()

const route = useRoute()
const mapContainer = ref<HTMLDivElement | null>(null)
const dropdownOpen = ref(false)
let map: MapLibreMap | null = null

const isOnDenkmalkarte = computed(() => route.path === '/')
const isOnKulturkarte = computed(() => route.path.startsWith('/culture'))

const handleBlur = () => {
  // Delay to allow click events on dropdown items
  setTimeout(() => {
    dropdownOpen.value = false
  }, 200)
}

onMounted(() => {
  if (!mapContainer.value) return

  map = new maplibregl.Map({
    container: mapContainer.value,
    style: props.style,
    center: props.center,
    zoom: props.zoom
  })

  map.on('load', () => {
    if (map) {
      emit('map-loaded', map)
    }
  })
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
    emit('map-destroyed')
  }
})

defineExpose({
  getMap: () => map
})
</script>

<style scoped>
.maplibre-base-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.maplibre-base {
  width: 100%;
  height: 100%;
}

.map-switcher-dropdown {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
}

.map-switch-button {
  padding: 0.5rem 1rem;
  background: var(--surface-primary, #ffffff);
  color: var(--color-text, #1e293b);
  border: none;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.map-switch-button:hover {
  background: var(--surface-muted, #f1f5f9);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transform: translateY(-1px);
}

.map-switch-button:active {
  transform: translateY(0);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 160px;
  background: var(--surface-primary, #ffffff);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-item {
  display: block;
  padding: 0.625rem 1rem;
  color: var(--color-text, #1e293b);
  text-decoration: none;
  font-size: 0.875rem;
  transition: background 0.15s ease;
}

.dropdown-item:hover {
  background: var(--surface-muted, #f1f5f9);
}

.dropdown-item:not(:last-child) {
  border-bottom: 1px solid var(--border-soft, #e2e8f0);
}
</style>
