import { describe, expect, it, vi } from "vitest";
import {
  claimDedup,
  clearStalePendingDedup,
  duplicateErrorMessage,
  getDedup,
} from "../src/shared/dedup";

describe("duplicateErrorMessage", () => {
  it("describes approved duplicate", () => {
    expect(
      duplicateErrorMessage({ status: "approved", id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }),
    ).toContain("already live");
  });

  it("describes pending duplicate", () => {
    expect(
      duplicateErrorMessage({ status: "pending", id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }),
    ).toContain("pending review");
  });
});

describe("claimDedup", () => {
  it("returns null when claim wins", async () => {
    const kv = mockKv();
    const lost = await claimDedup(kv, "abc123", "id-a");
    expect(lost).toBeNull();
    expect(await getDedup(kv, "abc123")).toEqual({ status: "pending", id: "id-a" });
  });

  it("returns winner when read-back id differs", async () => {
    const kv = mockKv();
    const get = kv.get as ReturnType<typeof vi.fn>;
    get.mockImplementation(async (key: string, opts?: KVNamespaceGetOptions<"json">) => {
      if (key === "dedup:abc123") {
        if (opts?.type === "json") return { status: "pending", id: "id-a" };
        return JSON.stringify({ status: "pending", id: "id-a" });
      }
      return null;
    });
    const lost = await claimDedup(kv, "abc123", "id-b");
    expect(lost).toEqual({ status: "pending", id: "id-a" });
  });
});

describe("clearStalePendingDedup", () => {
  it("clears dedup when pending record is gone", async () => {
    const kv = mockKv();
    await kv.put("dedup:hash1", JSON.stringify({ status: "pending", id: "gone-id" }));
    const cleared = await clearStalePendingDedup(
      kv,
      "hash1",
      { status: "pending", id: "gone-id" },
    );
    expect(cleared).toBe(true);
    expect(await getDedup(kv, "hash1")).toBeNull();
  });

  it("does not clear when pending record still exists", async () => {
    const kv = mockKv();
    await kv.put("dedup:hash1", JSON.stringify({ status: "pending", id: "live-id" }));
    await kv.put(
      "pending:live-id",
      JSON.stringify({
        ext: "jpg",
        r2Key: "live-id.jpg",
        submittedAt: "2026-01-01T00:00:00.000Z",
        contentHash: "hash1",
      }),
    );
    const cleared = await clearStalePendingDedup(
      kv,
      "hash1",
      { status: "pending", id: "live-id" },
    );
    expect(cleared).toBe(false);
    expect(await getDedup(kv, "hash1")).not.toBeNull();
  });

  it("does not clear approved dedup", async () => {
    const kv = mockKv();
    await kv.put("dedup:hash1", JSON.stringify({ status: "approved", id: "live-id" }));
    const cleared = await clearStalePendingDedup(
      kv,
      "hash1",
      { status: "approved", id: "live-id" },
    );
    expect(cleared).toBe(false);
  });
});

function mockKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string, opts?: { type?: string }) => {
      const raw = store.get(key);
      if (raw === undefined) return null;
      if (opts?.type === "json") return JSON.parse(raw);
      return raw;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  } as unknown as KVNamespace;
}
