import { describe, expect, it } from "vitest";
import { sha256Hex } from "../src/shared/hash";

describe("sha256Hex", () => {
  it("hashes empty input", async () => {
    const hash = await sha256Hex(new Uint8Array());
    expect(hash).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("returns consistent hex for same bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(await sha256Hex(bytes)).toBe(await sha256Hex(bytes));
  });
});
