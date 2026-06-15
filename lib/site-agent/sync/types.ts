import type {
  AllowedPackageTable,
  SyncPackagePayload,
} from "../../sync/package-schema"

export interface TaskWatermark {
  maxId: string
  maxUpdateDt: string | null
}

export interface AgentSyncState {
  version: 1
  taskWatermark: TaskWatermark | null
  taskWindowHash?: string | null
  snapshotHashes: Partial<Record<AllowedPackageTable, string>>
  lastSyncAt: string | null
}

export interface PendingCommit {
  nextState: AgentSyncState
}

export interface SpoolEntry {
  payload: SyncPackagePayload
  pendingCommit: PendingCommit
}

export const EMPTY_SYNC_STATE: AgentSyncState = {
  version: 1,
  taskWatermark: null,
  taskWindowHash: null,
  snapshotHashes: {},
  lastSyncAt: null,
}
