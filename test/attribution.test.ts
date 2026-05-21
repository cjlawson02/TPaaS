import { describe, expect, it } from "vitest";
import { parseAttributionForm, parseAttributionJson } from "../src/shared/attribution";

describe("parseAttributionForm", () => {
  it("returns undefined when all fields are empty", () => {
    const form = new FormData();
    expect(parseAttributionForm(form)).toBeUndefined();
  });

  it("returns undefined when label is missing", () => {
    const form = new FormData();
    form.set("attribution_kind", "poster");
    expect(parseAttributionForm(form)).toBeUndefined();
  });

  it("parses valid attribution", () => {
    const form = new FormData();
    form.set("attribution_label", "banana_peel506");
    form.set("attribution_kind", "poster");
    form.set("attribution_source_url", "https://reddit.com/r/trolleyproblem/comments/abc/");
    expect(parseAttributionForm(form)).toEqual({
      label: "banana_peel506",
      kind: "poster",
      sourceUrl: "https://reddit.com/r/trolleyproblem/comments/abc/",
    });
  });

  it("ignores invalid source URLs", () => {
    const form = new FormData();
    form.set("attribution_label", "someone");
    form.set("attribution_kind", "uploader");
    form.set("attribution_source_url", "not-a-url");
    expect(parseAttributionForm(form)).toEqual({
      label: "someone",
      kind: "uploader",
    });
  });
});

describe("parseAttributionJson", () => {
  it("parses stored attribution", () => {
    expect(
      parseAttributionJson({
        label: "Anyone00",
        kind: "uploader",
        sourceUrl: "https://knowyourmeme.com/photos/123",
      }),
    ).toEqual({
      label: "Anyone00",
      kind: "uploader",
      sourceUrl: "https://knowyourmeme.com/photos/123",
    });
  });
});
