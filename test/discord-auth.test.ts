import { describe, expect, it } from "vitest";
import {
  authorizeReviewInteraction,
  parseReviewerIds,
  type DiscordMessageComponentInteraction,
} from "../src/submit/discord-auth";

type ReviewEnv = {
  DISCORD_APPLICATION_ID: string;
  DISCORD_REVIEW_CHANNEL_ID: string;
  DISCORD_REVIEW_USER_IDS: string;
};

const env: ReviewEnv = {
  DISCORD_APPLICATION_ID: "app123",
  DISCORD_REVIEW_CHANNEL_ID: "chan456",
  DISCORD_REVIEW_USER_IDS: "user789,user000",
};

function interaction(
  overrides: Partial<DiscordMessageComponentInteraction> = {},
): DiscordMessageComponentInteraction {
  return {
    type: 3,
    application_id: "app123",
    channel_id: "chan456",
    member: { user: { id: "user789" } },
    data: { custom_id: "approve:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
    ...overrides,
  };
}

describe("parseReviewerIds", () => {
  it("parses comma-separated ids", () => {
    expect(parseReviewerIds(" 1 , 2 ,3 ")).toEqual(new Set(["1", "2", "3"]));
  });
});

describe("authorizeReviewInteraction", () => {
  it("allows configured reviewer in review channel", () => {
    expect(authorizeReviewInteraction(interaction(), env)).toBeNull();
  });

  it("rejects wrong application", () => {
    expect(
      authorizeReviewInteraction(interaction({ application_id: "other" }), env),
    ).toBe("Invalid application");
  });

  it("rejects wrong channel", () => {
    expect(
      authorizeReviewInteraction(interaction({ channel_id: "other" }), env),
    ).toBe("Review actions are only allowed in the review channel");
  });

  it("rejects user not in allowlist", () => {
    expect(
      authorizeReviewInteraction(
        interaction({ member: { user: { id: "stranger" } } }),
        env,
      ),
    ).toBe("You are not authorized to review submissions");
  });

  it("rejects empty application id config", () => {
    expect(
      authorizeReviewInteraction(interaction(), {
        ...env,
        DISCORD_APPLICATION_ID: "",
      }),
    ).toBe("Invalid application");
  });

  it("rejects when allowlist empty", () => {
    expect(
      authorizeReviewInteraction(interaction(), {
        ...env,
        DISCORD_REVIEW_USER_IDS: "",
      }),
    ).toBe("Reviewers are not configured");
  });
});
