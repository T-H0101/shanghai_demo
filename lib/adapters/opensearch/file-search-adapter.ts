/**
 * lib/adapters/opensearch/file-search-adapter.ts
 * OpenSearch adapter — 读取业务 syncDB 推送的 disc_file_index 文档
 */

import type {
  FileSearchQuery,
  FileSearchHit,
  FileSearchResult,
  SearchPort,
} from "@/lib/ports/search-port"
import type { FileIndexDocument } from "@/lib/domain/search/file-index-document"
import {
  isEsConfigured,
  searchFilesInEs,
  indexFileInEs,
  type EsIndexDocument,
} from "@/lib/search/es-client"

const BLOCKER_NOT_CONFIGURED = "es_not_configured"
const BLOCKER_QUERY_FAILED = "es_query_failed"
const BLOCKER_INDEX_FAILED = "es_index_failed"

function parseVolumeIdFromTable(sourceTable: string | null | undefined): number | null {
  if (!sourceTable) return null
  const file = /^tbl_file_(\d+)_a$/i.exec(sourceTable)
  if (file) return Number(file[1])
  const folder = /^tbl_folder_(\d+)$/i.exec(sourceTable)
  if (folder) return Number(folder[1])
  return null
}

function esDocToHit(doc: EsIndexDocument & { _id?: string }): FileSearchHit {
  const sourceTable = doc.source_table ?? null
  const volumeFromDoc =
    doc.volume_id != null && Number.isFinite(Number(doc.volume_id))
      ? Number(doc.volume_id)
      : null
  const volumeId = volumeFromDoc ?? parseVolumeIdFromTable(sourceTable)
  const docType = doc.doc_type === "folder" ? "folder" : doc.doc_type === "file" ? "file" : (doc.doc_type ?? "file")
  const displayName =
    docType === "folder"
      ? (doc.folder_name || doc.file_name || "(未命名目录)")
      : (doc.file_name || doc.folder_name || "(未命名文件)")

  return {
    docId: doc._id || undefined,
    sourceSiteId: doc.source_site_id ?? "",
    sourceTable,
    sourceRecordId: doc.source_record_id ?? "",
    docType,
    displayName,
    fileName: displayName,
    filePath: doc.folder_path || doc.disc_path || null,
    folderPath: doc.folder_path || null,
    extension: doc.extension ?? null,
    contentType: doc.content_type ?? null,
    sizeBytes:
      doc.file_size != null && Number.isFinite(Number(doc.file_size))
        ? Number(doc.file_size)
        : null,
    volumeId,
    volumeCode: volumeId != null ? String(volumeId) : null,
    volumeName: null,
    volumeType:
      doc.volume_type != null && Number.isFinite(Number(doc.volume_type))
        ? Number(doc.volume_type)
        : null,
    slotId:
      doc.slot_id != null && Number.isFinite(Number(doc.slot_id))
        ? Number(doc.slot_id)
        : null,
    slotOrder:
      doc.slot_order != null && Number.isFinite(Number(doc.slot_order))
        ? Number(doc.slot_order)
        : null,
    discSide:
      doc.disc_side != null && Number.isFinite(Number(doc.disc_side))
        ? Number(doc.disc_side)
        : null,
    magazineRfid: doc.magazine_rfid?.trim() || null,
    deviceIp: doc.device_ip?.trim() || null,
    devicePort: doc.device_port?.trim() || null,
    deviceName: null,
    serialNum: doc.serial_num?.trim() || null,
    hash: doc.hash ?? doc.hash1 ?? null,
    taskId: doc.task_id ?? null,
    status: doc.status != null && Number.isFinite(Number(doc.status)) ? Number(doc.status) : null,
    createDate: doc.create_date ?? null,
    updatedAt: doc.create_date ?? doc.indexed_at ?? null,
    discCode: null,
  }
}

export function createOpenSearchFileSearchAdapter(): SearchPort {
  return {
    async searchFiles(query: FileSearchQuery): Promise<FileSearchResult> {
      if (!isEsConfigured()) {
        return {
          hits: [],
          total: 0,
          nextSearchAfter: null,
          hasMore: false,
          source: "blocked_by_external_system",
          blocker: BLOCKER_NOT_CONFIGURED,
        }
      }
      try {
        const result = await searchFilesInEs({
          q: query.keyword,
          siteCodes: query.siteCode ? [query.siteCode] : [],
          deviceIp: query.deviceIp,
          docType: "file",
          limit: Math.min(Math.max(query.limit, 1), 500),
          searchAfter: query.searchAfter,
          inboundRfids: query.inboundRfids,
          outboundRfids: query.outboundRfids,
          deviceInboundRfids: query.deviceInboundRfids,
          deviceOutboundRfids: query.deviceOutboundRfids,
        })
        return {
          hits: result.items.map(esDocToHit),
          total: 0,
          nextSearchAfter: result.nextSearchAfter,
          hasMore: result.hasMore,
          source: "opensearch",
        }
      } catch {
        return {
          hits: [],
          total: 0,
          nextSearchAfter: null,
          hasMore: false,
          source: "blocked_by_external_system",
          blocker: BLOCKER_QUERY_FAILED,
        }
      }
    },

    async indexFiles(documents: FileIndexDocument[]) {
      if (!isEsConfigured()) {
        return {
          indexed: 0,
          failed: documents.length,
          blocker: BLOCKER_NOT_CONFIGURED,
        }
      }
      let indexed = 0
      let failed = 0
      for (const doc of documents) {
        try {
          await indexFileInEs({
            siteCode: doc.source_site_id,
            fileName: doc.file_name,
            filePath: doc.file_path ?? "",
            extension: doc.extension ?? undefined,
            folderPath: doc.folder_path ?? undefined,
            volume: doc.volume_code ?? undefined,
            disc: doc.disc_code ?? undefined,
            department: doc.department_id ?? undefined,
            taskId: doc.task_id ?? undefined,
            updatedAt: doc.updated_at ?? undefined,
          })
          indexed++
        } catch {
          failed++
        }
      }
      return { indexed, failed }
    },
  }
}

export { parseVolumeIdFromTable }
