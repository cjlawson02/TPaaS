import { approvedUrl } from "../shared/r2-keys";
import type { CatalogEntry } from "../shared/types";

const EMBED_CRAWLER =
  /discordbot|slackbot|facebookexternalhit|twitterbot|linkedinbot|embedly|whatsapp|telegrambot/i;

export function isEmbedCrawler(request: Request): boolean {
  const ua = request.headers.get("User-Agent") ?? "";
  return EMBED_CRAWLER.test(ua);
}

export interface EmbedMeta {
  title: string;
  description: string;
  pageUrl: string;
  imageUrl?: string;
  siteName?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

export function embedMetaTags(meta: EmbedMeta): string {
  const siteName = meta.siteName ?? "TPaaS";
  const tags = [
    `<meta name="description" content="${escapeAttr(meta.description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeAttr(siteName)}">`,
    `<meta property="og:title" content="${escapeAttr(meta.title)}">`,
    `<meta property="og:description" content="${escapeAttr(meta.description)}">`,
    `<meta property="og:url" content="${escapeAttr(meta.pageUrl)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(meta.title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(meta.description)}">`,
  ];

  if (meta.imageUrl) {
    tags.push(`<meta property="og:image" content="${escapeAttr(meta.imageUrl)}">`);
    tags.push(`<meta name="twitter:image" content="${escapeAttr(meta.imageUrl)}">`);
  }

  return tags.join("\n  ");
}

export function memeDescription(entry: CatalogEntry): string {
  if (entry.attribution?.label) {
    return `Trolley problem meme — credit: ${entry.attribution.label}`;
  }
  return "Random approved trolley problem meme from TPaaS.";
}

export function memeEmbedResponse(
  entry: CatalogEntry,
  pageUrl: string,
  assetsBaseUrl: string,
  cacheControl: string,
): Response {
  const imageUrl = approvedUrl(assetsBaseUrl, entry.id, entry.ext);
  const title = "Trolley Problem — TPaaS";
  const description = memeDescription(entry);
  const meta: EmbedMeta = { title, description, pageUrl, imageUrl };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  ${embedMetaTags(meta)}
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100dvh;
      font-family: system-ui, sans-serif;
      background: #0f0f12;
      color: #e8e6e3;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      gap: 1rem;
    }
    img {
      max-width: min(100%, 32rem);
      height: auto;
      border-radius: 8px;
      border: 1px solid #2e2e38;
    }
    p { margin: 0; color: #9a9690; font-size: 0.875rem; text-align: center; }
    a { color: #d4a72c; }
  </style>
</head>
<body>
  <img src="${escapeAttr(imageUrl)}" alt="Trolley problem meme">
  <p><a href="${escapeAttr(imageUrl)}">Open image</a> · <a href="/">Gallery</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": cacheControl,
    },
  });
}

export function galleryEmbedMeta(
  entryCount: number,
  pageUrl: string,
  previewImageUrl?: string,
): string {
  const title = "TPaaS Gallery";
  const description =
    entryCount === 0
      ? "No approved trolley problems yet — submit one!"
      : `${entryCount} approved trolley problem${entryCount === 1 ? "" : "s"}`;

  return embedMetaTags({
    title,
    description,
    pageUrl,
    imageUrl: previewImageUrl,
  });
}
