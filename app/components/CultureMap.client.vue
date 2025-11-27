<template>
  <div
    class="culture-map"
    :class="{
      'culture-map--sidebar-open': showSidebar,
      'culture-map--bottom-sheet-open': showBottomSheet
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
        class="culture-map__sidebar"
        role="complementary"
        aria-label="Location details"
      >
        <div class="culture-map__sidebar-header">
          <h2>{{ selectedMarker.title }}</h2>
          <button
            class="culture-map__close"
            type="button"
            @click="closeSheet"
            aria-label="Close details"
          >
            ×
          </button>
        </div>

        <div class="culture-map__sidebar-content">
          <MarkerDetailsCulture
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
        class="culture-map__bottom-sheet"
        :class="{ 'culture-map__bottom-sheet--expanded': isBottomSheetExpanded }"
        role="dialog"
        aria-modal="true"
        aria-label="Location details"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <div
          class="culture-map__bottom-sheet-handle"
          aria-hidden="true"
          @click="toggleBottomSheet"
        />
        <div class="culture-map__bottom-sheet-header">
          <h2 class="culture-map__bottom-sheet-title">
            {{ selectedMarker.artist }}
          </h2>
          <button
            class="culture-map__close"
            type="button"
            @click="closeSheet"
            aria-label="Close details"
          >
            ×
          </button>
        </div>

        <div class="culture-map__bottom-sheet-content">
          <MarkerDetailsCulture
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
import MarkerDetailsCulture from '~/components/MarkerDetailsCulture.vue'

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

type ArtworkRecord = {
  number: string
  artwork: string
  artist: string | null
  year_of_production: string | null
  year_of_installation: string | null
  material: string | null
  location: string
  address: string
  commissioner_owner: string | null
  maintenance_responsibility: string | null
  remarks: string | null
  sources: string | null
  category: string
  contact: string | null
  description: string | null
  measurements: string | null
  condition: string | null
  latitude: string | number
  longitude: string | number
}

type ArtworkMarkerData = {
  id: string
  slug?: string
  title: string
  description: string
  coords: [number, number]
  artist?: string
  street?: string
  housenumber?: string
  postcode?: string
  city?: string
  lastUpdate?: string
  category?: string
  remarks?: string
  photoLink?: string
  measurements?: string
  condition?: string
  raw: ArtworkRecord
}

const selectedMarker = ref<ArtworkMarkerData | null>(null)
const coLocatedMarkers = ref<ArtworkMarkerData[]>([])
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

function normalizeArtwork(record: ArtworkRecord): ArtworkMarkerData {
  // Convert latitude/longitude to numbers if they're strings
  const lat = typeof record.latitude === 'string' ? parseFloat(record.latitude) : record.latitude
  const lon = typeof record.longitude === 'string' ? parseFloat(record.longitude) : record.longitude
  const coords: [number, number] = [lon, lat]
  
  // Build description from the description field or construct from fields
  let description = record.description || record.artwork
  if (!record.description) {
    if (record.artist) description += ` von ${record.artist}`
    if (record.year_of_installation) description += ` (${record.year_of_installation})`
    if (record.material) description += `, Material: ${record.material}`
  }

  return {
    id: record.number,
    slug: undefined,
    title: record.artwork,
    description,
    coords,
    artist: record.artist || undefined,
    street: record.address,
    housenumber: undefined,
    postcode: undefined,
    city: 'Flensburg',
    lastUpdate: record.year_of_installation || undefined,
    category: record.category || undefined,
    remarks: record.remarks || undefined,
    photoLink: undefined,
    measurements: record.measurements || undefined,
    condition: record.condition || undefined,
    raw: record
  }
}

