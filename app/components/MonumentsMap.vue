<template>
  <div class="monuments-map" :class="{
    'monuments-map--sidebar-open': showSidebar,
    'monuments-map--bottom-sheet-open': showBottomSheet
  }">
    <MapLibreBase ref="mapBaseRef" :center="centerDefault" :zoom="defaultZoom" @map-loaded="handleMapLoaded" />

    <transition name="slide-in">
      <aside v-if="selectedMarker && !isMobile" class="monuments-map__sidebar" role="complementary"
        aria-label="Location details">
        <div class="monuments-map__sidebar-header">
          <h2>{{ selectedMarker.title }}</h2>
          <button class="monuments-map__close" type="button" @click="closeSheet" aria-label="Close details">×</button>
        </div>
        <MarkerDetails :marker="selectedMarker" variant="sidebar" :co-located="coLocatedMarkers"
          @select-marker="handleCoLocatedSelect" />
      </aside>
    </transition>

    <transition name="slide-up">
      <section v-if="selectedMarker && isMobile" ref="bottomSheetRef" class="monuments-map__bottom-sheet"
        :class="{ 'monuments-map__bottom-sheet--expanded': isBottomSheetExpanded }" role="dialog" aria-modal="true"
        aria-label="Location details" @touchstart="handleTouchStart" @touchmove="handleTouchMove"
        @touchend="handleTouchEnd">
        <div class="monuments-map__bottom-sheet-handle" aria-hidden="true" @click="toggleBottomSheet" />
        <div class="monuments-map__bottom-sheet-header">
          <h2 class="monuments-map__bottom-sheet-title">{{ selectedMarker.monumentFunction }}</h2>
          <button class="monuments-map__close" type="button" @click="closeSheet" aria-label="Close details">
            ×
          </button>
        </div>

        <div class="monuments-map__bottom-sheet-content">
          <MarkerDetails :marker="selectedMarker" variant="sheet" :co-located="coLocatedMarkers"
            @select-marker="handleCoLocatedSelect" />
        </div>
      </section>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap } from 'maplibre-gl'
import type { MarkerDetailsData } from '~/types/markers'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()

const centerDefault: [number, number] = [9.53205485, 54.79443515] // Flensburg
const defaultZoom = 12
const mobileBreakpoint = 960
const markerIconDefaultUrl =
  typeof window !== 'undefined' ? new URL('/marker-icon-default.webp', window.location.origin).toString() : '/marker-icon-default.webp'
const markerIconActiveUrl =
  typeof window !== 'undefined' ? new URL('/marker-icon-active.webp', window.location.origin).toString() : '/marker-icon-active.webp'

const apiBase = import.meta.env.VITE_API_URL || ''

const mapBaseRef = ref<InstanceType<typeof MapLibreBase> | null>(null)
const bottomSheetRef = ref<HTMLElement | null>(null)
let map: MapLibreMap | null = null
const pendingSlug = ref<string | null>(null)
const selectedMarker = ref<MarkerDetailsData | null>(null)
const coLocatedMarkers = ref<MarkerDetailsData[]>([])
let selectedFeatureId: string | null = null
let selectedClusterId: number | null = null
const isMobile = ref(false)
let mediaQuery: MediaQueryList | null = null
let mediaQueryCleanup: (() => void) | null = null
let monumentsSourceReady = false
let lastFeatureId: string | null = null

const isBottomSheetExpanded = ref(false)
let touchStartY = 0
let touchStartTime = 0
let isDragging = false

const showSidebar = computed(() => Boolean(selectedMarker.value) && !isMobile.value)
const showBottomSheet = computed(() => Boolean(selectedMarker.value) && isMobile.value)

const updateViewport = () => {
  isMobile.value = window.innerWidth < mobileBreakpoint
}

