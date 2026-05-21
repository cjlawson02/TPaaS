import { readCatalog } from "../shared/catalog";
import {
  CATALOG_CACHE_TTL_MS,
  CATALOG_SNAPSHOT_KEY,
  CATALOG_VERSION_KEY,
} from "../shared/types";
import type { Catalog, CatalogEntry } from "../shared/types";

let cached: Catalog | null = null;
let cachedAt = 0;
let idIndex: Map<string, CatalogEntry> | null = null;

function parseVersion(raw: string | null): number {
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isCatalogEntry(value: unknown): value is CatalogEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CatalogEntry>;
  return (
    typeof candidate.id === "string" &&
    (candidate.ext === "jpg" || candidate.ext === "png")
  );
}

async function readCatalogSnapshot(kv: KVNamespace): Promise<Catalog | null> {
  const raw = await kv.get(CATALOG_SNAPSHOT_KEY, { type: "json" });
  if (!raw || typeof raw !== "object") return null;
  const snapshot = raw as Partial<Catalog>;
  if (typeof snapshot.version !== "number" || !Array.isArray(snapshot.entries)) {
    return null;
  }
  if (!snapshot.entries.every(isCatalogEntry)) {
    return null;
  }
  return {
    version: snapshot.version,
    entries: snapshot.entries,
  };
}

async function writeCatalogSnapshot(kv: KVNamespace, catalog: Catalog): Promise<void> {
  await kv.put(CATALOG_SNAPSHOT_KEY, JSON.stringify(catalog));
}

export async function getCatalog(kv: KVNamespace): Promise<Catalog> {
  const now = Date.now();
  const version = parseVersion(await kv.get(CATALOG_VERSION_KEY));

  if (cached && now - cachedAt < CATALOG_CACHE_TTL_MS) {
    if (cached.version === version) {
      return cached;
    }
  }

  const snapshot = await readCatalogSnapshot(kv);
  if (snapshot && snapshot.version === version) {
    cached = snapshot;
    cachedAt = now;
    idIndex = new Map(snapshot.entries.map((e) => [e.id, e]));
    return snapshot;
  }

  const catalog = await readCatalog(kv);
  cached = catalog;
  cachedAt = now;
  idIndex = new Map(catalog.entries.map((e) => [e.id, e]));
  await writeCatalogSnapshot(kv, catalog);
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
