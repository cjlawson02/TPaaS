/**
 * Catalog mutations for review outcomes. Only call from discord.ts after AuthN/AuthZ.
 */
import {
  appendToCatalog,
  catalogEntryKey,
  deletePending,
  getPending,
  removeCatalogEntry,
} from "../shared/catalog";
import { deleteDedup, putDedup } from "../shared/dedup";
import { approvedKey } from "../shared/r2-keys";
import { contentTypeForExt } from "../shared/image-validation";
import type { PendingRecord } from "../shared/types";

export async function approveSubmission(
  env: TpaasEnv,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pending = await getPending(env.TPAAS_KV, id);
  if (!pending) {
    return { ok: false, error: "Pending submission not found" };
  }

  if (!pending.contentHash) {
    return { ok: false, error: "Pending record missing content hash" };
  }

  const cacheOrigin = new URL(env.SUBMIT_BASE_URL).origin;
  const entryKey = catalogEntryKey(id, pending.ext);
  if (await env.TPAAS_KV.get(entryKey) !== null) {
    await discardPending(env, id, pending);
    await putDedup(env.TPAAS_KV, pending.contentHash, "approved", id);
    return { ok: true };
  }

  const source = await env.TPAAS_PENDING_R2.get(pending.r2Key);
  if (!source) {
    await deletePending(env.TPAAS_KV, id);
    return { ok: false, error: "Pending image missing from storage" };
  }

  const destKey = approvedKey(id, pending.ext);
  let wroteApprovedR2 = false;
  let wroteCatalog = false;
  let promotedDedup = false;

  try {
    await env.TPAAS_R2.put(destKey, source.body, {
      httpMetadata: {
        contentType: source.httpMetadata?.contentType ?? contentTypeForExt(pending.ext),
      },
    });
    wroteApprovedR2 = true;

    await appendToCatalog(
      env.TPAAS_KV,
      {
        id,
        ext: pending.ext,
        attribution: pending.attribution,
      },
      { cacheOrigin },
    );
    wroteCatalog = true;

    await putDedup(env.TPAAS_KV, pending.contentHash, "approved", id);
    promotedDedup = true;

    await Promise.all([
      env.TPAAS_PENDING_R2.delete(pending.r2Key),
      deletePending(env.TPAAS_KV, id),
    ]);
    return { ok: true };
  } catch (err) {
    console.error(JSON.stringify({ event: "approve_failed", id, err: String(err) }));
    const rollback: Promise<unknown>[] = [];
    if (wroteCatalog) {
      rollback.push(removeCatalogEntry(env.TPAAS_KV, id, pending.ext, { cacheOrigin }));
    }
    if (wroteApprovedR2) rollback.push(env.TPAAS_R2.delete(destKey));
    if (promotedDedup) {
      rollback.push(putDedup(env.TPAAS_KV, pending.contentHash, "pending", id));
    }
    const results = await Promise.allSettled(rollback);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error(
          JSON.stringify({ event: "approve_rollback_failed", id, err: String(result.reason) }),
        );
      }
    }
    return { ok: false, error: "Approval failed" };
  }
}

export async function rejectSubmission(
  env: TpaasEnv,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pending = await getPending(env.TPAAS_KV, id);
  if (!pending) {
    return { ok: false, error: "Pending submission not found" };
  }

  await cleanupPending(env, id, pending);
  return { ok: true };
}

/** Drop orphaned pending state when catalog entry already exists — keep dedup as approved. */
async function discardPending(
  env: TpaasEnv,
  id: string,
  pending: PendingRecord,
): Promise<void> {
  await Promise.all([
    env.TPAAS_PENDING_R2.delete(pending.r2Key),
    deletePending(env.TPAAS_KV, id),
  ]);
}

async function cleanupPending(
  env: TpaasEnv,
  id: string,
  pending: PendingRecord,
): Promise<void> {
  const tasks: Promise<unknown>[] = [
    env.TPAAS_PENDING_R2.delete(pending.r2Key),
    deletePending(env.TPAAS_KV, id),
  ];
  if (pending.contentHash) {
    tasks.push(deleteDedup(env.TPAAS_KV, pending.contentHash));
  }
  await Promise.all(tasks);
}
