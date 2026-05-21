import { approvedUrl } from "../shared/r2-keys";
import type { Catalog } from "../shared/types";

export function galleryPage(catalog: Catalog, assetsBaseUrl: string): Response {
  const body =
    catalog.entries.length === 0
      ? '<p class="empty">No approved trolley problems yet.</p>'
      : `<div class="grid">${catalog.entries
          .map((entry) => {
            const url = approvedUrl(assetsBaseUrl, entry.id, entry.ext);
            return `<a class="tile" href="${url}" target="_blank" rel="noopener">
                <img src="${url}" alt="" loading="lazy" width="200" height="200">
              </a>`;
          })
          .join("\n")}</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TPaaS Gallery</title>
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
    }
    .tile img {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      display: block;
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
      "Cache-Control": "public, max-age=60",
    },
  });
}
