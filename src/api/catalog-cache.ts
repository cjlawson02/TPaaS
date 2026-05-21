import { readCatalog } from "../shared/catalog";
import { CATALOG_CACHE_TTL_MS, CATALOG_VERSION_KEY } from "../shared/types";
import type { Catalog, CatalogEntry } from "../shared/types";

let cached: Catalog | null = null;
let cachedAt = 0;
let idIndex: Map<string, CatalogEntry> | null = null;

export async function getCatalog(kv: KVNamespace): Promise<Catalog> {
  const now = Date.now();
  if (cached && now - cachedAt < CATALOG_CACHE_TTL_MS) {
    const versionRaw = await kv.get(CATALOG_VERSION_KEY);
    const version = versionRaw ? Number(versionRaw) : 0;
    if (cached.version === version) {
      return cached;
    }
  }

  const catalog = await readCatalog(kv);
  cached = catalog;
  cachedAt = now;
  idIndex = new Map(catalog.entries.map((e) => [e.id, e]));
  return catalog;
}

export function findCachedEntry(id: string): CatalogEntry | undefined {
  return idIndex?.get(id);
}

export function pickRandom(entries: CatalogEntry[]): CatalogEntry | null {
  if (entries.length === 0) return null;
  const index = Math.floor(Math.random() * entries.length);
  return entries[index] ?? null;
}
