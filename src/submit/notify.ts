const DISCORD_API = "https://discord.com/api/v10";
const NOTIFY_RETRIES = 3;

const ComponentType = { ActionRow: 1, Button: 2 } as const;
const ButtonStyle = { Success: 3, Danger: 4 } as const;

export async function notifyDiscordReview(env: TpaasEnv, submissionId: string): Promise<void> {
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_REVIEW_CHANNEL_ID) {
    console.error(JSON.stringify({ event: "discord_not_configured", submissionId }));
    return;
  }

  const base = env.SUBMIT_BASE_URL.replace(/\/$/, "");
  const previewUrl = `${base}/preview/pending/${submissionId}`;

  const body = {
    embeds: [
      {
        title: "New trolley problem submission",
        description: `Submission \`${submissionId}\``,
        image: { url: previewUrl },
        color: 0xf1c40f,
      },
    ],
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            style: ButtonStyle.Success,
            label: "Approve",
            custom_id: `approve:${submissionId}`,
          },
          {
            type: ComponentType.Button,
            style: ButtonStyle.Danger,
            label: "Reject",
            custom_id: `reject:${submissionId}`,
          },
        ],
      },
    ],
  };

  const url = `${DISCORD_API}/channels/${env.DISCORD_REVIEW_CHANNEL_ID}/messages`;
  const init: RequestInit = {
    method: "POST",
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };

  for (let attempt = 1; attempt <= NOTIFY_RETRIES; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return;

    const text = await res.text();
    console.error(
      JSON.stringify({
        event: "discord_notify_failed",
        submissionId,
        attempt,
        status: res.status,
        body: text,
      }),
    );

    if (attempt < NOTIFY_RETRIES) {
      await sleep(250 * attempt);
    }
  }
}

export async function updateDiscordMessage(
  env: TpaasEnv,
  applicationId: string,
  token: string,
  content: string,
): Promise<void> {
  if (!env.DISCORD_BOT_TOKEN) return;

  const res = await fetch(
    `${DISCORD_API}/webhooks/${applicationId}/${token}/messages/@original`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        embeds: [],
        components: [],
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(
      JSON.stringify({
        event: "discord_update_failed",
        status: res.status,
        body: text,
      }),
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
