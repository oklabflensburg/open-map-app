<template>
  <div
    class="monuments-map"
    :class="{
      'monuments-map--sidebar-open': showSidebar,
      'monuments-map--bottom-sheet-open': showBottomSheet
    }"
  >
    <MapLibreBase
      ref="mapBaseRef"
      :center="centerDefault"
      :zoom="defaultZoom"
      @map-loaded="handleMapLoaded"
      @map-destroyed="handleMapDestroyed"
    />

    <!-- DESKTOP SIDEBAR -->
    <transition name="slide-in">
      <aside
        v-if="selectedMarker && !isMobile"
        class="monuments-map__sidebar"
        role="complementary"
        aria-label="Location details"
      >
        <div class="monuments-map__sidebar-header">
          <h2>{{ selectedMarker.title }}</h2>
          <button
            class="monuments-map__close"
            type="button"
            @click="closeSheet"
            aria-label="Close details"
          >
            ×
          </button>
        </div>

        <div class="monuments-map__sidebar-content">
          <MarkerDetails
            :marker="selectedMarker"
            variant="sidebar"
            :co-located="coLocatedMarkers"
            @select-marker="handleCoLocatedSelect"
          />
        </div>
      </aside>
    </transition>

    <!-- MOBILE BOTTOM SHEET -->
    <transition name="slide-up">
      <section
        v-if="selectedMarker && isMobile"
        ref="bottomSheetRef"
        class="monuments-map__bottom-sheet"
        :class="{ 'monuments-map__bottom-sheet--expanded': isBottomSheetExpanded }"
        role="dialog"
        aria-modal="true"
        aria-label="Location details"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <div
          class="monuments-map__bottom-sheet-handle"
          aria-hidden="true"
          @click="toggleBottomSheet"
        />
        <div class="monuments-map__bottom-sheet-header">
          <h2 class="monuments-map__bottom-sheet-title">
            {{ selectedMarker.monumentFunction }}
          </h2>
          <button
            class="monuments-map__close"
            type="button"
            @click="closeSheet"
            aria-label="Close details"
          >
            ×
          </button>
        </div>

        <div class="monuments-map__bottom-sheet-content">
          <MarkerDetails
            :marker="selectedMarker"
            variant="sheet"
            :co-located="coLocatedMarkers"
            @select-marker="handleCoLocatedSelect"
          />
        </div>
      </section>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRuntimeConfig, useRouter, useHead } from '#imports'

import maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import MapLibreBase from '~/components/MapLibreBase.vue'
import MarkerDetails from '~/components/MarkerDetails.vue'

import markerDefault from '~/assets/marker-icon-default.webp'
import markerSelected from '~/assets/marker-icon-active.webp'

// ---------------------------------------------------------------------
// MAP + STATE
// ---------------------------------------------------------------------

const centerDefault: [number, number] = [9.43205485, 54.79443515] // [lng, lat]
const defaultZoom = 13
const zoomLevelDetail = 19

const mapBaseRef = ref<InstanceType<typeof MapLibreBase> | null>(null)
const map = ref<any>(null)
const mapLoaded = ref(false)

const selectedFeatureId = ref<number | string | null>(null)
const isBoundsSet = ref(false)

type MonumentRecord = {
  id: number
  slug?: string
  monument_function?: string
  object_number?: string
  street?: string
  housenumber?: string
  postcode?: string
  city?: string
  last_update?: string
  monument_type?: string
  description?: string
  monument_scope?: string
  photo_link?: string
  geojson?: any
  label?: string
}

type MonumentMarker = {
  id: string
  slug?: string
  title: string
  description: string
  coords: [number, number]
  monumentFunction?: string
  street?: string
  housenumber?: string
  postcode?: string
  city?: string
  lastUpdate?: string
  monumentType?: string
  monumentScope?: string
  photoLink?: string
  raw: MonumentRecord
}

const selectedMarker = ref<MonumentMarker | null>(null)
const coLocatedMarkers = ref<MonumentMarker[]>([])
const showSidebar = ref(false)
const showBottomSheet = ref(false)
const isBottomSheetExpanded = ref(false)
const bottomSheetRef = ref<HTMLElement | null>(null)

const isMobile = ref(false)

const touchStartY = ref(0)
const touchCurrentY = ref(0)

const config = useRuntimeConfig()
const baseApiUrl = config.public.apiBaseUrl as string
const router = useRouter()
const navControl = new maplibregl.NavigationControl()

