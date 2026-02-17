import { LocalStorage } from "@raycast/api";
import type { GalleryViewMode, R2Configuration, UploadHistoryItem } from "../types";

export const HISTORY_STORAGE_KEY = "history.v1";
export const GALLERY_VIEW_STORAGE_KEY = "galleryView.v1";
export const CONFIG_STORAGE_KEY = "r2Config.v1";
export const MAX_HISTORY_ITEMS = 200;

export type HistoryResult = {
  items: UploadHistoryItem[];
  malformed: boolean;
};

export type ViewModeResult = {
  mode: GalleryViewMode;
  malformed: boolean;
};

export type ConfigResult = {
  config: R2Configuration | null;
  malformed: boolean;
};

function isUploadHistoryItem(value: unknown): value is UploadHistoryItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as UploadHistoryItem;
  return (
    typeof candidate.id === "string" &&
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
    const malformed = items.length !== parsed.length;

    return { items, malformed };
  } catch {
    return { items: [], malformed: true };
  }
}

function isR2Configuration(value: unknown): value is R2Configuration {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as R2Configuration;
  const hasOptionalPrefix = candidate.objectPrefix === undefined || typeof candidate.objectPrefix === "string";
  return (
    typeof candidate.r2Endpoint === "string" &&
    typeof candidate.r2Bucket === "string" &&
    typeof candidate.r2AccessKeyId === "string" &&
    typeof candidate.r2SecretAccessKey === "string" &&
    typeof candidate.publicBaseUrl === "string" &&
    hasOptionalPrefix
  );
}

function parseConfig(raw: string | undefined): ConfigResult {
  if (!raw) {
    return { config: null, malformed: false };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isR2Configuration(parsed)) {
      return { config: null, malformed: true };
    }

    return { config: parsed, malformed: false };
  } catch {
    return { config: null, malformed: true };
  }
}

export async function getHistory(): Promise<HistoryResult> {
  const raw = await LocalStorage.getItem<string>(HISTORY_STORAGE_KEY);
  return parseHistory(raw);
}

export async function setHistory(items: UploadHistoryItem[]): Promise<void> {
  await LocalStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
}

export async function prependHistory(item: UploadHistoryItem): Promise<HistoryResult> {
  const current = await getHistory();
  const next = [item, ...current.items].slice(0, MAX_HISTORY_ITEMS);
  await setHistory(next);
  return current;
}

export async function removeHistoryItem(id: string): Promise<void> {
  const current = await getHistory();
  const next = current.items.filter((item) => item.id !== id);
  await setHistory(next);
}

export async function clearHistory(): Promise<void> {
  await LocalStorage.removeItem(HISTORY_STORAGE_KEY);
}

export async function getGalleryViewMode(): Promise<ViewModeResult> {
  const raw = await LocalStorage.getItem<string>(GALLERY_VIEW_STORAGE_KEY);

  if (!raw) {
    return { mode: "grid", malformed: false };
  }

  if (raw === "grid" || raw === "list") {
    return { mode: raw, malformed: false };
  }

  return { mode: "grid", malformed: true };
}

export async function setGalleryViewMode(mode: GalleryViewMode): Promise<void> {
  await LocalStorage.setItem(GALLERY_VIEW_STORAGE_KEY, mode);
}

export async function getR2Configuration(): Promise<ConfigResult> {
  const raw = await LocalStorage.getItem<string>(CONFIG_STORAGE_KEY);
  return parseConfig(raw);
}

export async function setR2Configuration(config: R2Configuration): Promise<void> {
  await LocalStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export async function clearR2Configuration(): Promise<void> {
  await LocalStorage.removeItem(CONFIG_STORAGE_KEY);
}
