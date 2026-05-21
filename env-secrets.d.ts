/** Discord secrets — not in wrangler.jsonc; set via GitHub secrets or .dev.vars */
interface TpaasEnv {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_BOT_TOKEN: string;
  DISCORD_REVIEW_USER_IDS: string;
}
