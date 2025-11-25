<template>
  <div ref="mapContainer" class="maplibre-base" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Map as MapLibreMap, MapOptions, StyleSpecification } from 'maplibre-gl'
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

const mapContainer = ref<HTMLDivElement | null>(null)
let map: MapLibreMap | null = null

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
.maplibre-base {
  width: 100%;
  height: 100%;
}
</style>
