import { describe, expect, it } from "vitest";
import { clientKey } from "../src/shared/rate-limit";

describe("clientKey", () => {
  it("uses CF-Connecting-IP and scope", () => {
    const req = new Request("https://tpaas.chrislawson.dev/random", {
      headers: { "CF-Connecting-IP": "203.0.113.1" },
    });
    expect(clientKey(req, "api")).toBe("api:203.0.113.1");
  });

  it("falls back when IP header missing", () => {
    const req = new Request("https://tpaas.chrislawson.dev/random");
    expect(clientKey(req, "api")).toBe("api:unknown");
  });
});
