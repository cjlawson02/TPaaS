import { clientKey, rateLimited } from "../shared/rate-limit";
import { findCachedEntry, getCatalog, pickRandom } from "./catalog-cache";
import { galleryPage } from "./gallery";
import { approvedUrl } from "../shared/r2-keys";

const UUID_PATH = /^\/([0-9a-f-]{36})$/i;

export async function handleApiRequest(
  request: Request,
  env: TpaasEnv,
  _ctx: ExecutionContext,
): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const scope = rateLimitScope(url.pathname);
    if (scope) {
      const limited = await rateLimited(env.API_LIMIT, clientKey(request, scope));
      if (limited) return limited;
    }

    if (url.pathname === "/" || url.pathname === "/gallery") {
      const catalog = await getCatalog(env.TPAAS_KV);
      return galleryPage(catalog, env.ASSETS_BASE_URL);
    }

    if (url.pathname === "/random") {
      const catalog = await getCatalog(env.TPAAS_KV);
      const entry = pickRandom(catalog.entries);
      if (!entry) {
        return new Response("No approved trolley problems yet", { status: 404 });
      }
      const target = approvedUrl(env.ASSETS_BASE_URL, entry.id, entry.ext);
      return redirectTo(target, "no-store");
    }

    const idMatch = url.pathname.match(UUID_PATH);
    if (idMatch) {
      const id = idMatch[1]!.toLowerCase();
      const catalog = await getCatalog(env.TPAAS_KV);
      const entry = findCachedEntry(id) ?? catalog.entries.find((e) => e.id === id);
      if (!entry) {
        return new Response("Not Found", { status: 404 });
      }
      const target = approvedUrl(env.ASSETS_BASE_URL, entry.id, entry.ext);
      return redirectTo(target, "public, max-age=3600");
    }

    return new Response("Not Found", { status: 404 });
}

function redirectTo(location: string, cacheControl: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": cacheControl,
    },
  });
}

function rateLimitScope(pathname: string): "random" | "gallery" | "by-id" | null {
  if (pathname === "/random") return "random";
  if (pathname === "/" || pathname === "/gallery") return "gallery";
  if (UUID_PATH.test(pathname)) return "by-id";
  return null;
}
