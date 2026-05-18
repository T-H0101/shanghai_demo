'use client'

import * as React from 'react'

export interface Notification {
  id: string
  title: string
  message: string
  time: string
  type: 'info' | 'warning' | 'error' | 'success'
  read: boolean
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
}

// Module-level singleton state
let notifState: NotificationState = {
  notifications: [
    { id: 'n1', title: '站点离线告警', message: '成都研发基地核心交换机无响应，冗余链路切换失败', time: '14:28:03', type: 'error', read: false },
    { id: 'n2', title: '任务执行超时', message: '南京中心增量备份_B2 任务执行超过阈值 120 分钟', time: '13:55:20', type: 'warning', read: false },
    { id: 'n3', title: '同步完成', message: '北京总部机房全量同步完成，共同步 2.4TB 数据', time: '12:00:00', type: 'info', read: false },
    { id: 'n4', title: '存储容量预警', message: '南京中心存储使用率已达 91%，建议尽快扩容', time: '10:30:00', type: 'warning', read: true },
    { id: 'n5', title: '新增站点注册', message: '武汉备份中心已成功接入统一管控平台', time: '09:15:00', type: 'success', read: true },
  ],
  unreadCount: 3,
}

type Listener = (state: NotificationState) => void
const listeners: Set<Listener> = new Set()

function notifyListeners() {
  listeners.forEach(l => l({ ...notifState }))
}

export function useNotificationStore() {
  const [state, setState] = React.useState<NotificationState>({ ...notifState })

  React.useEffect(() => {
    const listener: Listener = (newState) => {
      setState({ ...newState })
    }
    listeners.add(listener)
    listener({ ...notifState }) // Initial sync
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const markAsRead = React.useCallback((id: string) => {
    const notif = notifState.notifications.find(n => n.id === id)
    if (!notif || notif.read) return
    notif.read = true
    notifState = {
      ...notifState,
      notifications: [...notifState.notifications],
      unreadCount: Math.max(0, notifState.unreadCount - 1),
    }
    notifyListeners()
  }, [])

  const markAllAsRead = React.useCallback(() => {
    notifState = {
      ...notifState,
      notifications: notifState.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }
    notifyListeners()
  }, [])

  return {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    markAsRead,
    markAllAsRead,
  }
}