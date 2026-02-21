import { LocalStorage } from "@raycast/api";
import type { CloudProvider, FileCategory, GalleryViewMode, UploadHistoryItem } from "../types";

export const HISTORY_STORAGE_KEY = "history.v2";
export const GALLERY_VIEW_STORAGE_KEY = "galleryView.v1";

type UnknownRecord = Record<string, unknown>;

export type HistoryResult = {
  items: UploadHistoryItem[];
  malformed: boolean;
};

export type ViewModeResult = {
  mode: GalleryViewMode;
  malformed: boolean;
};

function isCloudProvider(value: unknown): value is CloudProvider {
  return value === "cloudflare-r2";
}

function isFileCategory(value: unknown): value is FileCategory {
  return (
    value === "images" ||
    value === "videos" ||
    value === "documents" ||
    value === "archives" ||
    value === "audios" ||
    value === "others"
  );
}

function isUploadHistoryItem(value: unknown): value is UploadHistoryItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as UnknownRecord;
  return (
    typeof candidate.id === "string" &&
    isCloudProvider(candidate.provider) &&
    isFileCategory(candidate.category) &&
    typeof candidate.fileName === "string" &&
    typeof candidate.fileExtension === "string" &&
    typeof candidate.fileSizeBytes === "number" &&
    Number.isFinite(candidate.fileSizeBytes) &&
    typeof candidate.key === "string" &&
    typeof candidate.url === "string" &&
    typeof candidate.createdAt === "string"
  );
}

function parseHistory(raw: string | undefined): HistoryResult {
  if (!raw) {
    return { items: [], malformed: false };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { items: [], malformed: true };
    }

    const items = parsed.filter(isUploadHistoryItem);
    return { items, malformed: items.length !== parsed.length };
  } catch {
    return { items: [], malformed: true };
  }
}

function trimToLimit(items: UploadHistoryItem[], limit: number | null | undefined): UploadHistoryItem[] {
  if (limit === null || limit === undefined) {
    return items;
  }
  return items.slice(0, limit);
}

export async function getHistory(): Promise<HistoryResult> {
  const raw = await LocalStorage.getItem<string>(HISTORY_STORAGE_KEY);
  return parseHistory(raw);
}

export async function setHistory(items: UploadHistoryItem[], limit?: number | null): Promise<void> {
  await LocalStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimToLimit(items, limit)));
}

export async function prependHistory(item: UploadHistoryItem, limit?: number | null): Promise<HistoryResult> {
  const current = await getHistory();
  await setHistory([item, ...current.items], limit);
  return current;
}

export async function removeHistoryItem(id: string, limit?: number | null): Promise<void> {
  const current = await getHistory();
  const next = current.items.filter((item) => item.id !== id);
  await setHistory(next, limit);
}

export async function clearHistory(): Promise<void> {
  await LocalStorage.removeItem(HISTORY_STORAGE_KEY);
}

export async function getGalleryViewMode(): Promise<ViewModeResult> {
  const raw = await LocalStorage.getItem<string>(GALLERY_VIEW_STORAGE_KEY);

  if (!raw) {
    return { mode: "list", malformed: false };
  }

  if (raw === "grid" || raw === "list") {
    return { mode: raw, malformed: false };
  }

  return { mode: "list", malformed: true };
}

export async function setGalleryViewMode(mode: GalleryViewMode): Promise<void> {
  await LocalStorage.setItem(GALLERY_VIEW_STORAGE_KEY, mode);
}