function updateHeadForMarker(marker: ArtworkMarkerData | null) {
  if (!marker) return

  const fullTitle = marker.title || 'Digitale Kulturkarte'
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
    !map.value.getLayer('artworks-unclustered-default') ||
    !map.value.getLayer('artworks-unclustered-selected')
  ) {
    return
  }

  if (selectedFeatureId.value == null) {
    map.value.setFilter('artworks-unclustered-default', baseFilter)
    map.value.setFilter('artworks-unclustered-selected', [
      'all',
      ['!', ['has', 'point_count']],
      ['==', ['id'], -1]
    ])
  } else {
    map.value.setFilter('artworks-unclustered-default', [
      'all',
      ['!', ['has', 'point_count']],
      ['!=', ['id'], selectedFeatureId.value]
    ])
    map.value.setFilter('artworks-unclustered-selected', [
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

async function loadArtworksFromJSON() {
  try {
    const response = await fetch('/kunstwerke_flensburg.json')
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }
    const artworks = await response.json() as ArtworkRecord[]
    
    // Filter out artworks without valid coordinates
    const validArtworks = artworks.filter((artwork) => {
      const lat = typeof artwork.latitude === 'string' ? parseFloat(artwork.latitude) : artwork.latitude
      const lon = typeof artwork.longitude === 'string' ? parseFloat(artwork.longitude) : artwork.longitude
      return !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0
    })
    
    // Convert to GeoJSON - use numeric IDs for MapLibre compatibility
    const geoJsonData = {
      type: 'FeatureCollection',
      features: validArtworks.map((artwork) => {
        const lat = typeof artwork.latitude === 'string' ? parseFloat(artwork.latitude) : artwork.latitude
        const lon = typeof artwork.longitude === 'string' ? parseFloat(artwork.longitude) : artwork.longitude
        const numericId = parseInt(artwork.number, 10)
        
        return {
          type: 'Feature',
          id: isNaN(numericId) ? 0 : numericId, // Ensure valid numeric ID
          geometry: {
            type: 'Point',
            coordinates: [lon, lat]
          },
          properties: {
            originalId: artwork.number || '', // Keep original string ID in properties
            title: artwork.artwork || 'Untitled',
            artist: artwork.artist || null,
            year: artwork.year_of_installation || null,
            material: artwork.material || null,
            location: artwork.location || null,
            address: artwork.address || null,
            category: artwork.category || null,
            description: artwork.description || null
          }
        }
      })
    }
    
    return geoJsonData
  } catch (error) {
    console.error('Error loading artworks:', error)
    return null
  }
}

async function fetchArtworkPointsByBounds() {
  // For local JSON, load all artworks at once
  const data = await loadArtworksFromJSON()
  if (!data) return

  updateArtworksSource(data)
  reapplySelectedFeature()
}

async function fetchArtworkPointsByPosition(lat: number, lng: number) {
  // For local JSON, just load all artworks
  const data = await loadArtworksFromJSON()
  if (!data) return

  updateArtworksSource(data)
  reapplySelectedFeature()
  
  // Center on the position
  if (map.value) {
    map.value.easeTo({ center: [lng, lat], zoom: 16 })
  }
}

async function fetchArtworkById(id: string) {
  try {
    const response = await fetch('/kunstwerke_flensburg.json')
    if (!response.ok) return null
    
    const artworks = await response.json() as ArtworkRecord[]
    const artwork = artworks.find(a => a.number === id)
    
    return artwork ? normalizeArtwork(artwork) : null
  } catch (error) {
    console.error('Error fetching artwork:', error)
    return null
  }
}

async function fetchArtworkDetailBySlug(slug: string, options = { moveMap: true }) {
  // Not used for local JSON data
  return null
}

async function fetchArtworkDetailById(
  id: number | string,
  options: { moveMap?: boolean; pushRoute?: boolean } = { moveMap: false, pushRoute: true }
) {
  const marker = await fetchArtworkById(String(id))
  if (!marker) return null

  selectedMarker.value = marker
  coLocatedMarkers.value = []
  updateHeadForMarker(marker)

  // Convert string ID to numeric ID for MapLibre filter
  const numericId = parseInt(String(id), 10)
  setSelectedFeatureById(isNaN(numericId) ? null : numericId)

  if (options.moveMap && map.value && marker.coords) {
    const [lng, lat] = marker.coords
    map.value.easeTo({ center: [lng, lat], zoom: zoomLevelDetail })
  }

  openSheetForDevice()

  return marker
}

// ---------------------------------------------------------------------
// MAP SOURCES / LAYERS
// ---------------------------------------------------------------------

function addArtworksSourceAndLayers(initialData?: any) {
  if (!map.value) return

  if (!map.value.getSource('artworks')) {
    map.value.addSource('artworks', {
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
      source: 'artworks',
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
      source: 'artworks',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        'text-size': 12
      }
    })

    map.value.addLayer({
      id: 'artworks-unclustered-default',
      type: 'symbol',
      source: 'artworks',
      filter: ['all', ['!', ['has', 'point_count']]],
      layout: {
        'icon-image': 'marker-default',
        'icon-allow-overlap': true
      }
    })

    map.value.addLayer({
      id: 'artworks-unclustered-selected',
      type: 'symbol',
      source: 'artworks',
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
    map.value.on('mouseenter', 'artworks-unclustered-default', () => {
      map.value!.getCanvas().style.cursor = 'pointer'
    })
    map.value.on('mouseleave', 'artworks-unclustered-default', () => {
      map.value!.getCanvas().style.cursor = ''
    })

    map.value.on('click', 'artworks-unclustered-default', async (e: any) => {
      const feature = e.features && e.features[0]
      if (!feature) return
      // Use originalId from properties (string) or fallback to feature.id
      const id = feature.properties?.originalId || String(feature.id)
      await fetchArtworkDetailById(id, { moveMap: false, pushRoute: false })
    })
  }
}

function updateArtworksSource(data: any) {
  if (!map.value || !map.value.isStyleLoaded()) return

  const src = map.value.getSource('artworks') as any
  if (!src) {
    addArtworksSourceAndLayers(data)
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
  fetchArtworkDetailById(id, { moveMap: true, pushRoute: false })
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

    // Load artworks from local JSON immediately
    console.log('Loading artworks from JSON...')
    const artworksData = await loadArtworksFromJSON()
    
    if (artworksData) {
      console.log('Artworks loaded:', artworksData.features.length, 'features')
      console.log('Sample feature:', artworksData.features[0])
      
      // Add source and layers WITH the data
      addArtworksSourceAndLayers(artworksData)
      
      // Wait for the map to process the data
      setTimeout(() => {
        // Check source data directly
        const source = map.value!.getSource('artworks') as any
        console.log('Source exists:', !!source)
        console.log('Source type:', source?.type)
        
        // Try to get the source's internal data
        if (source && source._data) {
          console.log('Source internal data features:', source._data?.features?.length || 0)
        }
        
        // Query rendered features on the map
        const renderedClusters = map.value!.queryRenderedFeatures({ layers: ['clusters'] })
        const renderedMarkers = map.value!.queryRenderedFeatures({ layers: ['artworks-unclustered-default'] })
        console.log('Rendered clusters:', renderedClusters.length)
        console.log('Rendered markers:', renderedMarkers.length)
        
        // Check layers
        const layersExist = [
          'clusters',
          'cluster-count', 
          'artworks-unclustered-default',
          'artworks-unclustered-selected'
        ].every(layerId => map.value!.getLayer(layerId))
        console.log('All layers exist:', layersExist)
        
        // Fit bounds to show all artworks
        const bounds = getGeoJsonBounds(artworksData)
        if (bounds) {
          console.log('Fitting bounds:', bounds)
          map.value!.fitBounds(bounds, { padding: 100, duration: 1000 })
          isBoundsSet.value = true
        }
      }, 500)
    } else {
      console.error('Failed to load artworks')
      // Still create empty layers
      addArtworksSourceAndLayers()
    }

    // Don't fetch on moveend for local JSON - data is already loaded
    // map.value!.on('moveend', fetchArtworkPointsByBounds)

    map.value!.on('click', (e: any) => {
      const features = map.value!.queryRenderedFeatures(e.point, {
        layers: ['artworks-unclustered-default', 'clusters']
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
              // Don't reload artworks, just center on position
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
.culture-map {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  --sidebar-width: 420px;
  --bottom-sheet-height: 260px;
  transition: padding-left 0.25s ease, padding-bottom 0.25s ease;
}

.culture-map--sidebar-open {
  padding-left: var(--sidebar-width);
}

.culture-map--bottom-sheet-open {
  padding-bottom: var(--bottom-sheet-height);
}

.culture-map__sidebar {
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

.culture-map__sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-shrink: 0;
}

.culture-map__sidebar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.25rem;
}

.culture-map__close {
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

.culture-map__bottom-sheet {
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

.culture-map__bottom-sheet--expanded {
  max-height: 80vh;
  height: 80vh;
}

.culture-map__bottom-sheet-handle {
  width: 50px;
  height: 5px;
  background: var(--border-soft);
  border-radius: 999px;
  margin: 0 auto 0.5rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.culture-map__bottom-sheet-handle:hover {
  background: var(--color-text);
  opacity: 0.5;
}

.culture-map__bottom-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.culture-map__bottom-sheet-title {
  margin: 0;
  font-size: 1.1rem;
}

.culture-map__bottom-sheet-content {
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