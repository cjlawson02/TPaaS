import { MAX_IMAGE_BYTES, type ImageExt } from "./types";

export interface ValidatedImage {
  ext: ImageExt;
  contentType: string;
  bytes: Uint8Array;
}

const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

function matchesMagic(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic[i]) return false;
  }
  return true;
}

export function detectImageExt(bytes: Uint8Array): ImageExt | null {
  if (matchesMagic(bytes, JPEG_MAGIC)) return "jpg";
  if (matchesMagic(bytes, PNG_MAGIC)) return "png";
  return null;
}

export function contentTypeForExt(ext: ImageExt): string {
  return ext === "jpg" ? "image/jpeg" : "image/png";
}

export function validateImageBytes(bytes: Uint8Array): ValidatedImage | null {
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
  const ext = detectImageExt(bytes);
  if (!ext) return null;
  return { ext, contentType: contentTypeForExt(ext), bytes };
}
