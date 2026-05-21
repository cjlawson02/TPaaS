import { describe, expect, it, vi } from "vitest";
import {
  appendToCatalog,
  catalogEntryKey,
  parseCatalogEntryKey,
  readCatalog,
} from "../src/shared/catalog";
import { CATALOG_SNAPSHOT_KEY } from "../src/shared/types";

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
  it("lists catalog entry keys and reads version", async () => {
    const kv = {
      get: vi.fn(async (key: string) => {
        if (key === "cat:version") return "42";
        if (key === "cat:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg") return "";
        return null;
      }),
      list: vi.fn(async () => ({
        keys: [{ name: "cat:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg" }],
        list_complete: true,
      })),
    } as unknown as KVNamespace;

    const catalog = await readCatalog(kv);
    expect(catalog.version).toBe(42);
    expect(catalog.entries).toEqual([
      { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", ext: "jpg" },
    ]);
  });

  it("loads optional attribution from entry values", async () => {
    const kv = {
      get: vi.fn(async (key: string) => {
        if (key === "cat:version") return "99";
        if (key === "cat:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png") {
          return JSON.stringify({
            attribution: {
              label: "tester",
              kind: "poster",
              sourceUrl: "https://example.com/post",
            },
          });
        }
        return null;
      }),
      list: vi.fn(async () => ({
        keys: [{ name: "cat:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png" }],
        list_complete: true,
      })),
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
});

describe("appendToCatalog", () => {
  it("writes entry, bumps version, and invalidates snapshot", async () => {
    const put = vi.fn(async () => {});
    const del = vi.fn(async () => {});
    const kv = {
      put,
      delete: del,
    } as unknown as KVNamespace;

    await appendToCatalog(kv, {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      ext: "jpg",
    });

    expect(put.mock.calls[0]).toEqual([
      "cat:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg",
      "",
    ]);
    expect(put).toHaveBeenNthCalledWith(2, "cat:version", expect.any(String));
    expect(del.mock.calls).toEqual([[CATALOG_SNAPSHOT_KEY]]);
  });
});
