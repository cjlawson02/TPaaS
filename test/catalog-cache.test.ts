import { afterEach, describe, expect, it, vi } from "vitest";
import { pickRandom } from "../src/api/catalog-cache";
import { findInCatalog } from "../src/shared/catalog";
import type { Catalog } from "../src/shared/types";

describe("getCatalog", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("returns cached catalog without additional KV reads within TTL", async () => {
    vi.resetModules();
    const catalogModule = await import("../src/shared/catalog");
    const cacheModule = await import("../src/api/catalog-cache");

    const catalog: Catalog = {
      version: 1,
      entries: [{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", ext: "jpg" }],
    };
    const readCatalog = vi.spyOn(catalogModule, "readCatalog").mockResolvedValue(catalog);
    const kv = {} as KVNamespace;

    const first = await cacheModule.getCatalog(kv);
    const second = await cacheModule.getCatalog(kv);

    expect(first).toEqual(catalog);
    expect(second).toEqual(catalog);
    expect(readCatalog).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent cache misses into one readCatalog call", async () => {
    vi.resetModules();
    const catalogModule = await import("../src/shared/catalog");
    const cacheModule = await import("../src/api/catalog-cache");

    const catalog: Catalog = {
      version: 1,
      entries: [{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", ext: "jpg" }],
    };
    const readCatalog = vi.spyOn(catalogModule, "readCatalog").mockResolvedValue(catalog);
    const kv = {} as KVNamespace;

    const [first, second] = await Promise.all([
      cacheModule.getCatalog(kv),
      cacheModule.getCatalog(kv),
    ]);

    expect(first).toEqual(catalog);
    expect(second).toEqual(catalog);
    expect(readCatalog).toHaveBeenCalledTimes(1);
  });
});

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