// ---------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------

function capitalizeEachWord(str: string) {
  return str
    .replace(/-/g, ' ')
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
}

function isValidUrl(string: string | undefined | null): boolean {
  if (!string) return false
  try {
    const url = new URL(string)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

async function fetchJsonData<T = any>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { method: 'GET' })
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }
    return (await response.json()) as T
  } catch (error) {
    console.error('Fetch error:', error)
    return null
  }
}

// Compute bounds from a GeoJSON FeatureCollection
function getGeoJsonBounds(data: any) {
  if (!data || !data.features || data.features.length === 0) return null

  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  for (const feature of data.features) {
    if (!feature.geometry) continue
    const { type, coordinates } = feature.geometry as {
      type: string
      coordinates: any
    }

    const addCoord = ([lng, lat]: [number, number]) => {
      if (lng < minLng) minLng = lng
      if (lat < minLat) minLat = lat
      if (lng > maxLng) maxLng = lng
      if (lat > maxLat) maxLat = lat
    }

    if (type === 'Point') {
      addCoord(coordinates)
    } else if (type === 'MultiPoint' || type === 'LineString') {
      coordinates.forEach(addCoord)
    } else if (type === 'MultiLineString' || type === 'Polygon') {
      coordinates.flat().forEach(addCoord)
    } else if (type === 'MultiPolygon') {
      coordinates.flat(2).forEach(addCoord)
    }
  }

  if (!isFinite(minLng)) return null
  return [
    [minLng, minLat],
    [maxLng, maxLat]
  ] as [[number, number], [number, number]]
}

function normalizeMonument(record: MonumentRecord): MonumentMarker {
  const titleSlug = capitalizeEachWord(
    record.slug || record.monument_function || record.object_number || ''
  )

  // Extract coordinates from geojson
  const coords: [number, number] = record.geojson?.coordinates || [0, 0]

  return {
    id: String(record.id),
    slug: record.slug,
    title: `${titleSlug} - Digitale Denkmalkarte`,
    description: record.description || '',
    coords,
    monumentFunction: record.monument_function,
    street: record.street,
    housenumber: record.housenumber,
    postcode: record.postcode,
    city: record.city,
    lastUpdate: record.last_update,
    monumentType: record.monument_type,
    monumentScope: record.monument_scope,
    photoLink: record.photo_link,
    raw: record
  }
}

function updateHeadForMarker(marker: MonumentMarker | null) {
  if (!marker) return

  const fullTitle = marker.title || 'Digitale Denkmalkarte'
  const slugPath = marker.slug ? `/${marker.slug}` : '/'

  useHead({
    title: fullTitle,
    meta: [
      { property: 'og:title', content: fullTitle },
      { property: 'og:url', content: `${window.location.origin}${slugPath}` }
    ]
  })
}

function updateIsMobile() {
  if (typeof window === 'undefined') return
  isMobile.value = window.innerWidth < 1024
}

// ---------------------------------------------------------------------
// SELECTION (two symbol layers)
// ---------------------------------------------------------------------

function updateSelectionFilters() {
  if (!map.value) return

  const baseFilter: any[] = ['all', ['!', ['has', 'point_count']]]

  if (
    !map.value.getLayer('monuments-unclustered-default') ||
    !map.value.getLayer('monuments-unclustered-selected')
  ) {
    return
  }

  if (selectedFeatureId.value == null) {
    map.value.setFilter('monuments-unclustered-default', baseFilter)
    map.value.setFilter('monuments-unclustered-selected', [
      'all',
      ['!', ['has', 'point_count']],
      ['==', ['id'], -1]
    ])
  } else {
    map.value.setFilter('monuments-unclustered-default', [
      'all',
      ['!', ['has', 'point_count']],
      ['!=', ['id'], selectedFeatureId.value]
    ])
    map.value.setFilter('monuments-unclustered-selected', [
      'all',
      ['!', ['has', 'point_count']],
      ['==', ['id'], selectedFeatureId.value]
    ])
  }
}

function setSelectedFeatureById(id: number | string | null) {
  selectedFeatureId.value = id
  updateSelectionFilters()
}

function reapplySelectedFeature() {
  updateSelectionFilters()
}

// ---------------------------------------------------------------------
// DATA FETCHING
// ---------------------------------------------------------------------

