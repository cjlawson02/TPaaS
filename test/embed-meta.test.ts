import { describe, expect, it } from "vitest";
import {
  canonicalPageUrl,
  embedMetaTags,
  galleryEmbedMeta,
  isEmbedCrawler,
  memeDescription,
  memeEmbedResponse,
} from "../src/api/embed-meta";

describe("isEmbedCrawler", () => {
  it("detects Discord, Slack, and Teams crawlers", () => {
    expect(
      isEmbedCrawler(
        new Request("https://tpaas.test/random", {
          headers: { "User-Agent": "Discordbot/2.0" },
        }),
      ),
    ).toBe(true);
    expect(
      isEmbedCrawler(
        new Request("https://tpaas.test/random", {
          headers: { "User-Agent": "Slackbot-LinkExpanding 1.0" },
        }),
      ),
    ).toBe(true);
    expect(
      isEmbedCrawler(
        new Request("https://tpaas.test/random", {
          headers: { "User-Agent": "SkypeUriPreview Preview/0.5" },
        }),
      ),
    ).toBe(true);
  });

  it("does not flag normal browsers or missing user agents", () => {
    expect(
      isEmbedCrawler(
        new Request("https://tpaas.test/random", {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
        }),
      ),
    ).toBe(false);
    expect(isEmbedCrawler(new Request("https://tpaas.test/random"))).toBe(false);
  });
});

describe("canonicalPageUrl", () => {
  it("drops query strings from og:url sources", () => {
    expect(
      canonicalPageUrl(new URL("https://tpaas.test/gallery?utm_source=slack")),
    ).toBe("https://tpaas.test/gallery");
  });
});

describe("embedMetaTags", () => {
  it("includes Open Graph and Twitter card tags with image", () => {
    const tags = embedMetaTags({
      title: "Test Title",
      description: "Test description",
      pageUrl: "https://tpaas.test/random",
      imageUrl: "https://assets.tpaas.test/approved/id.jpg",
      imageMimeType: "image/jpeg",
    });

    expect(tags).toContain('property="og:title" content="Test Title"');
    expect(tags).toContain('property="og:image" content="https://assets.tpaas.test/approved/id.jpg"');
    expect(tags).toContain(
      'property="og:image:secure_url" content="https://assets.tpaas.test/approved/id.jpg"',
    );
    expect(tags).toContain('property="og:image:type" content="image/jpeg"');
    expect(tags).toContain('name="twitter:card" content="summary_large_image"');
    expect(tags).toContain('name="twitter:image" content="https://assets.tpaas.test/approved/id.jpg"');
  });

  it("escapes HTML in attribute values", () => {
    const tags = embedMetaTags({
      title: 'Meme "special" & fun',
      description: "A <tag>",
      pageUrl: "https://tpaas.test/",
    });

    expect(tags).toContain('content="Meme &quot;special&quot; &amp; fun"');
    expect(tags).toContain('content="A &lt;tag&gt;"');
  });

  it("escapes single quotes in attribute values", () => {
    const tags = embedMetaTags({
      title: "it's fine",
      description: "desc",
      pageUrl: "https://tpaas.test/",
    });

    expect(tags).toContain("content=\"it&#39;s fine\"");
  });
});

describe("galleryEmbedMeta", () => {
  it("describes catalog size and preview image", () => {
    const tags = galleryEmbedMeta(
      3,
      "https://tpaas.test/gallery",
      "https://assets/img.jpg",
      "png",
    );
    expect(tags).toContain("3 approved trolley problems");
    expect(tags).toContain("https://assets/img.jpg");
    expect(tags).toContain('property="og:image:type" content="image/png"');
  });
});

describe("memeEmbedResponse", () => {
  it("returns uncached HTML with og:image for meme pages", async () => {
    const response = memeEmbedResponse(
      { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", ext: "jpg" },
      "https://tpaas.test/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "https://assets.tpaas.test",
    );

    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const html = await response.text();
    expect(html).toContain('property="og:image"');
    expect(html).toContain('property="og:url" content="https://tpaas.test/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"');
    expect(html).toContain("https://assets.tpaas.test/approved/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg");
  });
});

describe("memeDescription", () => {
  it("includes attribution label when present", () => {
    expect(
      memeDescription({
        id: "x",
        ext: "png",
        attribution: { label: "Alice", kind: "poster" },
      }),
    ).toContain("Alice");
  });
});
