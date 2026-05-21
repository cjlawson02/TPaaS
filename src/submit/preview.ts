import { getPending } from "../shared/catalog";
import { contentTypeForExt } from "../shared/image-validation";

export async function handlePendingPreview(
  env: TpaasEnv,
  id: string,
): Promise<Response> {
  const pending = await getPending(env.TPAAS_KV, id);
  if (!pending) {
    return new Response("Not Found", { status: 404 });
  }

  const object = await env.TPAAS_PENDING_R2.get(pending.r2Key);
  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType ?? contentTypeForExt(pending.ext),
  );
  headers.set("Cache-Control", "private, no-store");

  return new Response(object.body, { headers });
}