async function fetchMonumentPointsByBounds() {
  if (!map.value) return
  const bounds = map.value.getBounds()

  const bbox = {
    xmin: bounds.getWest(),
    ymin: bounds.getSouth(),
    xmax: bounds.getEast(),
    ymax: bounds.getNorth()
  }

  const url = `${baseApiUrl}/monument/v1/bounds?xmin=${bbox.xmin}&ymin=${bbox.ymin}&xmax=${bbox.xmax}&ymax=${bbox.ymax}`
  const data = await fetchJsonData<any>(url)
  if (!data) return

  updateMonumentsSource(data)
  reapplySelectedFeature()
}

async function fetchMonumentPointsByPosition(lat: number, lng: number) {
  const url = `${baseApiUrl}/monument/v1/radius?lat=${lat}&lng=${lng}`
  const data = await fetchJsonData<any>(url)
  if (!data) return

  updateMonumentsSource(data)
  reapplySelectedFeature()
}

async function fetchMonumentDetailBySlug(slug: string, options = { moveMap: true }) {
  const url = `${baseApiUrl}/monument/v1/details?slug=${slug}`
  const data = await fetchJsonData<MonumentRecord[]>(url)

  if (!data || !data[0]) return null

  const record = data[0]
  const marker = normalizeMonument(record)

  selectedMarker.value = marker
  coLocatedMarkers.value = []
  updateHeadForMarker(marker)

  const geoJsonData = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: record.id,
        geometry: record.geojson,
        properties: {
          label: record.label,
          slug: record.slug
        }
      }
    ]
  }

  updateMonumentsSource(geoJsonData)
  setSelectedFeatureById(record.id)

  if (options.moveMap && map.value && record.geojson && record.geojson.coordinates) {
    const [lng, lat] = record.geojson.coordinates as [number, number]
    map.value.easeTo({ center: [lng, lat], zoom: zoomLevelDetail })
  }

  openSheetForDevice()

  return marker
}

async function fetchMonumentDetailById(
  id: number,
  options: { moveMap?: boolean; pushRoute?: boolean } = { moveMap: false, pushRoute: true }
) {
  const url = `${baseApiUrl}/monument/v1/details?monument_id=${id}`
  const data = await fetchJsonData<MonumentRecord[]>(url)

  if (!data || !data[0]) return null

  const record = data[0]
  const marker = normalizeMonument(record)

  if (options.pushRoute) {
    // Use History API directly to avoid triggering route navigation
    const newPath = record.slug ? `/${record.slug}` : '/'
    window.history.replaceState({}, '', newPath)
  }

  selectedMarker.value = marker
  coLocatedMarkers.value = []
  updateHeadForMarker(marker)

  setSelectedFeatureById(record.id)

  if (options.moveMap && map.value && record.geojson && record.geojson.coordinates) {
    const [lng, lat] = record.geojson.coordinates as [number, number]
    map.value.easeTo({ center: [lng, lat], zoom: zoomLevelDetail })
  }

  openSheetForDevice()

  return marker
}

// ---------------------------------------------------------------------
// MAP SOURCES / LAYERS
// ---------------------------------------------------------------------

function addMonumentsSourceAndLayers(initialData?: any) {
  if (!map.value) return

  if (!map.value.getSource('monuments')) {
    map.value.addSource('monuments', {
      type: 'geojson',
      data:
        initialData ||
        ({
          type: 'FeatureCollection',
          features: []
        } as any),
      cluster: true,
      clusterRadius: 50,
      clusterMaxZoom: 19
    })

    map.value.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'monuments',
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': 18,
        'circle-opacity': 0.8,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-color': '#666666'
      }
    })

    map.value.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'monuments',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        'text-size': 12
      }
    })

    map.value.addLayer({
      id: 'monuments-unclustered-default',
      type: 'symbol',
      source: 'monuments',
      filter: ['all', ['!', ['has', 'point_count']]],
      layout: {
        'icon-image': 'marker-default',
        'icon-allow-overlap': true
      }
    })

    map.value.addLayer({
      id: 'monuments-unclustered-selected',
      type: 'symbol',
      source: 'monuments',
      filter: ['all', ['!', ['has', 'point_count']], ['==', ['id'], -1]],
      layout: {
        'icon-image': 'marker-selected',
        'icon-allow-overlap': true
      }
    })

    // Cluster hover cursor
    map.value.on('mouseenter', 'clusters', () => {
      map.value!.getCanvas().style.cursor = 'pointer'
    })
    map.value.on('mouseleave', 'clusters', () => {
      map.value!.getCanvas().style.cursor = ''
    })

    // Cluster click to zoom and uncluster
    map.value.on('click', 'clusters', (e: any) => {
      const features = map.value!.queryRenderedFeatures(e.point, {
        layers: ['clusters']
      })
      
      if (!features.length) return

      const coordinates = (features[0].geometry as any).coordinates as [number, number]
      const currentZoom = map.value!.getZoom()
      
      // Simply zoom in by 2 levels, which should eventually uncluster at zoom 20+
      const targetZoom = Math.min(currentZoom + 2, 20)
      
      map.value!.easeTo({
        center: coordinates,
        zoom: targetZoom,
        duration: 500
      })
    })

    // Marker hover cursor
    map.value.on('mouseenter', 'monuments-unclustered-default', () => {
      map.value!.getCanvas().style.cursor = 'pointer'
    })
    map.value.on('mouseleave', 'monuments-unclustered-default', () => {
      map.value!.getCanvas().style.cursor = ''
    })

    map.value.on('click', 'monuments-unclustered-default', async (e: any) => {
      const feature = e.features && e.features[0]
      if (!feature) return
      const id = feature.id as number
      await fetchMonumentDetailById(id, { moveMap: false, pushRoute: true })
    })
  }
}

