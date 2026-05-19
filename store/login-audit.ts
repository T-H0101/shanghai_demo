"use client"

import * as React from "react"

export interface LoginAuditEntry {
  id: string
  username: string
  displayName: string
  loginTime: string
  ip: string
  site: string
  status: "success" | "failed" | "locked"
  failureReason?: string
}

// 内存中的登录审计记录（Mock）
let loginAuditLogs: LoginAuditEntry[] = [
  {
    id: "la1",
    username: "admin",
    displayName: "系统管理员",
    loginTime: "2026-05-19 09:15:32",
    ip: "10.12.8.100",
    site: "上海研发中心",
    status: "success",
  },
  {
    id: "la2",
    username: "operator",
    displayName: "站点操作员",
    loginTime: "2026-05-19 09:10:15",
    ip: "10.28.1.50",
    site: "成都研发基地",
    status: "success",
  },
  {
    id: "la3",
    username: "test",
    displayName: "测试账号",
    loginTime: "2026-05-19 08:45:22",
    ip: "10.8.2.88",
    site: "—",
    status: "failed",
    failureReason: "密码错误",
  },
  {
    id: "la4",
    username: "test",
    displayName: "测试账号",
    loginTime: "2026-05-19 08:44:10",
    ip: "10.8.2.88",
    site: "—",
    status: "failed",
    failureReason: "密码错误",
  },
  {
    id: "la5",
    username: "test",
    displayName: "测试账号",
    loginTime: "2026-05-19 08:43:05",
    ip: "10.8.2.88",
    site: "—",
    status: "locked",
    failureReason: "连续登录失败，账户已锁定",
  },
  {
    id: "la6",
    username: "admin",
    displayName: "系统管理员",
    loginTime: "2026-05-18 18:30:00",
    ip: "10.12.8.100",
    site: "上海研发中心",
    status: "success",
  },
]

type Listener = (logs: LoginAuditEntry[]) => void
const listeners: Set<Listener> = new Set()

function notifyListeners() {
  listeners.forEach(l => l([...loginAuditLogs]))
}

export function useLoginAuditStore() {
  const [logs, setLogs] = React.useState<LoginAuditEntry[]>([...loginAuditLogs])

  React.useEffect(() => {
    const listener: Listener = (newLogs) => {
      setLogs([...newLogs])
    }
    listeners.add(listener)
    listener([...loginAuditLogs])
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const addLog = React.useCallback((entry: Omit<LoginAuditEntry, "id">) => {
    const newEntry: LoginAuditEntry = {
      ...entry,
      id: `la${Date.now()}`,
    }
    loginAuditLogs = [newEntry, ...loginAuditLogs]
    notifyListeners()
    return newEntry
  }, [])

  const getLogs = React.useCallback(() => {
    return [...loginAuditLogs]
  }, [])

  return {
    logs,
    addLog,
    getLogs,
  }
}

// 导出原始日志数组供审计日志页面使用
export function getLoginAuditLogs(): LoginAuditEntry[] {
  return [...loginAuditLogs]
}

// 添加登录记录
export function addLoginAuditLog(
  username: string,
  displayName: string,
  status: "success" | "failed" | "locked",
  site: string = "—",
  ip: string = "127.0.0.1",
  failureReason?: string
) {
  const entry: LoginAuditEntry = {
    id: `la${Date.now()}`,
    username,
    displayName,
    loginTime: new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-"),
    ip,
    site,
    status,
    failureReason,
  }
  loginAuditLogs = [entry, ...loginAuditLogs]
  notifyListeners()
  return entry
}