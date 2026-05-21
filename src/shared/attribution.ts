import type { Attribution, AttributionKind } from "./types";

const MAX_LABEL_LENGTH = 120;
const MAX_SOURCE_URL_LENGTH = 512;

const KINDS = new Set<AttributionKind>(["poster", "uploader", "collection"]);

export function parseAttributionForm(form: FormData): Attribution | undefined {
  const label = String(form.get("attribution_label") ?? "").trim();
  const sourceUrl = String(form.get("attribution_source_url") ?? "").trim();
  const kindRaw = String(form.get("attribution_kind") ?? "").trim();

  if (!label && !sourceUrl && !kindRaw) return undefined;
  if (!label) return undefined;

  const kind = parseAttributionKind(kindRaw);
  if (!kind) return undefined;

  const attribution: Attribution = {
    label: label.slice(0, MAX_LABEL_LENGTH),
    kind,
  };

  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl);
      if (url.protocol === "http:" || url.protocol === "https:") {
        attribution.sourceUrl = url.toString().slice(0, MAX_SOURCE_URL_LENGTH);
      }
    } catch {
      // ignore invalid URLs
    }
  }

  return attribution;
}

function parseAttributionKind(raw: string): AttributionKind | null {
  if (KINDS.has(raw as AttributionKind)) return raw as AttributionKind;
  return null;
}

export function parseAttributionJson(value: unknown): Attribution | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const label = typeof record.label === "string" ? record.label.trim() : "";
  const kind = parseAttributionKind(String(record.kind ?? ""));
  if (!label || !kind) return undefined;

  const attribution: Attribution = {
    label: label.slice(0, MAX_LABEL_LENGTH),
    kind,
  };

  if (typeof record.sourceUrl === "string" && record.sourceUrl.trim()) {
    try {
      const url = new URL(record.sourceUrl.trim());
      if (url.protocol === "http:" || url.protocol === "https:") {
        attribution.sourceUrl = url.toString().slice(0, MAX_SOURCE_URL_LENGTH);
      }
    } catch {
      // ignore invalid URLs
    }
  }

  return attribution;
}

export function serializeCatalogEntryValue(attribution?: Attribution): string {
  if (!attribution) return "";
  return JSON.stringify({ attribution });
}
