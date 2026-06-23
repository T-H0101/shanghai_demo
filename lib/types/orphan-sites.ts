/**
 * R.83.1: orphan site codes (出现在业务表但未在 sync_sites 注册)
 */

export interface OrphanSiteSources {
  tasks: number
  devices: number
  volumes: number
  packages: number
}

export interface OrphanSiteRow {
  site_code: string
  sources: OrphanSiteSources
}

export interface OrphanSitesResponse {
  code: number
  message: string
  data: OrphanSiteRow[]
  traceId: string
}