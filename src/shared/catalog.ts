import {
  parseAttributionJson,
  serializeCatalogEntryValue,
} from "./attribution";
import {
  CATALOG_ENTRY_PREFIX,
  CATALOG_SNAPSHOT_KEY,
  CATALOG_VERSION_KEY,
  PENDING_PREFIX,
  type Catalog,
  type CatalogEntry,
  type ImageExt,
  type PendingRecord,
} from "./types";

const CATALOG_READ_BATCH = 64;

export function catalogEntryKey(id: string, ext: ImageExt): string {
  return `${CATALOG_ENTRY_PREFIX}${id}.${ext}`;
}

export function parseCatalogEntryKey(key: string): CatalogEntry | null {
  if (!key.startsWith(CATALOG_ENTRY_PREFIX)) return null;
  const rest = key.slice(CATALOG_ENTRY_PREFIX.length);
  const dot = rest.lastIndexOf(".");
  if (dot === -1) return null;
  const id = rest.slice(0, dot);
  const ext = rest.slice(dot + 1);
  if (ext !== "jpg" && ext !== "png") return null;
  return { id, ext };
}

function parseCatalogEntryValue(raw: string | null): Pick<CatalogEntry, "attribution"> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const attribution = parseAttributionJson((parsed as { attribution?: unknown }).attribution);
    return attribution ? { attribution } : {};
  } catch {
    return {};
  }
}

async function readCatalogEntryValues(
  kv: KVNamespace,
  keys: string[],
): Promise<Map<string, Pick<CatalogEntry, "attribution">>> {
  const values = new Map<string, Pick<CatalogEntry, "attribution">>();
  for (let i = 0; i < keys.length; i += CATALOG_READ_BATCH) {
    const batch = keys.slice(i, i + CATALOG_READ_BATCH);
    const results = await Promise.all(batch.map((key) => kv.get(key)));
    for (let j = 0; j < batch.length; j++) {
      values.set(batch[j]!, parseCatalogEntryValue(results[j] ?? null));
    }
  }
  return values;
}

export async function readCatalog(kv: KVNamespace): Promise<Catalog> {
  const versionRaw = await kv.get(CATALOG_VERSION_KEY);
  const version = versionRaw ? Number(versionRaw) : 0;

  const keyEntries: Array<{ key: string; entry: CatalogEntry }> = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: CATALOG_ENTRY_PREFIX, cursor });
    for (const { name } of page.keys) {
      const entry = parseCatalogEntryKey(name);
      if (entry) keyEntries.push({ key: name, entry });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const values = await readCatalogEntryValues(
    kv,
    keyEntries.map(({ key }) => key),
  );

  const entries = keyEntries.map(({ key, entry }) => ({
    ...entry,
    ...values.get(key),
  }));

  return { version, entries };
}

/** Idempotent: one KV key per approved meme — no read-modify-write race. */
export async function appendToCatalog(
  kv: KVNamespace,
  entry: CatalogEntry,
): Promise<void> {
  await kv.put(
    catalogEntryKey(entry.id, entry.ext),
    serializeCatalogEntryValue(entry.attribution),
  );
  await kv.put(CATALOG_VERSION_KEY, String(Date.now()));
  await kv.delete(CATALOG_SNAPSHOT_KEY);
}

export async function getPending(
  kv: KVNamespace,
  id: string,
): Promise<PendingRecord | null> {
  const raw = await kv.get(`${PENDING_PREFIX}${id}`, { type: "json" });
  if (!raw) return null;
  return raw as PendingRecord;
}

export async function putPending(
  kv: KVNamespace,
  id: string,
  record: PendingRecord,
): Promise<void> {
  await kv.put(`${PENDING_PREFIX}${id}`, JSON.stringify(record));
}

export async function deletePending(kv: KVNamespace, id: string): Promise<void> {
  await kv.delete(`${PENDING_PREFIX}${id}`);
}

export function findInCatalog(catalog: Catalog, id: string): CatalogEntry | undefined {
  return catalog.entries.find((e) => e.id === id);
}
