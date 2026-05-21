import { describe, expect, it, vi } from "vitest";
import {
  catalogEntryKey,
  parseCatalogEntryKey,
  readCatalog,
} from "../src/shared/catalog";

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
      get: vi.fn(async (key: string) => (key === "cat:version" ? "42" : null)),
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
});
