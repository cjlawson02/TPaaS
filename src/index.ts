import { handleApiRequest } from "./api/index";
import { handleSubmitRequest } from "./submit/index";

const PREVIEW_PATH = /^\/preview\/pending\/[0-9a-f-]{36}$/i;

export default {
  async fetch(request: Request, env: TpaasEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true });
    }

    if (isSubmitRoute(url.pathname, request.method)) {
      return handleSubmitRequest(request, env, ctx);
    }

    return handleApiRequest(request, env, ctx);
  },
};

function isSubmitRoute(pathname: string, method: string): boolean {
  if (method === "GET" && pathname === "/request") return true;
  if (method === "POST" && (pathname === "/submit" || pathname === "/discord/interactions")) {
    return true;
  }
  if (method === "GET" && PREVIEW_PATH.test(pathname)) return true;
  return false;
}
