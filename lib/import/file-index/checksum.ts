/**
 * File Index Checksum
 * Sprint 2C.18B - 用于幂等检测
 */

import type { FileIndexRecord, FolderIndexRecord } from './types'

/**
 * 计算 file record 的校验和
 * 用于幂等检测：相同 checksum 的 batch 认为是重复执行
 */
export function computeFileChecksum(records: FileIndexRecord[]): string {
  if (records.length === 0) {
    return 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  }

  const sorted = [...records].sort((a, b) => a.source_id.localeCompare(b.source_id))
  const content = sorted
    .map((r) => `${r.source_id}|${r.file_name}|${String(r.file_size)}|${r.hash}`)
    .join('||')

  // Simple hash for checksum (in production, use crypto.createHash)
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

/**
 * 计算 folder record 的校验和
 */
export function computeFolderChecksum(records: FolderIndexRecord[]): string {
  if (records.length === 0) {
    return 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  }

  const sorted = [...records].sort((a, b) => a.source_id.localeCompare(b.source_id))
  const content = sorted.map((r) => `${r.source_id}|${r.name}|${r.level}`).join('||')

  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}