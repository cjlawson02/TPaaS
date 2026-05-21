import { env } from "cloudflare:workers";
import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../../src/index";
import { readCatalog } from "../../src/shared/catalog";
import { getDedup } from "../../src/shared/dedup";
import { sha256Hex } from "../../src/shared/hash";
import { approvedKey, pendingKey } from "../../src/shared/r2-keys";
import { CATALOG_MANIFEST_KEY } from "../../src/shared/types";
import { approveSubmission } from "../../src/submit/approve";
import { MINIMAL_PNG, uniqueJpeg } from "../fixtures/minimal-images";
import type { TestEnv } from "./env";

const testEnv = env as TestEnv;

async function submitImage(bytes: Uint8Array, type: string, name: string): Promise<Response> {
  const form = new FormData();
  form.append("image", new Blob([bytes], { type }), name);
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new Request("https://tpaas.test/submit", { method: "POST", body: form }),
    testEnv,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return response;
}

describe("submit → approve → serve", () => {
  it("uploads via HTTP, approves into catalog, and serves from /random", async () => {
    const image = uniqueJpeg(1);
    const submitRes = await submitImage(image, "image/jpeg", "meme.jpg");
    expect(submitRes.status).toBe(202);
    const { id } = (await submitRes.json()) as { id: string };

    expect(await approveSubmission(testEnv, id)).toEqual({ ok: true });

    const catalog = await readCatalog(testEnv.TPAAS_KV);
    expect(catalog.entries).toContainEqual({ id, ext: "jpg" });

    const manifestRaw = await testEnv.TPAAS_KV.get(CATALOG_MANIFEST_KEY);
    expect(manifestRaw).toContain(id);

    const hash = await sha256Hex(image);
    expect(await getDedup(testEnv.TPAAS_KV, hash)).toEqual({ status: "approved", id });

    const apiCtx = createExecutionContext();
    const randomRes = await worker.fetch(
      new Request("https://tpaas.test/random"),
      testEnv,
      apiCtx,
    );
    await waitOnExecutionContext(apiCtx);
    expect(randomRes.status).toBe(200);
    expect(randomRes.headers.get("Content-Type")).toBe("image/jpeg");
    expect(randomRes.headers.get("Cache-Control")).toBe("no-store");
    expect(new Uint8Array(await randomRes.arrayBuffer())).toEqual(image);

    expect(await testEnv.TPAAS_R2.get(approvedKey(id, "jpg"))).not.toBeNull();
    expect(await testEnv.TPAAS_PENDING_R2.get(pendingKey(id, "jpg"))).toBeNull();
  });

  it("rejects duplicate bytes with 409 after approval", async () => {
    const image = MINIMAL_PNG;
    const first = await submitImage(image, "image/png", "first.png");
    expect(first.status).toBe(202);
    const { id } = (await first.json()) as { id: string };
    expect(await approveSubmission(testEnv, id)).toEqual({ ok: true });

    const dup = await submitImage(image, "image/png", "second.png");
    expect(dup.status).toBe(409);
    const body = (await dup.json()) as { duplicateOf: string; status: string };
    expect(body.status).toBe("approved");
    expect(body.duplicateOf).toBe(id);
  });

  it("cleans orphaned pending on re-approve without dropping approved dedup", async () => {
    const image = uniqueJpeg(2);
    const submitRes = await submitImage(image, "image/jpeg", "orphan.jpg");
    const { id } = (await submitRes.json()) as { id: string };
    expect(await approveSubmission(testEnv, id)).toEqual({ ok: true });

    const hash = await sha256Hex(image);
    await testEnv.TPAAS_KV.put(
      `pending:${id}`,
      JSON.stringify({
        ext: "jpg",
        r2Key: pendingKey(id, "jpg"),
        submittedAt: new Date().toISOString(),
        contentHash: hash,
      }),
    );
    await testEnv.TPAAS_PENDING_R2.put(pendingKey(id, "jpg"), image, {
      httpMetadata: { contentType: "image/jpeg" },
    });

    expect(await approveSubmission(testEnv, id)).toEqual({ ok: true });
    expect(await getDedup(testEnv.TPAAS_KV, hash)).toEqual({ status: "approved", id });
    expect(await testEnv.TPAAS_KV.get(`pending:${id}`)).toBeNull();
    expect(await testEnv.TPAAS_PENDING_R2.get(pendingKey(id, "jpg"))).toBeNull();

    const dup = await submitImage(image, "image/jpeg", "blocked.jpg");
    expect(dup.status).toBe(409);
  });
});
