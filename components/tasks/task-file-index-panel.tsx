/**
 * TaskFileIndexPanel
 * Sprint 2C.20 - 任务文件列表后置加载组件
 *
 * - 后置加载：不阻塞任务详情首屏
 * - 失败安全：API 失败不影响主页面
 * - fallback 安全：无索引时显示"未生成"
 */

'use client'

import { useState, useEffect } from 'react'
import { useSite } from '@/lib/site/site-context'
import { formatBeijingTime } from '@/components/shared/time-format'

interface FileIndexItem {
  id: string
  source_site_id: string
  source_table: string
  source_id: string
  file_name: string
  file_size: string | null
  content_type: string | null
  hash: string | null
  folder_source_id: string | null
  indexed_at: string
  batch_id: string
}

interface FileIndexResponse {
  code: number
  message: string
  source: 'database' | 'empty-index'
  indexStatus: 'ready' | 'missing'
  data: {
    items: FileIndexItem[]
    page: number
    pageSize: number
    total: number
  }
}

interface TaskFileIndexPanelProps {
  taskId: string
}

export function TaskFileIndexPanel({ taskId }: TaskFileIndexPanelProps) {
  // Sprint 2F.4: 全局 siteCode, 防跨站点 source_id 冲突
  const { siteCode, isAllSites } = useSite()

  const [files, setFiles] = useState<FileIndexItem[]>([])
  const [loading, setLoading] = useState(false)
  const [indexStatus, setIndexStatus] = useState<
    'ready' | 'missing' | 'loading'
  >('loading')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    if (!taskId) return

    setLoading(true)
    const siteParam = !isAllSites && siteCode ? `&siteCode=${encodeURIComponent(siteCode)}` : ''
    fetch(
      `/api/tasks/${encodeURIComponent(taskId)}/files?page=${page}&pageSize=${pageSize}&keyword=${encodeURIComponent(keyword)}${siteParam}`
    )
      .then((res) => res.json())
      .then((data: FileIndexResponse) => {
        setIndexStatus(data.indexStatus)
        setFiles(data.data.items)
        setTotal(data.data.total)
      })
      .catch(() => {
        setIndexStatus('missing')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [taskId, page, pageSize, keyword, isAllSites, siteCode])

  if (loading && files.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        加载文件索引...
      </div>
    )
  }

  if (indexStatus === 'missing') {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        文件索引未生成
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">暂无文件</div>
    )
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">共 {total} 个文件</div>
        <input
          type="text"
          placeholder="搜索文件名..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="px-3 py-1 border rounded text-sm"
        />
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-2">文件名</th>
            <th className="text-right py-2 px-2">大小</th>
            <th className="text-left py-2 px-2">类型</th>
            <th className="text-left py-2 px-2">索引时间</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr
              key={`${file.source_site_id}-${file.source_table}-${file.source_id}-${file.id}`}
              className="border-b hover:bg-gray-50"
            >
              <td className="py-2 px-2 truncate max-w-xs" title={file.file_name ?? ''}>
                {file.file_name ?? '-'}
              </td>
              <td className="py-2 px-2 text-right">
                {file.file_size ? formatFileSize(Number(file.file_size)) : '-'}
              </td>
              <td className="py-2 px-2">{file.content_type ?? '-'}</td>
              <td className="py-2 px-2 text-gray-500">
                {formatBeijingTime(file.indexed_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50 text-sm"
          >
            上一页
          </button>
          <span className="text-sm">
            第 {page} / {totalPages} 页
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50 text-sm"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