const applyMarkerSelection = (marker: MarkerDetailsData | null, group: MarkerDetailsData[] = []) => {
  coLocatedMarkers.value = group
  selectedMarker.value = marker
  const id = marker?.id || null
  if (marker) {
    ensureMarkerInSource(marker)
  }
  lastFeatureId = id
  console.log('setFeatureSelection', id)
  setFeatureSelection(id)
  // Clear any cluster highlight when selecting a concrete marker
  setClusterSelection(null)

  // Navigate to the monument's detail page if slug is available
  if (marker?.slug) {
    const currentSlug = typeof route.params.slug === 'string' ? route.params.slug : null
    if (currentSlug !== marker.slug) {
      if (typeof window !== 'undefined') {
        // Use History API to update the URL without a full navigation
        const newUrl = `/${marker.slug}`
        if (window.location.pathname !== newUrl) {
          window.history.replaceState({}, '', newUrl)
        }
      }
    }
  }
}

const handleCoLocatedSelect = (id: string) => {
  const next = coLocatedMarkers.value.find((m) => m.id === id)
  if (next) {
    applyMarkerSelection(next, coLocatedMarkers.value)
  }
}

const setClusterSelection = (clusterId: number | null) => {
  if (!map || !map.isStyleLoaded()) return
  if (selectedClusterId !== null && featureExistsInSource(selectedClusterId)) {
    map.setFeatureState({ source: 'monuments', id: selectedClusterId }, { selected: false })
  }
  selectedClusterId = clusterId
  if (clusterId !== null && featureExistsInSource(clusterId)) {
    map.setFeatureState({ source: 'monuments', id: clusterId }, { selected: true })
  }
}

const ensureMarkerInSource = (marker: MarkerDetailsData) => {
  if (!map || !map.isStyleLoaded()) return
  const source = map.getSource('monuments') as GeoJSONSource | undefined
  if (!source || !source.getData) return

  const data = source.getData() as any
  const features = Array.isArray(data?.features) ? data.features.slice() : []
  const markerId = marker.id ? String(marker.id) : null
  if (!markerId || !features.length) return

  const exists = features.some((f: any) => String(f.id) === markerId || String(f?.properties?.id) === markerId)
  if (exists) return

  features.push({
    type: 'Feature',
    id: markerId,
    geometry: {
      type: 'Point',
      coordinates: [marker.coords[1], marker.coords[0]]
    },
    properties: {
      id: markerId,
      label: marker.title,
      description: marker.description
    }
  })

  source.setData({
    type: 'FeatureCollection',
    features
  } as any)
}

const selectMonumentBySlug = async (slug: string) => {
  if (!slug) return
  if (!map || !map.isStyleLoaded()) return
  const detail = await fetchMonumentDetailBySlug(slug)
  if (!detail) return

  if (map) {
    const center = [detail.coords[1], detail.coords[0]] as [number, number]
    // map.easeTo({ center, zoom: Math.max(map.getZoom(), 18) })
    // await refreshMonuments()
  }

  applyMarkerSelection(detail)
}

const handleMapLoaded = async (loadedMap: MapLibreMap) => {
  map = loadedMap

  updateViewport()
  mediaQuery = window.matchMedia(`(max-width: ${mobileBreakpoint - 1}px)`)
  mediaQuery.addEventListener('change', updateViewport)
  mediaQueryCleanup = () => mediaQuery?.removeEventListener('change', updateViewport)

  await ensureMarkerImages()

  map.addSource('monuments', {
    type: 'geojson',
    data: emptyFeatureCollection(),
    cluster: true,
    clusterMaxZoom: 18,
    clusterRadius: 50
  })
  monumentsSourceReady = true

  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'monuments',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#f59e0b', '#2563eb'],
      'circle-radius': ['step', ['get', 'point_count'], 18, 25, 22, 50, 28],
      'circle-opacity': 0.85
    }
  })

  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'monuments',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-size': 12
    },
    paint: {
      'text-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#000', '#fff']
    }
  })

  map.addLayer({
    id: 'unclustered-default',
    type: 'symbol',
    source: 'monuments',
    filter: ['all', ['!', ['has', 'point_count']]],
    layout: {
      'icon-image': 'marker-default',
      'icon-size': 1,
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true
    },
    paint: {
      'icon-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0, 1]
    }
  })

  map.addLayer({
    id: 'unclustered-active',
    type: 'symbol',
    source: 'monuments',
    filter: ['all', ['!', ['has', 'point_count']]],
    layout: {
      'icon-image': 'marker-active',
      'icon-size': 1,
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true
    },
    paint: {
      'icon-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 1, 0]
    }
  })

  map.on('click', 'clusters', (e) => zoomToCluster(e))
  map.on('click', 'unclustered-default', (e) => handleFeatureClick(e))
  // map.on('click', 'unclustered-active', (e) => handleFeatureClick(e))
  map.on('click', handleMapClick)
  map.on('moveend', triggerRefresh)

  if (pendingSlug.value) {
    await selectMonumentBySlug(pendingSlug.value)
  }
}

