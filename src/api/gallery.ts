import { approvedUrl } from "../shared/r2-keys";
import { CATALOG_CACHE_SECONDS } from "../shared/types";
import type { Attribution, Catalog } from "../shared/types";
import { escapeHtml } from "../shared/html";
import { galleryEmbedMeta } from "./embed-meta";

function attributionCaption(attribution: Attribution): string {
  const label = escapeHtml(attribution.label);
  if (attribution.sourceUrl) {
    const href = escapeHtml(attribution.sourceUrl);
    return `<figcaption class="credit"><a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a></figcaption>`;
  }
  return `<figcaption class="credit">${label}</figcaption>`;
}

export function galleryPage(
  catalog: Catalog,
  assetsBaseUrl: string,
  pageUrl: string,
): Response {
  const previewEntry = catalog.entries[0];
  const previewImageUrl = previewEntry
    ? approvedUrl(assetsBaseUrl, previewEntry.id, previewEntry.ext)
    : undefined;
  const embedMeta = galleryEmbedMeta(
    catalog.entries.length,
    pageUrl,
    previewImageUrl,
    previewEntry?.ext,
  );

  const body =
    catalog.entries.length === 0
      ? '<p class="empty">No approved trolley problems yet.</p>'
      : `<div class="grid">${catalog.entries
          .map((entry) => {
            const url = approvedUrl(assetsBaseUrl, entry.id, entry.ext);
            const credit = entry.attribution ? attributionCaption(entry.attribution) : "";
            return `<figure class="tile">
                <a href="${url}" target="_blank" rel="noopener">
                  <img src="${url}" alt="" loading="lazy" width="200" height="200">
                </a>
                ${credit}
              </figure>`;
          })
          .join("\n")}</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TPaaS Gallery</title>
  ${embedMeta}
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, sans-serif;
      background: #0f0f12;
      color: #e8e6e3;
      padding: 1.5rem;
    }
    header { margin-bottom: 1.5rem; }
    h1 { font-size: 1.25rem; margin: 0 0 0.25rem; }
    .meta { font-size: 0.875rem; color: #9a9690; }
    .meta a { color: #d4a72c; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 0.75rem;
    }
    .tile {
      display: block;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #2e2e38;
      background: #1a1a20;
      margin: 0;
    }
    .tile a {
      display: block;
    }
    .tile img {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      display: block;
    }
    .credit {
      margin: 0;
      padding: 0.35rem 0.5rem;
      font-size: 0.6875rem;
      color: #9a9690;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .credit a {
      color: #d4a72c;
      text-decoration: none;
    }
    .credit a:hover {
      text-decoration: underline;
    }
    .empty { color: #9a9690; margin: 0; }
  </style>
</head>
<body>
  <header>
    <h1>TPaaS Gallery</h1>
    <p class="meta">${catalog.entries.length} approved · <a href="/random">random</a> · <a href="/request">submit</a></p>
  </header>
  ${body}
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": `public, max-age=${CATALOG_CACHE_SECONDS}`,
    },
  });
}
