export interface SyncSettings {
  realtimeSync: boolean
  scheduledIntervalMinutes: number
  fullSyncTime: string
  retryCount: number
  retryIntervalSeconds: number
  consistencyCheckTime: string
}

export interface AlertSettings {
  siteOfflineThresholdMinutes: number
  hardwareAnomalyThreshold: number
  taskTimeoutMinutes: number
  capacityWarningPercent: number
  emailNotification: boolean
  emailRecipients: string
}

export interface SecuritySettings {
  jwtExpiryHours: number
  loginFailLockThreshold: number
  ipLockPolicy: "strict" | "moderate" | "off"
  sensitiveDataEncryption: boolean
}

export interface TaskSettings {
  restorePriority: boolean
  backupConcurrency: number
  inspectSamplePercent: number
  logRetentionDays: number
}

export interface ServiceMonitor {
  id: string
  name: string
  status: "healthy" | "degraded" | "down"
  cpu: number
  memory: number
  disk: number
  apiLatencyMs: number
  uptime: string
  version: string
}

export interface SystemSettings {
  sync: SyncSettings
  alert: AlertSettings
  security: SecuritySettings
  task: TaskSettings
  services: ServiceMonitor[]
}
