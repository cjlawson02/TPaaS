import { approvedUrl } from "../shared/r2-keys";
import { CATALOG_CACHE_SECONDS } from "../shared/types";
import type { Catalog } from "../shared/types";

const CATALOG_PATHS = ["/catalog.json", "/", "/gallery"] as const;

export function catalogJsonResponse(catalog: Catalog, assetsBaseUrl: string): Response {
  return Response.json(
    {
      count: catalog.entries.length,
      entries: catalog.entries.map((entry) => ({
        id: entry.id,
        ext: entry.ext,
        url: approvedUrl(assetsBaseUrl, entry.id, entry.ext),
        attribution: entry.attribution ?? null,
      })),
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": `public, max-age=${CATALOG_CACHE_SECONDS}`,
      },
    },
  );
}

export function catalogCacheKey(origin: string, pathname: string): Request {
  return new Request(`${origin}${pathname}`);
}

export async function purgeCatalogEdgeCache(origin: string): Promise<void> {
  await Promise.all(
    CATALOG_PATHS.map((pathname) => caches.default.delete(catalogCacheKey(origin, pathname))),
  );
}

export function cacheCatalogResponse(
  ctx: ExecutionContext,
  cacheKey: Request,
  response: Response,
): void {
  if (!response.ok) return;
  ctx.waitUntil(
    caches.default.put(cacheKey, response.clone()).catch((err) => {
      console.error(JSON.stringify({ event: "edge_cache_put_failed", err: String(err) }));
    }),
  );
}
