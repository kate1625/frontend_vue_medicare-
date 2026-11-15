import { getApiData } from './api'

export interface PublicOverview {
  services: Array<{
    service_id: number
    service_name: string
    category: string | null
    description: string | null
    price: string | number
    duration_min: number | null
  }>
  dentists: Array<{ dentist_id: number; specialization: string | null; display_name: string }>
}

let cachedOverview: PublicOverview | null = null
let overviewRequest: Promise<PublicOverview> | null = null
let overviewVersion = 0

export function getCachedPublicOverview() {
  return cachedOverview
}

export function loadPublicOverview() {
  if (cachedOverview) return Promise.resolve(cachedOverview)
  if (overviewRequest) return overviewRequest

  const requestVersion = overviewVersion
  const request = getApiData<PublicOverview>('/api/public/overview')
    .then((overview) => {
      if (requestVersion === overviewVersion) cachedOverview = overview
      return overview
    })
    .finally(() => {
      if (overviewRequest === request) overviewRequest = null
    })

  overviewRequest = request
  return request
}

export function invalidatePublicOverview() {
  overviewVersion += 1
  cachedOverview = null
  overviewRequest = null
}
