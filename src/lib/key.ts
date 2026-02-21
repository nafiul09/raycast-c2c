import { randomBytes } from "node:crypto";
import type { FileCategory } from "../types";

export function getMonthYearPath(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}-${year}`;
}

function sanitizeExtension(extension?: string): string {
  const normalized = (extension ?? "").replace(/^\.+/, "").trim().toLowerCase();
  return normalized || "bin";
}

export function generateObjectKey(options: { category: FileCategory; extension?: string; now?: Date }): string {
  const now = options.now ?? new Date();
  const randomPart = randomBytes(4).toString("hex");
  const timestampPart = now.getTime();
  const monthPath = getMonthYearPath(now);
  const fileName = `${timestampPart}-${randomPart}.${sanitizeExtension(options.extension)}`;

  return `${options.category}/${monthPath}/${fileName}`;
}

export function buildPublicUrl(baseUrl: string, objectKey: string): string {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, "");
  const encodedKey = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${normalizedBase}/${encodedKey}`;
}
