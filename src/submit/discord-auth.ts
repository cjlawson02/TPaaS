import { InteractionType, verifyKey } from "discord-interactions";

const MAX_TIMESTAMP_SKEW_SEC = 300;

export interface DiscordMessageComponentInteraction {
  type: number;
  application_id?: string;
  token?: string;
  channel_id?: string;
  member?: { user?: { id?: string } };
  user?: { id?: string };
  message?: { channel_id?: string };
  data?: { custom_id?: string };
}

export type DiscordAuthResult =
  | { ok: true; ping: true }
  | { ok: true; interaction: DiscordMessageComponentInteraction }
  | { ok: false; response: Response };

/** AuthN: request is from Discord (Ed25519 + fresh timestamp). */
export async function authenticateDiscordRequest(
  request: Request,
  publicKey: string,
): Promise<DiscordAuthResult> {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  const body = await request.text();

  if (!signature || !timestamp || !publicKey) {
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
  }

  if (!isTimestampFresh(timestamp)) {
    return { ok: false, response: new Response("Stale request", { status: 401 }) };
  }

  const valid = await verifyKey(body, signature, timestamp, publicKey);
  if (!valid) {
    return { ok: false, response: new Response("Invalid request signature", { status: 401 }) };
  }

  let interaction: DiscordMessageComponentInteraction;
  try {
    interaction = JSON.parse(body) as DiscordMessageComponentInteraction;
  } catch {
    return { ok: false, response: new Response("Invalid interaction payload", { status: 400 }) };
  }

  if (interaction.type === InteractionType.PING) {
    return { ok: true, ping: true };
  }

  return { ok: true, interaction };
}

/** AuthZ: only configured reviewers may approve/reject in the review channel for this app. */
export function authorizeReviewInteraction(
  interaction: DiscordMessageComponentInteraction,
  env: {
    DISCORD_APPLICATION_ID: string;
    DISCORD_REVIEW_CHANNEL_ID: string;
    DISCORD_REVIEW_USER_IDS: string;
  },
): string | null {
  if (
    !env.DISCORD_APPLICATION_ID ||
    interaction.application_id !== env.DISCORD_APPLICATION_ID
  ) {
    return "Invalid application";
  }

  const channelId = interaction.channel_id ?? interaction.message?.channel_id;
  if (!channelId || channelId !== env.DISCORD_REVIEW_CHANNEL_ID) {
    return "Review actions are only allowed in the review channel";
  }

  const userId = interaction.member?.user?.id ?? interaction.user?.id;
  if (!userId) {
    return "Could not identify reviewer";
  }

  const allowed = parseReviewerIds(env.DISCORD_REVIEW_USER_IDS);
  if (allowed.size === 0) {
    return "Reviewers are not configured";
  }
  if (!allowed.has(userId)) {
    return "You are not authorized to review submissions";
  }

  return null;
}

let cachedReviewers: { raw: string; ids: Set<string> } | null = null;

export function parseReviewerIds(raw: string): Set<string> {
  if (cachedReviewers?.raw === raw) return cachedReviewers.ids;

  const ids = new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  cachedReviewers = { raw, ids };
  return ids;
}

function isTimestampFresh(timestampHeader: string): boolean {
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - ts) <= MAX_TIMESTAMP_SKEW_SEC;
}
