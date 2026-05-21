export function clientKey(request: Request, scope: string): string {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  return `${scope}:${ip}`;
}

export async function rateLimited(
  limiter: RateLimit,
  key: string,
): Promise<Response | null> {
  const { success } = await limiter.limit({ key });
  if (success) return null;
  return new Response("Too Many Requests", {
    status: 429,
    headers: { "Retry-After": "60" },
  });
}
