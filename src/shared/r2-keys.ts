import type { ImageExt } from "./types";

/** Key in the private pending bucket (no public domain). */
export function pendingKey(id: string, ext: ImageExt): string {
  return `${id}.${ext}`;
}

/** Key in the public assets bucket — only approved memes are published here. */
export function approvedKey(id: string, ext: ImageExt): string {
  return `approved/${id}.${ext}`;
}

export function approvedUrl(baseUrl: string, id: string, ext: ImageExt): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/approved/${id}.${ext}`;
}
