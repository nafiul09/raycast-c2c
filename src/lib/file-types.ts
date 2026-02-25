import path from "node:path";
import type { FileCategory } from "../types";

const CATEGORY_TO_EXTENSIONS: Record<Exclude<FileCategory, "others">, Set<string>> = {
  images: new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "tif", "tiff", "heic", "heif", "svg", "avif"]),
  videos: new Set(["mp4", "mov", "m4v", "avi", "mkv", "webm", "wmv", "flv", "mpeg", "mpg"]),
  documents: new Set(["pdf", "txt", "md", "rtf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "json", "xml"]),
  archives: new Set(["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"]),
  audios: new Set(["mp3", "wav", "aac", "m4a", "flac", "ogg", "opus", "aiff"]),
};

const EXTENSION_ALIASES: Record<string, string> = {
  tif: "tiff",
};

const CONTENT_TYPE_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  svg: "image/svg+xml",
  avif: "image/avif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  webm: "video/webm",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  rtf: "application/rtf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  json: "application/json",
  xml: "application/xml",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
  tgz: "application/gzip",
  bz2: "application/x-bzip2",
  xz: "application/x-xz",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aac: "audio/aac",
  m4a: "audio/mp4",
  flac: "audio/flac",
  ogg: "audio/ogg",
  opus: "audio/opus",
  aiff: "audio/aiff",
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
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

export function getFileName(filePath: string): string {
  return path.basename(filePath);
}

export function getNormalizedExtension(filePath: string): string | undefined {
  const rawExtension = path.extname(filePath).replace(".", "").toLowerCase();
  if (!rawExtension) {
    return undefined;
  }

  return EXTENSION_ALIASES[rawExtension] ?? rawExtension;
}

export function getCategoryFromExtension(extension?: string): FileCategory {
  if (!extension) {
    return "others";
  }

  for (const [category, extensions] of Object.entries(CATEGORY_TO_EXTENSIONS)) {
    if (extensions.has(extension)) {
      return category as Exclude<FileCategory, "others">;
    }
  }

  return "others";
}

export function getContentTypeFromExtension(extension?: string): string {
  if (!extension) {
    return "application/octet-stream";
  }

  return CONTENT_TYPE_MAP[extension] ?? "application/octet-stream";
}

function bytesAt(buffer: Buffer, offset: number, bytes: number[]): boolean {
  if (buffer.length < offset + bytes.length) {
    return false;
  }
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

export function detectImageExtensionFromBuffer(buffer: Buffer): string | undefined {
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
    if (majorBrand === "avif") {
      return "avif";
    }
  }

  return undefined;
}

export function getExtensionFromMimeType(mimeType: string): string | undefined {
  const normalized = mimeType.trim().toLowerCase();
  return MIME_EXTENSION_ALIASES[normalized];
}

export function isImageCategory(category: FileCategory): boolean {
  return category === "images";
}