onUnmounted(() => {
  mediaQueryCleanup?.()
})

const zoomToCluster = async (e: MapLayerMouseEvent) => {
  e.preventDefault?.()
    ; (e.originalEvent as unknown as { stopPropagation?: () => void })?.stopPropagation?.()

  const feature = e.features?.[0]
  if (!map || !feature) return

  if (feature.geometry?.type === 'Point') {
    const coords = feature.geometry.coordinates as [number, number]
    const clusterId = feature.properties?.cluster_id
    const pointCount = feature.properties?.point_count || 0

    setClusterSelection(typeof clusterId === 'number' ? clusterId : null)

    // At max zoom, show accordion with same-location items instead of spiderfying
    if (map.getZoom() >= 18 && pointCount > 1 && typeof clusterId === 'number') {
      try {
        if (!map) return

        const source = map.getSource('monuments') as GeoJSONSource
        if (!source) {
          console.error('Monuments source not found')
          return
        }

        const leaves = await source.getClusterLeaves(clusterId, Math.max(pointCount, 100), 0)

        const groupDetails = await Promise.all(
          leaves.map(async (leaf) => {
            const leafProps = leaf.properties || {}
            const id = String(leafProps.id || leaf.id || '')
            if (!id) return null
            const detailData = await fetchMonumentDetail(id)
            const coordsFromLeaf =
              leaf.geometry?.type === 'Point' && Array.isArray(leaf.geometry.coordinates)
                ? (leaf.geometry.coordinates as [number, number])
                : coords

            return {
              title: detailData?.title || leafProps.label || 'Unbekannt',
              description: detailData?.description || leafProps.description || '',
              coords: detailData?.coords || [coordsFromLeaf[1], coordsFromLeaf[0]],
              id,
              slug: detailData?.slug,
              street: detailData?.street,
              housenumber: detailData?.housenumber,
              postcode: detailData?.postcode,
              city: detailData?.city,
              district: detailData?.district,
              municipality: detailData?.municipality,
              monumentType: detailData?.monumentType,
              monumentFunction: detailData?.monumentFunction,
              objectNumber: detailData?.objectNumber,
              lastUpdate: detailData?.lastUpdate,
              photoLink: detailData?.photoLink,
              detailLink: detailData?.detailLink
            } satisfies MarkerDetailsData
          })
        )

        const validGroup = groupDetails.filter(Boolean) as MarkerDetailsData[]
        if (validGroup.length > 1) {
          applyMarkerSelection(validGroup[0] || null, validGroup)
          await nextTick()
          return
        }
      } catch (error) {
        console.error('Error handling cluster selection:', error, error instanceof Error ? error.message : String(error))
      }
    }

    // Otherwise zoom to the cluster expansion level (or increment) as a fallback
    let targetZoom = Math.min(map.getZoom() + 2, 18)
    if (typeof clusterId === 'number') {
      try {
        const source = map.getSource('monuments') as GeoJSONSource
        if (source?.getClusterExpansionZoom) {
          targetZoom = await source.getClusterExpansionZoom(clusterId)
        }
      } catch (err) {
        console.error('Error getting cluster expansion zoom:', err)
      }
    }
    map.easeTo({ center: coords, zoom: targetZoom })
  }
}

