export type ImageExt = "jpg" | "png";

export type AttributionKind = "poster" | "uploader" | "collection";

/** Optional credit for a meme — poster/uploader, not necessarily the original artist. */
export interface Attribution {
  label: string;
  kind: AttributionKind;
  sourceUrl?: string;
}

export interface CatalogEntry {
  id: string;
  ext: ImageExt;
  attribution?: Attribution;
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
  attribution?: Attribution;
}

export const PENDING_PREFIX = "pending:";
export const CATALOG_ENTRY_PREFIX = "cat:";
export const CATALOG_VERSION_KEY = "cat:version";
/** Denormalized full catalog — one KV read instead of list + N gets. */
export const CATALOG_MANIFEST_KEY = "cat:manifest";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const CATALOG_CACHE_TTL_MS = 60_000;
export const CATALOG_CACHE_SECONDS = CATALOG_CACHE_TTL_MS / 1000;
