import { putPending } from "../shared/catalog";
import { parseAttributionForm } from "../shared/attribution";
import {
  claimDedup,
  clearStalePendingDedup,
  duplicateErrorMessage,
  deleteDedup,
  getDedup,
} from "../shared/dedup";
import { sha256Hex } from "../shared/hash";
import { validateImageBytes } from "../shared/image-validation";
import { newId } from "../shared/ids";
import { pendingKey } from "../shared/r2-keys";
import { MAX_IMAGE_BYTES } from "../shared/types";

const MULTIPART_OVERHEAD_BYTES = 65_536;

export type SubmitSuccess = { ok: true; id: string };
export type SubmitFailure = { ok: false; response: Response };

export async function handleSubmit(
  request: Request,
  env: TpaasEnv,
): Promise<SubmitSuccess | SubmitFailure> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return {
      ok: false,
      response: Response.json(
        { error: "Expected multipart/form-data with field 'image'" },
        { status: 400 },
      ),
    };
  }

  const contentLength = request.headers.get("Content-Length");
  if (contentLength) {
    const bytes = Number(contentLength);
    if (Number.isFinite(bytes) && bytes > MAX_IMAGE_BYTES + MULTIPART_OVERHEAD_BYTES) {
      return {
        ok: false,
        response: Response.json(
          { error: "Invalid image: must be JPEG or PNG, max 5MB" },
          { status: 413 },
        ),
      };
    }
  }

  const form = await request.formData();
  const file = form.get("image") as string | Blob | null;
  if (!file || typeof file === "string") {
    return {
      ok: false,
      response: Response.json({ error: "Missing 'image' file field" }, { status: 400 }),
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validated = validateImageBytes(bytes);
  if (!validated) {
    return {
      ok: false,
      response: Response.json(
        { error: "Invalid image: must be JPEG or PNG, max 5MB" },
        { status: 413 },
      ),
    };
  }

  const contentHash = await sha256Hex(validated.bytes);

  let existing = await getDedup(env.TPAAS_KV, contentHash);
  if (existing && (await clearStalePendingDedup(env.TPAAS_KV, contentHash, existing))) {
    existing = null;
  }
  if (existing) {
    return {
      ok: false,
      response: Response.json(
        { error: duplicateErrorMessage(existing), duplicateOf: existing.id, status: existing.status },
        { status: 409 },
      ),
    };
  }

  const id = newId();
  const attribution = parseAttributionForm(form);
  const lostRace = await claimDedup(env.TPAAS_KV, contentHash, id);
  if (lostRace) {
    return {
      ok: false,
      response: Response.json(
        { error: duplicateErrorMessage(lostRace), duplicateOf: lostRace.id, status: lostRace.status },
        { status: 409 },
      ),
    };
  }

  const key = pendingKey(id, validated.ext);

  try {
    await env.TPAAS_PENDING_R2.put(key, validated.bytes, {
      httpMetadata: { contentType: validated.contentType },
    });
    await putPending(env.TPAAS_KV, id, {
      ext: validated.ext,
      r2Key: key,
      submittedAt: new Date().toISOString(),
      contentHash,
      ...(attribution ? { attribution } : {}),
    });
  } catch (err) {
    console.error(JSON.stringify({ event: "submit_failed", id, err: String(err) }));
    await Promise.all([
      env.TPAAS_PENDING_R2.delete(key),
      deleteDedup(env.TPAAS_KV, contentHash),
    ]).catch(() => {});
    return {
      ok: false,
      response: Response.json({ error: "Submit failed" }, { status: 500 }),
    };
  }

  return { ok: true, id };
}