function updateMonumentsSource(data: any) {
  if (!map.value || !map.value.isStyleLoaded()) return

  const src = map.value.getSource('monuments') as any
  if (!src) {
    addMonumentsSourceAndLayers(data)
  } else {
    src.setData(data)
  }

  if (!isBoundsSet.value) {
    const b = getGeoJsonBounds(data)
    if (b) {
      map.value.fitBounds(b, { padding: 20 })
      isBoundsSet.value = true
    }
  }

  reapplySelectedFeature()
}

// ---------------------------------------------------------------------
// UI CONTROL: SIDEBAR / BOTTOM SHEET
// ---------------------------------------------------------------------

function openSheetForDevice() {
  updateIsMobile()

  if (isMobile.value) {
    showBottomSheet.value = true
    showSidebar.value = false
  } else {
    showSidebar.value = true
    showBottomSheet.value = false
  }
}

function closeSheet() {
  showSidebar.value = false
  showBottomSheet.value = false
  isBottomSheetExpanded.value = false
  selectedMarker.value = null
  coLocatedMarkers.value = []
  selectedFeatureId.value = null
  updateSelectionFilters()
}

function toggleBottomSheet() {
  if (!isMobile.value) return
  isBottomSheetExpanded.value = !isBottomSheetExpanded.value
}

function handleTouchStart(e: TouchEvent) {
  if (!isMobile.value || !e.touches[0]) return
  touchStartY.value = e.touches[0].clientY
  touchCurrentY.value = touchStartY.value
}

function handleTouchMove(e: TouchEvent) {
  if (!isMobile.value || !e.touches[0]) return
  touchCurrentY.value = e.touches[0].clientY
}

function handleTouchEnd() {
  if (!isMobile.value) return
  const deltaY = touchCurrentY.value - touchStartY.value
  const threshold = 40

  if (deltaY < -threshold) {
    isBottomSheetExpanded.value = true
  } else if (deltaY > threshold) {
    if (isBottomSheetExpanded.value) {
      isBottomSheetExpanded.value = false
    } else {
      closeSheet()
    }
  }

  touchStartY.value = 0
  touchCurrentY.value = 0
}

function handleCoLocatedSelect(id: string) {
  if (!id) return
  fetchMonumentDetailById(Number(id), { moveMap: true, pushRoute: true })
}

// ---------------------------------------------------------------------
// HANDLE MAP LOAD/DESTROY (from MapLibreBase)
// ---------------------------------------------------------------------