const handleFeatureClick = async (e: MapLayerMouseEvent) => {
  e.preventDefault?.()
    ; (e.originalEvent as unknown as { stopPropagation?: () => void })?.stopPropagation?.()

  // Clear any cluster highlight when selecting a single feature
  setClusterSelection(null)

  const feature = e.features?.[0]
  if (!map || !feature) return
  const props = feature.properties || {}
  const id = String(props.id || '')

  if (!id) {
    console.warn('Clicked feature has no id')
    return
  }

  if (id === lastFeatureId) {
    // Reapply selection to ensure the active icon is visible on repeat clicks
    // setFeatureSelection(id)
    // await nextTick()
    return
  }

  const coords = feature.geometry.type === 'Point' ? (feature.geometry.coordinates as [number, number]) : null

  if (!coords) {
    console.warn('Clicked feature has no valid coordinates')
    return
  }

  const detailData = await fetchMonumentDetail(id)

  const markerData: MarkerDetailsData = {
    title: detailData?.title || props.label || 'Unknown',
    description: detailData?.description || props.description || '',
    coords: detailData?.coords || (coords ? [coords[1], coords[0]] : centerDefault),
    id,
    slug: detailData?.slug,
    street: detailData?.street,
    housenumber: detailData?.housenumber,
    postcode: detailData?.postcode,
    city: detailData?.city,
    district: detailData?.district,
    municipality: detailData?.municipality,
    monumentType: detailData?.monumentType,
    monumentFunction: detailData?.monumentFunction,
    objectNumber: detailData?.objectNumber,
    lastUpdate: detailData?.lastUpdate,
    photoLink: detailData?.photoLink,
    detailLink: detailData?.detailLink
  }

  // Gather any other markers rendered at the exact same coordinates to show in accordion
  const group: MarkerDetailsData[] = [markerData]
  /*
  if (coords) {
    const samePointFeatures = map.queryRenderedFeatures(e.point, {
      layers: ['unclustered-default', 'unclustered-active']
    })
    const clickedKey = coords.join(',')
    const seen = new Set<string>([id])

    for (const f of samePointFeatures) {
      const fCoords = f.geometry?.type === 'Point' ? (f.geometry.coordinates as [number, number]) : null
      if (!fCoords || fCoords.join(',') !== clickedKey) continue
      const fProps = f.properties || {}
      const fId = String(fProps.id || f.id || '')
      if (!fId || seen.has(fId)) continue
      seen.add(fId)

      const fDetail = await fetchMonumentDetail(fId)
      group.push({
        title: fDetail?.title || fProps.label || 'Unknown',
        description: fDetail?.description || fProps.description || '',
        coords: fDetail?.coords || [fCoords[1], fCoords[0]],
        id: fId,
        slug: fDetail?.slug,
        street: fDetail?.street,
        housenumber: fDetail?.housenumber,
        postcode: fDetail?.postcode,
        city: fDetail?.city,
        district: fDetail?.district,
        municipality: fDetail?.municipality,
        monumentType: fDetail?.monumentType,
        monumentFunction: fDetail?.monumentFunction,
        objectNumber: fDetail?.objectNumber,
        lastUpdate: fDetail?.lastUpdate,
        photoLink: fDetail?.photoLink,
        detailLink: fDetail?.detailLink
      })
    }
  }
  */

  applyMarkerSelection(group[0] || null, group)
  await nextTick()
}

const closeSheet = () => {
  applyMarkerSelection(null, [])
  isBottomSheetExpanded.value = false
  lastFeatureId = null
}

const toggleBottomSheet = () => {
    console.log('closeSheet', selectedMarker.value)

  isBottomSheetExpanded.value = !isBottomSheetExpanded.value
}

const handleTouchStart = (e: TouchEvent) => {
  const touch = e.touches[0]
  if (!touch) return
  touchStartY = touch.clientY
  touchStartTime = Date.now()
  isDragging = false
}

const handleTouchMove = (e: TouchEvent) => {
  if (!bottomSheetRef.value) return

  const touch = e.touches[0]
  if (!touch) return
  const deltaY = touch.clientY - touchStartY

  if (Math.abs(deltaY) > 10) {
    isDragging = true
  }

  if (isDragging && !isBottomSheetExpanded.value) {
    e.preventDefault()
  }
}

