import { getPending } from "./catalog";
import type { DedupRecord, DedupStatus } from "./types";

const DEDUP_PREFIX = "dedup:";

export function dedupKvKey(contentHash: string): string {
  return `${DEDUP_PREFIX}${contentHash}`;
}

export async function getDedup(
  kv: KVNamespace,
  contentHash: string,
): Promise<DedupRecord | null> {
  const raw = await kv.get(dedupKvKey(contentHash), { type: "json" });
  if (!raw) return null;
  return raw as DedupRecord;
}

export async function putDedup(
  kv: KVNamespace,
  contentHash: string,
  status: DedupStatus,
  id: string,
): Promise<void> {
  await kv.put(dedupKvKey(contentHash), JSON.stringify({ status, id }));
}

export async function deleteDedup(kv: KVNamespace, contentHash: string): Promise<void> {
  await kv.delete(dedupKvKey(contentHash));
}

/** Remove dedup when pending KV expired but dedup still references it. Returns true if cleared. */
export async function clearStalePendingDedup(
  kv: KVNamespace,
  contentHash: string,
  record: DedupRecord,
): Promise<boolean> {
  if (record.status !== "pending") return false;
  const pending = await getPending(kv, record.id);
  if (pending) return false;
  await deleteDedup(kv, contentHash);
  return true;
}

/**
 * Claim dedup for this upload. Returns the winning record if we lost the race.
 */
export async function claimDedup(
  kv: KVNamespace,
  contentHash: string,
  id: string,
): Promise<DedupRecord | null> {
  await putDedup(kv, contentHash, "pending", id);
  const claimed = await getDedup(kv, contentHash);
  if (!claimed || claimed.id !== id) {
    return claimed;
  }
  return null;
}

export function duplicateErrorMessage(record: DedupRecord): string {
  if (record.status === "approved") {
    return `This image is already live (id: ${record.id})`;
  }
  return `This image is already pending review (id: ${record.id})`;
}
