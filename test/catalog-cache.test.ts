import { describe, expect, it } from "vitest";
import { pickRandom } from "../src/api/catalog-cache";
import { findInCatalog } from "../src/shared/catalog";
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
