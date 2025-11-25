export type MarkerDetailsData = {
  title: string
  description: string
  coords: [number, number]
  id?: string
  slug?: string
  street?: string
  housenumber?: string
  postcode?: string
  city?: string
  district?: string
  municipality?: string
  monumentType?: string
  monumentFunction?: string
  objectNumber?: string
  lastUpdate?: string
  photoLink?: string
  detailLink?: string
}

// Alias for backward compatibility
export type MonumentFeature = MarkerDetailsData
