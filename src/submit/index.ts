import { clientKey, rateLimited } from "../shared/rate-limit";
import { handleDiscordInteraction } from "./discord";
import { handleSubmit } from "./handler";
import { notifyDiscordReview } from "./notify";
import { SUBMIT_PAGE_HTML } from "./page";
import { handlePendingPreview } from "./preview";

const PREVIEW_PATH = /^\/preview\/pending\/([0-9a-f-]{36})$/i;

export async function handleSubmitRequest(
  request: Request,
  env: TpaasEnv,
  ctx: ExecutionContext,
): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/request") {
      return submitPage();
    }

    if (request.method === "POST" && url.pathname === "/submit") {
      const limited = await rateLimited(
        env.SUBMIT_LIMIT,
        clientKey(request, "submit"),
      );
      if (limited) return limited;

      if (crossOriginSubmit(request)) {
        return Response.json({ error: "Cross-origin submit rejected" }, { status: 403 });
      }

      const result = await handleSubmit(request, env);
      if (!result.ok) return result.response;

      ctx.waitUntil(notifyDiscordReview(env, result.id));
      return Response.json({ id: result.id, status: "pending" }, { status: 202 });
    }

    if (request.method === "POST" && url.pathname === "/discord/interactions") {
      const limited = await rateLimited(
        env.DISCORD_LIMIT,
        clientKey(request, "discord"),
      );
      if (limited) return limited;
      return handleDiscordInteraction(request, env, ctx);
    }

    const previewMatch = url.pathname.match(PREVIEW_PATH);
    if (request.method === "GET" && previewMatch) {
      const limited = await rateLimited(
        env.PREVIEW_LIMIT,
        clientKey(request, "preview"),
      );
      if (limited) return limited;
      return handlePendingPreview(env, previewMatch[1]!);
    }

    return new Response("Not Found", { status: 404 });
}

function submitPage(): Response {
  return new Response(SUBMIT_PAGE_HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function crossOriginSubmit(request: Request): boolean {
  const self = new URL(request.url).host;
  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      return new URL(origin).host !== self;
    } catch {
      return true;
    }
  }
  const referer = request.headers.get("Referer");
  if (referer) {
    try {
      return new URL(referer).host !== self;
    } catch {
      return true;
    }
  }
  return false;
}
