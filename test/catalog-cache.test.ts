import { describe, expect, it, vi } from "vitest";
import { pickRandom } from "../src/api/catalog-cache";
import { findInCatalog } from "../src/shared/catalog";
import { CATALOG_SNAPSHOT_KEY, CATALOG_VERSION_KEY } from "../src/shared/types";
import type { Catalog } from "../src/shared/types";

describe("pickRandom", () => {
  it("returns null for empty catalog", () => {
    expect(pickRandom([])).toBeNull();
  });

  it("returns an entry from the catalog", () => {
    const catalog = [
      { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", ext: "jpg" as const },
      { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", ext: "png" as const },
    ];
    const picked = pickRandom(catalog);
    expect(picked).not.toBeNull();
    expect(catalog).toContainEqual(picked);
  });
});

describe("findInCatalog", () => {
  const catalog: Catalog = {
    version: 1,
    entries: [
      { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", ext: "jpg" },
    ],
  };

  it("finds existing entry", () => {
    const found = findInCatalog(catalog, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(found?.ext).toBe("jpg");
  });

  it("returns undefined for missing id", () => {
    expect(findInCatalog(catalog, "00000000-0000-0000-0000-000000000000")).toBeUndefined();
  });
});

describe("getCatalog", () => {
  async function loadGetCatalog() {
    vi.resetModules();
    const mod = await import("../src/api/catalog-cache");
    return mod.getCatalog;
  }

  it("returns snapshot when snapshot version matches current version", async () => {
    const getCatalog = await loadGetCatalog();
    const snapshot: Catalog = {
      version: 7,
      entries: [{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", ext: "jpg" }],
    };
    const list = vi.fn(async () => {
      throw new Error("should not list catalog keys on snapshot hit");
    });
    const put = vi.fn(async () => {});
    const kv = {
      get: vi.fn(async (key: string, opts?: { type?: string }) => {
        if (key === CATALOG_VERSION_KEY) return "7";
        if (key === CATALOG_SNAPSHOT_KEY && opts?.type === "json") return snapshot;
        return null;
      }),
      list,
      put,
    } as unknown as KVNamespace;

    const catalog = await getCatalog(kv);
    expect(catalog).toEqual(snapshot);
    expect(list.mock.calls).toHaveLength(0);
    expect(put.mock.calls).toHaveLength(0);
  });

  it("rebuilds and stores snapshot when snapshot is missing", async () => {
    const getCatalog = await loadGetCatalog();
    const list = vi.fn(async () => ({
      keys: [{ name: "cat:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg" }],
      list_complete: true,
    }));
    const put = vi.fn(async () => {});
    const kv = {
      get: vi.fn(async (key: string, opts?: { type?: string }) => {
        if (key === CATALOG_VERSION_KEY) return "42";
        if (key === CATALOG_SNAPSHOT_KEY && opts?.type === "json") return null;
        if (key === "cat:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg") return "";
        return null;
      }),
      list,
      put,
    } as unknown as KVNamespace;

    const catalog = await getCatalog(kv);
    expect(catalog).toEqual({
      version: 42,
      entries: [{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", ext: "jpg" }],
    });
    expect(list.mock.calls).toHaveLength(1);
    expect(put.mock.calls).toEqual([[CATALOG_SNAPSHOT_KEY, JSON.stringify(catalog)]]);
  });

  it("rebuilds when snapshot version is stale", async () => {
    const getCatalog = await loadGetCatalog();
    const list = vi.fn(async () => ({
      keys: [{ name: "cat:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png" }],
      list_complete: true,
    }));
    const kv = {
      get: vi.fn(async (key: string, opts?: { type?: string }) => {
        if (key === CATALOG_VERSION_KEY) return "11";
        if (key === CATALOG_SNAPSHOT_KEY && opts?.type === "json") {
          return {
            version: 10,
            entries: [{ id: "stale-stale-stale-stale-stale-stalestale", ext: "png" }],
          };
        }
        if (key === "cat:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png") return "";
        return null;
      }),
      list,
      put: vi.fn(async () => {}),
    } as unknown as KVNamespace;

    const catalog = await getCatalog(kv);
    expect(catalog.entries).toEqual([{ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", ext: "png" }]);
    expect(list.mock.calls).toHaveLength(1);
  });

  it("uses in-memory cache before snapshot lookup when version is unchanged", async () => {
    const getCatalog = await loadGetCatalog();
    const get = vi.fn(async (key: string, opts?: { type?: string }) => {
      if (key === CATALOG_VERSION_KEY) return "5";
      if (key === CATALOG_SNAPSHOT_KEY && opts?.type === "json") {
        return { version: 5, entries: [{ id: "cccccccc-cccc-cccc-cccc-cccccccccccc", ext: "jpg" }] };
      }
      return null;
    });
    const kv = {
      get,
      list: vi.fn(async () => ({
        keys: [],
        list_complete: true,
      })),
      put: vi.fn(async () => {}),
    } as unknown as KVNamespace;

    const first = await getCatalog(kv);
    const second = await getCatalog(kv);
    expect(second).toEqual(first);

    const snapshotGets = get.mock.calls.filter(([key, opts]) => (
      key === CATALOG_SNAPSHOT_KEY && opts?.type === "json"
    ));
    expect(snapshotGets).toHaveLength(1);
  });
});
