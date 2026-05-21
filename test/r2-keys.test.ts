import { describe, expect, it } from "vitest";
import { approvedKey, approvedUrl, pendingKey } from "../src/shared/r2-keys";

describe("r2-keys", () => {
  it("builds pending key for private bucket", () => {
    expect(pendingKey("abc", "png")).toBe("abc.png");
  });

  it("builds approved key", () => {
    expect(approvedKey("abc", "jpg")).toBe("approved/abc.jpg");
  });

  it("builds approved URL without trailing slash on base", () => {
    expect(approvedUrl("https://assets.example.com", "abc", "jpg")).toBe(
      "https://assets.example.com/approved/abc.jpg",
    );
  });

  it("strips trailing slash from base URL", () => {
    expect(approvedUrl("https://assets.example.com/", "abc", "png")).toBe(
      "https://assets.example.com/approved/abc.png",
    );
  });
});
