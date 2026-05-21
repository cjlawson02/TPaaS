import { readCatalog } from "../shared/catalog";
import { CATALOG_CACHE_TTL_MS } from "../shared/types";
import type { Catalog, CatalogEntry } from "../shared/types";
import { purgeCatalogEdgeCache } from "./edge-cache";

let cached: Catalog | null = null;
let cachedAt = 0;
let idIndex: Map<string, CatalogEntry> | null = null;
let loading: Promise<Catalog> | null = null;

function applyCache(catalog: Catalog): Catalog {
  cached = catalog;
  cachedAt = Date.now();
  idIndex = new Map(catalog.entries.map((entry) => [entry.id, entry]));
  return catalog;
}

export function invalidateCatalogCache(): void {
  cached = null;
  cachedAt = 0;
  idIndex = null;
  loading = null;
}

export async function purgeCatalogCaches(origin: string): Promise<void> {
  invalidateCatalogCache();
  await purgeCatalogEdgeCache(origin);
}

/** In-isolate catalog cache — zero KV reads while TTL is valid. */
export async function getCatalog(kv: KVNamespace): Promise<Catalog> {
  const now = Date.now();
  if (cached && now - cachedAt < CATALOG_CACHE_TTL_MS) {
    return cached;
  }

  if (loading) {
    return loading;
  }

  loading = readCatalog(kv)
    .then(applyCache)
    .finally(() => {
      loading = null;
    });

  return loading;
}

export function findCachedEntry(id: string): CatalogEntry | undefined {
  return idIndex?.get(id);
}

export function pickRandom(entries: CatalogEntry[]): CatalogEntry | null {
  if (entries.length === 0) return null;
  const index = Math.floor(Math.random() * entries.length);
  return entries[index] ?? null;
}
