import path from "node:path";
import { randomBytes } from "node:crypto";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "jfif", "webp", "gif", "heic", "bmp", "tif", "tiff"]);

const EXTENSION_ALIASES: Record<string, string> = {
  jfif: "jpg",
  tif: "tiff",
};

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  bmp: "image/bmp",
  tiff: "image/tiff",
};

const MIME_EXTENSION_ALIASES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heic",
  "image/bmp": "bmp",
  "image/x-ms-bmp": "bmp",
  "image/tiff": "tiff",
  "image/x-tiff": "tiff",
};

export function getImageExtension(filePath: string): string | null {
  const rawExtension = path.extname(filePath).replace(".", "").toLowerCase();
  if (!IMAGE_EXTENSIONS.has(rawExtension)) {
    return null;
  }

  return EXTENSION_ALIASES[rawExtension] ?? rawExtension;
}

function bytesAt(buffer: Buffer, offset: number, bytes: number[]): boolean {
  if (buffer.length < offset + bytes.length) {
    return false;
  }
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

export function detectImageExtensionFromBuffer(buffer: Buffer): string | null {
  if (bytesAt(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }

  if (bytesAt(buffer, 0, [0xff, 0xd8, 0xff])) {
    return "jpg";
  }

  if (buffer.length >= 6) {
    const gifHeader = buffer.subarray(0, 6).toString("ascii");
    if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
      return "gif";
    }
  }

  if (buffer.length >= 12) {
    const riffHeader = buffer.subarray(0, 4).toString("ascii");
    const webpHeader = buffer.subarray(8, 12).toString("ascii");
    if (riffHeader === "RIFF" && webpHeader === "WEBP") {
      return "webp";
    }
  }

  if (bytesAt(buffer, 0, [0x42, 0x4d])) {
    return "bmp";
  }

  if (bytesAt(buffer, 0, [0x49, 0x49, 0x2a, 0x00]) || bytesAt(buffer, 0, [0x4d, 0x4d, 0x00, 0x2a])) {
    return "tiff";
  }

  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const majorBrand = buffer.subarray(8, 12).toString("ascii");
    const heifBrands = new Set(["heic", "heix", "hevc", "hevx", "heif", "mif1", "msf1"]);
    if (heifBrands.has(majorBrand)) {
      return "heic";
    }
  }

  return null;
}

export function resolveImageExtension(filePath: string, buffer: Buffer): string | null {
  const fromPath = getImageExtension(filePath);
  if (fromPath) {
    return fromPath;
  }

  return detectImageExtensionFromBuffer(buffer);
}

function sanitizeSegment(segment: string): string {
  return segment.trim().replace(/^\/+|\/+$/g, "");
}

export function getMonthYearPath(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}-${year}`;
}

export function generateObjectKey(options: { extension: string; objectPrefix?: string; now?: Date }): string {
  const now = options.now ?? new Date();
  const randomPart = randomBytes(4).toString("hex");
  const timestampPart = now.getTime();
  const monthPath = getMonthYearPath(now);
  const fileName = `${timestampPart}-${randomPart}.${options.extension}`;

  const prefix = options.objectPrefix ? sanitizeSegment(options.objectPrefix) : "";
  if (!prefix) {
    return `${monthPath}/${fileName}`;
  }

  return `${prefix}/${monthPath}/${fileName}`;
}

export function buildPublicUrl(baseUrl: string, objectKey: string): string {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, "");
  const encodedKey = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${normalizedBase}/${encodedKey}`;
}

export function getContentTypeFromExtension(extension: string): string {
  return MIME_TYPES[extension.toLowerCase()] ?? "application/octet-stream";
}

export function getExtensionFromMimeType(mimeType: string): string | null {
  const normalized = mimeType.trim().toLowerCase();
  return MIME_EXTENSION_ALIASES[normalized] ?? null;
}
