import type { LogResult } from "./common"

export type AuditTab =
  | "operations"
  | "security"
  | "system"
  | "task"
  | "compliance"
  | "alerts"
  | "login"

export type LogType = "operation" | "security" | "system" | "task" | "compliance"

export interface AuditLog {
  id: string
  logId: string
  type: LogType
  typeLabel: string
  taskType?: string
  siteName: string
  operator: string
  operatedAt: string
  deviceId?: string
  discNo?: string
  result: LogResult
  errorCode?: string
  summary: string
  detail: Record<string, unknown>
  signatureValid?: boolean
  traceChain?: { service: string; latency: string; status: string }[]
}

export interface AuditStats {
  total24h: number
  successRate: number
  securityEvents: number
  failedOps: number
  complianceReports: number
}

export interface AuditFilters {
  tab?: AuditTab
  keyword?: string
  siteName?: string
  operator?: string
  result?: LogResult | "all"
  taskType?: string
  errorCode?: string
  taskId?: string
  date?: string
}