const handleTouchEnd = (e: TouchEvent) => {
  if (!isDragging) return

  const touch = e.changedTouches[0]
  if (!touch) return
  const deltaY = touch.clientY - touchStartY
  const deltaTime = Date.now() - touchStartTime
  const velocity = Math.abs(deltaY) / deltaTime

  if (deltaY > 50 && velocity > 0.3) {
    if (!isBottomSheetExpanded.value) {
      closeSheet()
    } else {
      isBottomSheetExpanded.value = false
    }
  }
  else if (deltaY < -50 && velocity > 0.3 && !isBottomSheetExpanded.value) {
    isBottomSheetExpanded.value = true
  }

  isDragging = false
}

const handleMapClick = (e: MapLayerMouseEvent) => {
  const features = map?.queryRenderedFeatures(e.point, {
    layers: ['unclustered-default', 'unclustered-active', 'clusters']
  })

  if (!features || features.length === 0) {
    if (selectedMarker.value) {
      closeSheet()
    }
    setClusterSelection(null)
  }
}

const refreshMonuments = async () => {
  if (!map || !map.isStyleLoaded() || !monumentsSourceReady) return

  const bounds = map.getBounds()

  const monuments = await fetchMonumentsByBounds({
    xmin: bounds.getWest(),
    ymin: bounds.getSouth(),
    xmax: bounds.getEast(),
    ymax: bounds.getNorth()
  })

  const source = map.getSource('monuments') as GeoJSONSource | undefined
  if (!source) {
    console.error('Source "monuments" not found')
    return
  }

  const features = monuments && monuments.length > 0 ? monuments : []

  const geojson = monumentsToGeoJson(features)

  source.setData(geojson as any)

  if (selectedClusterId !== null) {
    setClusterSelection(selectedClusterId)
  }

  if (selectedFeatureId) {
    setFeatureSelection(selectedFeatureId)
  }
}

const triggerRefresh = () => {
  void refreshMonuments()
}

const monumentsToGeoJson = (features: MarkerDetailsData[]) => {
  return {
    type: 'FeatureCollection',
    features: features.map((f) => ({
      type: 'Feature',
      id: f.id ? String(f.id) : undefined,
      geometry: {
        type: 'Point',
        coordinates: [f.coords[1], f.coords[0]]
      },
      properties: {
        id: f.id ? String(f.id) : undefined,
        label: f.title
      }
    }))
  }
}

type MonumentDetailResponse = Array<{
  id: string | number
  label?: string
  slug?: string
  description?: string
  geojson?: { type: string; coordinates: [number, number] } | any
  street?: string
  housenumber?: string
  postcode?: string
  city?: string
  district?: string
  municipality?: string
  monument_type?: string
  monument_function?: string
  object_number?: string
  last_update?: string
  photo_link?: string
  detail_link?: string
}>

// returns an array with coordinates: [longitude, latitude], id as string and label
const fetchMonumentsByBounds = async (bbox: {
  xmin: number
  ymin: number
  xmax: number
  ymax: number
}): Promise<MarkerDetailsData[] | null> => {
  if (!apiBase) {
    console.warn('No API base URL configured')
    return null
  }
  const url = `${apiBase}/monument/v1/bounds?xmin=${bbox.xmin}&ymin=${bbox.ymin}&xmax=${bbox.xmax}&ymax=${bbox.ymax}`

  const data = await fetchJson<{
    type: 'FeatureCollection'
    features: Array<{
      id: string | number
      geometry: { type: string; coordinates: [number, number] }
      properties: { label?: string }
    }>
  }>(url)

  if (!data?.features?.length) {
    console.warn('No features in API response')
    return null
  }

  return data.features
    .map((f) => {
      if (!f.geometry || !Array.isArray((f.geometry as any).coordinates)) return null
      const coords = (f.geometry as any).coordinates as [number, number]
      return {
        id: String(f.id),
        title: f.properties?.label || String(f.id),
        coords: [coords[1], coords[0]] as [number, number]
      }
    })
    .filter(Boolean) as MarkerDetailsData[]
}

