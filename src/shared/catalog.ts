import {
  parseAttributionJson,
  serializeCatalogEntryValue,
} from "./attribution";
import {
  CATALOG_ENTRY_PREFIX,
  CATALOG_MANIFEST_KEY,
  CATALOG_VERSION_KEY,
  PENDING_PREFIX,
  type Catalog,
  type CatalogEntry,
  type ImageExt,
  type PendingRecord,
} from "./types";

const CATALOG_READ_BATCH = 64;
const MANIFEST_SYNC_RETRIES = 2;

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

function parseCatalogEntryJson(value: unknown): CatalogEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const ext = record.ext;
  if (!id || (ext !== "jpg" && ext !== "png")) return null;
  const attribution = parseAttributionJson(record.attribution);
  return attribution ? { id, ext, attribution } : { id, ext };
}

function parseCatalogManifest(raw: string): Catalog | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    const version = Number(record.version);
    if (!Number.isFinite(version)) return null;
    if (!Array.isArray(record.entries)) return null;

    const entries: CatalogEntry[] = [];
    for (const item of record.entries) {
      const entry = parseCatalogEntryJson(item);
      if (entry) entries.push(entry);
    }
    if (record.entries.length > 0 && entries.length === 0) return null;

    return { version, entries };
  } catch {
    return null;
  }
}

function serializeCatalogManifest(catalog: Catalog): string {
  return JSON.stringify(catalog);
}

async function readCatalogEntryValues(
  kv: KVNamespace,
  keys: string[],
): Promise<Map<string, Pick<CatalogEntry, "attribution">>> {
  const values = new Map<string, Pick<CatalogEntry, "attribution">>();
  for (let i = 0; i < keys.length; i += CATALOG_READ_BATCH) {
    const batch = keys.slice(i, i + CATALOG_READ_BATCH);
    const results = await kv.get(batch);
    for (const key of batch) {
      values.set(key, parseCatalogEntryValue(results.get(key) ?? null));
    }
  }
  return values;
}

/** Rebuild manifest from per-entry keys — authoritative source for catalog mutations. */
async function listCatalogFromEntryKeys(kv: KVNamespace): Promise<Catalog> {
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

/** Sync manifest from entry keys after a mutation. Retries once if an expected entry is missing. */
async function syncManifestFromEntryKeys(
  kv: KVNamespace,
  expectId?: string,
): Promise<Catalog> {
  for (let attempt = 0; attempt < MANIFEST_SYNC_RETRIES; attempt++) {
    const listed = await listCatalogFromEntryKeys(kv);
    const catalog: Catalog = { version: Date.now(), entries: listed.entries };
    await Promise.all([
      kv.put(CATALOG_MANIFEST_KEY, serializeCatalogManifest(catalog)),
      kv.put(CATALOG_VERSION_KEY, String(catalog.version)),
    ]);
    if (!expectId || catalog.entries.some((entry) => entry.id === expectId)) {
      return catalog;
    }
  }

  const catalog: Catalog = {
    version: Date.now(),
    entries: (await listCatalogFromEntryKeys(kv)).entries,
  };
  await Promise.all([
    kv.put(CATALOG_MANIFEST_KEY, serializeCatalogManifest(catalog)),
    kv.put(CATALOG_VERSION_KEY, String(catalog.version)),
  ]);
  return catalog;
}

export async function readCatalog(kv: KVNamespace): Promise<Catalog> {
  const manifestRaw = await kv.get(CATALOG_MANIFEST_KEY);
  if (manifestRaw) {
    const catalog = parseCatalogManifest(manifestRaw);
    if (catalog) return catalog;
  }

  const catalog = await syncManifestFromEntryKeys(kv);
  return catalog;
}

export interface CatalogMutationOptions {
  /** Worker origin (e.g. https://tpaas.example.com) — purges edge + in-isolate caches after write. */
  cacheOrigin?: string;
}

/** Writes the entry key then rebuilds the manifest from all entry keys (no in-memory RMW race). */
export async function appendToCatalog(
  kv: KVNamespace,
  entry: CatalogEntry,
  options?: CatalogMutationOptions,
): Promise<void> {
  await kv.put(
    catalogEntryKey(entry.id, entry.ext),
    serializeCatalogEntryValue(entry.attribution),
  );
  await syncManifestFromEntryKeys(kv, entry.id);

  if (options?.cacheOrigin) {
    const { purgeCatalogCaches } = await import("../api/catalog-cache");
    await purgeCatalogCaches(options.cacheOrigin);
  }
}

export async function removeCatalogEntry(
  kv: KVNamespace,
  id: string,
  ext: ImageExt,
  options?: CatalogMutationOptions,
): Promise<void> {
  await kv.delete(catalogEntryKey(id, ext));
  await syncManifestFromEntryKeys(kv);

  if (options?.cacheOrigin) {
    const { purgeCatalogCaches } = await import("../api/catalog-cache");
    await purgeCatalogCaches(options.cacheOrigin);
  }
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
