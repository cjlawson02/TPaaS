import { InteractionResponseType, InteractionType } from "discord-interactions";
import { approveSubmission, rejectSubmission } from "./approve";
import {
  authenticateDiscordRequest,
  authorizeReviewInteraction,
} from "./discord-auth";
import { updateDiscordMessage } from "./notify";

/**
 * Approve/reject is only reachable through this handler.
 * AuthN: Discord Ed25519 signature + timestamp window.
 * AuthZ: application id, review channel, allowlisted Discord user ids.
 */
export async function handleDiscordInteraction(
  request: Request,
  env: TpaasEnv,
  ctx: ExecutionContext,
): Promise<Response> {
  const auth = await authenticateDiscordRequest(request, env.DISCORD_PUBLIC_KEY);
  if (!auth.ok) return auth.response;
  if ("ping" in auth) {
    return jsonResponse({ type: InteractionResponseType.PONG });
  }

  const interaction = auth.interaction;

  if (interaction.type !== InteractionType.MESSAGE_COMPONENT) {
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "Unsupported interaction type", flags: 64 },
    });
  }

  const authzError = authorizeReviewInteraction(interaction, env);
  if (authzError) {
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: authzError, flags: 64 },
    });
  }

  const customId = interaction.data?.custom_id ?? "";
  const match = customId.match(/^(approve|reject):([0-9a-f-]{36})$/i);
  if (!match) {
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "Unknown action", flags: 64 },
    });
  }

  const action = match[1]!;
  const submissionId = match[2]!;
  const appId = interaction.application_id;
  const token = interaction.token;

  ctx.waitUntil(
    (async () => {
      try {
        let message: string;
        if (action === "approve") {
          const result = await approveSubmission(env, submissionId);
          message = result.ok
            ? `Approved \`${submissionId}\` — now live on TPaaS`
            : `Approve failed: ${result.error}`;
        } else {
          const result = await rejectSubmission(env, submissionId);
          message = result.ok
            ? `Rejected \`${submissionId}\``
            : `Reject failed: ${result.error}`;
        }

        if (appId && token) {
          await updateDiscordMessage(env, appId, token, message);
        }
      } catch (err) {
        console.error(JSON.stringify({ event: "discord_interaction_failed", err: String(err) }));
        if (appId && token) {
          await updateDiscordMessage(env, appId, token, "Review action failed unexpectedly").catch(
            () => {},
          );
        }
      }
    })(),
  );

  return jsonResponse({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
  });
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}