const fetchMonumentDetail = async (id: string): Promise<MarkerDetailsData | null> => {
  if (!apiBase || !id) return null
  const url = `${apiBase}/monument/v1/details?monument_id=${encodeURIComponent(id)}`
  const data = await fetchJson<MonumentDetailResponse>(url)
  if (!data || !data[0]) return null

  const coords =
    (data[0].geojson as any)?.coordinates && Array.isArray((data[0].geojson as any).coordinates)
      ? (data[0].geojson as any).coordinates
      : null

  return {
    id: String(data[0].id),
    title: data[0].label || String(data[0].id),
    slug: data[0].slug,
    description: data[0].description || '',
    coords: coords ? ([coords[1], coords[0]] as [number, number]) : centerDefault,
    street: data[0].street,
    housenumber: data[0].housenumber,
    postcode: data[0].postcode,
    city: data[0].city,
    district: data[0].district,
    municipality: data[0].municipality,
    monumentType: data[0].monument_type,
    monumentFunction: data[0].monument_function,
    objectNumber: data[0].object_number,
    lastUpdate: data[0].last_update,
    photoLink: data[0].photo_link,
    detailLink: data[0].detail_link
  }
}

const fetchMonumentDetailBySlug = async (slug: string): Promise<MarkerDetailsData | null> => {
  if (!apiBase || !slug) return null
  const url = `${apiBase}/monument/v1/details?slug=${encodeURIComponent(slug)}`
  const data = await fetchJson<MonumentDetailResponse>(url)
  if (!data || !data[0]) return null

  const coords =
    (data[0].geojson as any)?.coordinates && Array.isArray((data[0].geojson as any).coordinates)
      ? (data[0].geojson as any).coordinates
      : null

  return {
    id: String(data[0].id),
    title: data[0].label || String(data[0].id),
    slug: data[0].slug,
    description: data[0].description || '',
    coords: coords ? ([coords[1], coords[0]] as [number, number]) : centerDefault,
    street: data[0].street,
    housenumber: data[0].housenumber,
    postcode: data[0].postcode,
    city: data[0].city,
    district: data[0].district,
    municipality: data[0].municipality,
    monumentType: data[0].monument_type,
    monumentFunction: data[0].monument_function,
    objectNumber: data[0].object_number,
    lastUpdate: data[0].last_update,
    photoLink: data[0].photo_link,
    detailLink: data[0].detail_link
  }
}

const fetchJson = async <T>(url: string): Promise<T | null> => {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Request failed: ${res.status}`)
    return (await res.json()) as T
  } catch (err) {
    console.error('Fetch error:', err)
    return null
  }
}

const emptyFeatureCollection = () => ({
  type: 'FeatureCollection' as const,
  features: []
})

const ensureMarkerImages = async () => {
  if (!map) return
  await Promise.all([
    addImageIfMissing('marker-default', markerIconDefaultUrl),
    addImageIfMissing('marker-active', markerIconActiveUrl)
  ])
}

const addImageIfMissing = async (name: string, url: string) => {
  if (!map) return

  try {
    const image = await map.loadImage(url)
    if (!map.hasImage(name)) {
      map.addImage(name, image.data)
    }
  } catch (error) {
    console.error(`Failed to load image ${name} from ${url}`, error)
  }
}

watch(
  () => route.params.slug,
  (slug) => {
    pendingSlug.value = typeof slug === 'string' ? slug : null
    if (pendingSlug.value && map) {
      void selectMonumentBySlug(pendingSlug.value)
    }
  },
  { immediate: true }
)

const setFeatureSelection = (id: string | null) => {
  const previousId = selectedFeatureId
  selectedFeatureId = id

  if (!map) return

  // Wait until map is fully idle (all data loaded)
  if (!map.isStyleLoaded()) {
    map.once("idle", () => {
      setFeatureSelection(selectedFeatureId)
    })
    return // <-- prevent recursion loop
  }

  console.log("Updating feature selection state:", { previousId, id })

  if (previousId) {
    map.setFeatureState(
      { source: "monuments", id: previousId },
      { selected: false }
    )
  }

  if (id) {
    map.setFeatureState(
      { source: "monuments", id },
      { selected: true }
    )
  }
}

const featureExistsInSource = (id: string | number) => {
  if (!map || !map.isStyleLoaded()) return false
  try {
    const features = map.querySourceFeatures('monuments', {
      filter: ['==', ['id'], typeof id === 'number' ? id : String(id)]
    })
    return features.length > 0
  } catch (error) {
    console.error('Error checking feature existence', error)
    return false
  }
}
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
