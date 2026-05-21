export type ImageExt = "jpg" | "png";

export interface CatalogEntry {
  id: string;
  ext: ImageExt;
}

export interface Catalog {
  version: number;
  entries: CatalogEntry[];
}

export type DedupStatus = "pending" | "approved";

export interface DedupRecord {
  status: DedupStatus;
  id: string;
}

export interface PendingRecord {
  ext: ImageExt;
  r2Key: string;
  submittedAt: string;
  contentHash: string;
}

export const PENDING_PREFIX = "pending:";
export const CATALOG_ENTRY_PREFIX = "cat:";
export const CATALOG_VERSION_KEY = "cat:version";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const CATALOG_CACHE_TTL_MS = 60_000;