function handleMapLoaded(mapInstance: MapLibreMap) {
  map.value = mapInstance
  mapLoaded.value = true

  try {
    map.value.removeControl(navControl)
  } catch {
    // ignore
  }
  map.value.addControl(navControl, 'bottom-right')

  const initLayers = async () => {
    try {
      const defaultResponse = await fetch(markerDefault)
      const defaultBlob = await defaultResponse.blob()
      const defaultImageBitmap = await createImageBitmap(defaultBlob)
      if (!map.value!.hasImage('marker-default')) {
        map.value!.addImage('marker-default', defaultImageBitmap)
      }

      const selectedResponse = await fetch(markerSelected)
      const selectedBlob = await selectedResponse.blob()
      const selectedImageBitmap = await createImageBitmap(selectedBlob)
      if (!map.value!.hasImage('marker-selected')) {
        map.value!.addImage('marker-selected', selectedImageBitmap)
      }
    } catch (error) {
      console.error('Error loading marker images:', error)
    }

    addMonumentsSourceAndLayers()

    map.value!.on('moveend', fetchMonumentPointsByBounds)

    map.value!.on('click', (e: any) => {
      const features = map.value!.queryRenderedFeatures(e.point, {
        layers: ['monuments-unclustered-default', 'clusters']
      })
      if (!features.length) {
        closeSheet()
      }
    })

    document.getElementById('geoLocation')?.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement
      if (target.name === 'myLocation' && target.checked) {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords
              fetchMonumentPointsByPosition(latitude, longitude)
              map.value!.easeTo({ center: [longitude, latitude], zoom: 16 })
            },
            (error) => {
              console.error('Error obtaining geolocation:', error.message)
            }
          )
        } else {
          console.error('Geolocation is not supported by this browser.')
        }
      }
    })

    const path = decodeURIComponent(window.location.pathname)
    const screen = path === '/' ? 'home' : path.slice(1)

    if (screen === 'home') {
      map.value!.setCenter(centerDefault)
      map.value!.setZoom(defaultZoom)
      fetchMonumentPointsByBounds()
    } else {
      await fetchMonumentDetailBySlug(screen, { moveMap: true })
    }

    handleWindowSize()
    window.addEventListener('resize', handleWindowSize)
  }

  if (mapInstance.isStyleLoaded()) {
    initLayers()
  } else {
    mapInstance.on('load', initLayers)
  }
}

function handleMapDestroyed() {
  map.value = null
  mapLoaded.value = false
  window.removeEventListener('resize', handleWindowSize)
}

// ---------------------------------------------------------------------
// WINDOW / NAV CONTROL
// ---------------------------------------------------------------------

function handleWindowSize() {
  if (!map.value) return
  updateIsMobile()

  const position = isMobile.value ? 'bottom-right' : 'top-left'

  try {
    map.value.removeControl(navControl)
  } catch {
    // ignore
  }
  map.value.addControl(navControl, position)
}

// ---------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------

onMounted(() => {
  updateIsMobile()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowSize)
})
</script>


<style scoped>
.monuments-map {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  --sidebar-width: 420px;
  --bottom-sheet-height: 260px;
  transition: padding-left 0.25s ease, padding-bottom 0.25s ease;
}

.monuments-map--sidebar-open {
  padding-left: var(--sidebar-width);
}

.monuments-map--bottom-sheet-open {
  padding-bottom: var(--bottom-sheet-height);
}

.monuments-map__sidebar {
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--sidebar-width);
  max-width: 80vw;
  background: var(--surface-primary);
  box-shadow: 6px 0 24px rgba(15, 23, 42, 0.2);
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: transform 0.25s ease, opacity 0.25s ease;
  z-index: 3;
}

.slide-in-enter-active,
.slide-in-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.slide-in-enter-from,
.slide-in-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-in-enter-to,
.slide-in-leave-from {
  transform: translateX(0);
  opacity: 1;
}

.monuments-map__sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-shrink: 0;
}

.monuments-map__sidebar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.25rem;
}

.monuments-map__close {
  border: none;
  background: var(--surface-muted);
  color: var(--color-text);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.25rem;
  line-height: 1;
}

.monuments-map__bottom-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--surface-primary);
  box-shadow: 0 -10px 30px rgba(15, 23, 42, 0.2);
  padding: 1rem 1.5rem 1.5rem;
  max-height: var(--bottom-sheet-height);
  height: var(--bottom-sheet-height);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 3;
  overflow: hidden;
  transition: max-height 0.3s ease, height 0.3s ease;
  touch-action: pan-y;
}

.monuments-map__bottom-sheet--expanded {
  max-height: 80vh;
  height: 80vh;
}

.monuments-map__bottom-sheet-handle {
  width: 50px;
  height: 5px;
  background: var(--border-soft);
  border-radius: 999px;
  margin: 0 auto 0.5rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.monuments-map__bottom-sheet-handle:hover {
  background: var(--color-text);
  opacity: 0.5;
}

.monuments-map__bottom-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.monuments-map__bottom-sheet-title {
  margin: 0;
  font-size: 1.1rem;
}

.monuments-map__bottom-sheet-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 0.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(12%);
  opacity: 0;
}
</style>