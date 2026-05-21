import { describe, expect, it, vi } from "vitest";
import {
  appendToCatalog,
  catalogEntryKey,
  parseCatalogEntryKey,
  readCatalog,
  removeCatalogEntry,
} from "../src/shared/catalog";
import { CATALOG_MANIFEST_KEY, CATALOG_VERSION_KEY } from "../src/shared/types";

describe("catalogEntryKey", () => {
  it("encodes id and ext in the key", () => {
    expect(catalogEntryKey("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "png")).toBe(
      "cat:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png",
    );
  });
});

describe("parseCatalogEntryKey", () => {
  it("parses valid keys", () => {
    expect(parseCatalogEntryKey("cat:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg")).toEqual({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      ext: "jpg",
    });
  });

  it("rejects unknown extensions", () => {
    expect(parseCatalogEntryKey("cat:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.gif")).toBeNull();
  });

  it("rejects wrong prefix", () => {
    expect(parseCatalogEntryKey("pending:foo.jpg")).toBeNull();
  });
});

describe("readCatalog", () => {
  it("reads the denormalized manifest in one KV get", async () => {
    const kv = {
      get: vi.fn(async (key: string) => {
        if (key === CATALOG_MANIFEST_KEY) {
          return JSON.stringify({
            version: 42,
            entries: [{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", ext: "jpg" }],
          });
        }
        return null;
      }),
      list: vi.fn(),
      put: vi.fn(),
    } as unknown as KVNamespace;

    const catalog = await readCatalog(kv);
    expect(catalog.version).toBe(42);
    expect(catalog.entries).toEqual([
      { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", ext: "jpg" },
    ]);
    expect(kv.list).not.toHaveBeenCalled();
  });

  it("loads optional attribution from manifest entries", async () => {
    const kv = {
      get: vi.fn(async (key: string) => {
        if (key === CATALOG_MANIFEST_KEY) {
          return JSON.stringify({
            version: 99,
            entries: [
              {
                id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                ext: "png",
                attribution: {
                  label: "tester",
                  kind: "poster",
                  sourceUrl: "https://example.com/post",
                },
              },
            ],
          });
        }
        return null;
      }),
      list: vi.fn(),
      put: vi.fn(),
    } as unknown as KVNamespace;

    const catalog = await readCatalog(kv);
    expect(catalog.entries[0]).toEqual({
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      ext: "png",
      attribution: {
        label: "tester",
        kind: "poster",
        sourceUrl: "https://example.com/post",
      },
    });
  });

  it("falls back to entry keys and writes manifest when manifest is missing", async () => {
    const kv = {
      get: vi.fn(async (key: string | string[]) => {
        if (key === CATALOG_MANIFEST_KEY) return null;
        if (key === CATALOG_VERSION_KEY) return "42";
        if (Array.isArray(key)) {
          return new Map([[key[0]!, ""]]);
        }
        return null;
      }),
      list: vi.fn(async () => ({
        keys: [{ name: "cat:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg" }],
        list_complete: true,
      })),
      put: vi.fn(),
    } as unknown as KVNamespace;

    const catalog = await readCatalog(kv);
    expect(catalog.entries).toEqual([
      { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", ext: "jpg" },
    ]);
    expect(kv.put).toHaveBeenCalledWith(
      CATALOG_MANIFEST_KEY,
      expect.stringContaining("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
    );
  });

  it("rebuilds from entry keys when manifest entries are all malformed", async () => {
    const kv = {
      get: vi.fn(async (key: string | string[]) => {
        if (key === CATALOG_MANIFEST_KEY) {
          return JSON.stringify({ version: 1, entries: [{ bad: true }] });
        }
        if (key === CATALOG_VERSION_KEY) return "42";
        if (Array.isArray(key)) {
          return new Map([[key[0]!, ""]]);
        }
        return null;
      }),
      list: vi.fn(async () => ({
        keys: [{ name: "cat:cccccccc-cccc-cccc-cccc-cccccccccccc.png" }],
        list_complete: true,
      })),
      put: vi.fn(),
    } as unknown as KVNamespace;

    const catalog = await readCatalog(kv);
    expect(catalog.entries).toEqual([
      { id: "cccccccc-cccc-cccc-cccc-cccccccccccc", ext: "png" },
    ]);
  });
});

describe("appendToCatalog", () => {
  it("writes entry key and rebuilds manifest from listed keys", async () => {
    const entry = { id: "dddddddd-dddd-dddd-dddd-dddddddddddd", ext: "jpg" as const };
    const kv = {
      get: vi.fn(async (key: string | string[]) => {
        if (key === CATALOG_VERSION_KEY) return "1";
        if (Array.isArray(key)) {
          return new Map([[catalogEntryKey(entry.id, entry.ext), ""]]);
        }
        return null;
      }),
      list: vi.fn(async () => ({
        keys: [{ name: catalogEntryKey(entry.id, entry.ext) }],
        list_complete: true,
      })),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as KVNamespace;

    await appendToCatalog(kv, entry);
    expect(kv.put).toHaveBeenCalledWith(catalogEntryKey(entry.id, entry.ext), "");
    expect(kv.put).toHaveBeenCalledWith(
      CATALOG_MANIFEST_KEY,
      expect.stringContaining(entry.id),
    );
  });
});

describe("removeCatalogEntry", () => {
  it("deletes entry key and rebuilds manifest without that entry", async () => {
    const removed = { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", ext: "png" as const };
    const kept = { id: "ffffffff-ffff-ffff-ffff-ffffffffffff", ext: "jpg" as const };
    const kv = {
      get: vi.fn(async (key: string | string[]) => {
        if (key === CATALOG_VERSION_KEY) return "1";
        if (Array.isArray(key)) {
          return new Map([[catalogEntryKey(kept.id, kept.ext), ""]]);
        }
        return null;
      }),
      list: vi.fn(async () => ({
        keys: [{ name: catalogEntryKey(kept.id, kept.ext) }],
        list_complete: true,
      })),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as KVNamespace;

    await removeCatalogEntry(kv, removed.id, removed.ext);
    expect(kv.delete).toHaveBeenCalledWith(catalogEntryKey(removed.id, removed.ext));
    const manifestPut = (kv.put as ReturnType<typeof vi.fn>).mock.calls.find(
      ([key]) => key === CATALOG_MANIFEST_KEY,
    );
    expect(manifestPut?.[1]).not.toContain(removed.id);
    expect(manifestPut?.[1]).toContain(kept.id);
  });
});
