import { Clipboard, getPreferenceValues, openExtensionPreferences, showToast, Toast } from "@raycast/api";
import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  detectImageExtensionFromBuffer,
  getCategoryFromExtension,
  getContentTypeFromExtension,
  getExtensionFromMimeType,
  getFileName,
  getNormalizedExtension,
} from "./lib/file-types";
import { buildPublicUrl, generateObjectKey } from "./lib/key";
import { normalizeConfiguration, uploadBufferToR2, validateConfiguration } from "./lib/r2";
import { prependHistory } from "./lib/storage";
import type { CloudProvider, ExtensionPreferences, FileCategory, HistoryLimitOption, UploadHistoryItem } from "./types";

const MAX_UPLOAD_SIZE_MB_DEFAULT = 25;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unknown upload error";
}

function normalizeClipboardFilePath(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("file://")) {
    try {
      return fileURLToPath(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function isChecked(value: boolean | string | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return true;
}

function getAllowedCategories(preferences: ExtensionPreferences): Set<FileCategory> {
  const allowed = new Set<FileCategory>();
  if (isChecked(preferences.allowImages)) {
    allowed.add("images");
  }
  if (isChecked(preferences.allowVideos)) {
    allowed.add("videos");
  }
  if (isChecked(preferences.allowDocuments)) {
    allowed.add("documents");
  }
  if (isChecked(preferences.allowArchives)) {
    allowed.add("archives");
  }
  if (isChecked(preferences.allowAudios)) {
    allowed.add("audios");
  }
  if (isChecked(preferences.allowOthers)) {
    allowed.add("others");
  }
  return allowed;
}

function parseMaxUploadSizeMb(rawValue: string | undefined): number | null {
  const source = rawValue?.trim() ? rawValue.trim() : String(MAX_UPLOAD_SIZE_MB_DEFAULT);
  const value = Number(source);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function parseHistoryLimit(option: HistoryLimitOption | undefined): number | null {
  const normalized = option ?? "200";
  if (normalized === "unlimited") {
    return null;
  }

  const value = Number.parseInt(normalized, 10);
  if (!Number.isFinite(value) || value <= 0) {
    return 200;
  }
  return value;
}

function getCloudProvider(raw: CloudProvider | undefined): CloudProvider {
  if (raw === "cloudflare-r2") {
    return raw;
  }
  return "cloudflare-r2";
}

function buildClipboardTextFileName(now = new Date()): string {
  const iso = now.toISOString().replace(/[:.]/g, "-");
  return `clipboard-text-${iso}.txt`;
}

function extractImageDataUri(raw: string): { mimeType: string; base64: string } | null {
  const direct = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\n\r]+)$/i);
  if (direct) {
    return { mimeType: direct[1], base64: direct[2].replace(/\s+/g, "") };
  }

  const embedded = raw.match(/data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\n\r]+)/i);
  if (!embedded) {
    return null;
  }

  return { mimeType: embedded[1], base64: embedded[2].replace(/\s+/g, "") };
}

export default async function Command() {
  const preferences = getPreferenceValues<ExtensionPreferences>();
  const provider = getCloudProvider(preferences.cloudProvider);
  const configuration = normalizeConfiguration(preferences);
  const configurationErrors = validateConfiguration(configuration);

  if (configurationErrors.length > 0) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Invalid extension preferences",
      message: configurationErrors[0],
    });
    await openExtensionPreferences();
    return;
  }

  const maxUploadSizeMb = parseMaxUploadSizeMb(preferences.maxUploadSizeMb);
  if (!maxUploadSizeMb) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Invalid max upload size",
      message: "Max Upload Size (MB) must be a positive integer",
    });
    await openExtensionPreferences();
    return;
  }

  const allowedCategories = getAllowedCategories(preferences);
  if (allowedCategories.size === 0) {
    await showToast({
      style: Toast.Style.Failure,
      title: "No file categories allowed",
      message: "Enable at least one Allowed File Type in extension preferences",
    });
    await openExtensionPreferences();
    return;
  }

  const clipboard = await Clipboard.read();
  let uploadCandidate: {
    fileBuffer: Buffer;
    fileName: string;
    fileSizeBytes: number;
    extension: string | undefined;
    category: FileCategory;
  } | null = null;

  if (clipboard.file?.trim()) {
    const localFilePath = normalizeClipboardFilePath(clipboard.file);
    let fileStats;
    try {
      fileStats = await stat(localFilePath);
    } catch {
      await showToast({
        style: Toast.Style.Failure,
        title: "Cannot access copied file",
        message: "The copied file path is invalid or unavailable",
      });
      return;
    }

    if (!fileStats.isFile()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Clipboard item is not a file",
        message: "Copy a file or text and try again",
      });
      return;
    }

    const fileBuffer = await readFile(localFilePath);
    const extension = getNormalizedExtension(localFilePath) ?? detectImageExtensionFromBuffer(fileBuffer);

    uploadCandidate = {
      fileBuffer,
      fileName: getFileName(localFilePath),
      fileSizeBytes: fileStats.size,
      extension,
      category: getCategoryFromExtension(extension),
    };
  } else {
    const possibleDataUriSources = [clipboard.html, clipboard.text].filter((value): value is string => Boolean(value));

    for (const source of possibleDataUriSources) {
      const extracted = extractImageDataUri(source);
      if (!extracted) {
        continue;
      }

      const inferredExtension = getExtensionFromMimeType(extracted.mimeType);
      if (!inferredExtension) {
        continue;
      }

      try {
        const decodedBuffer = Buffer.from(extracted.base64, "base64");
        if (decodedBuffer.length === 0) {
          continue;
        }

        uploadCandidate = {
          fileBuffer: decodedBuffer,
          fileName: `clipboard-image-${Date.now()}.${inferredExtension}`,
          fileSizeBytes: decodedBuffer.length,
          extension: inferredExtension,
          category: "images",
        };
        break;
      } catch {
        // ignore invalid base64 sources and continue scanning
      }
    }

    if (!uploadCandidate && clipboard.text?.length) {
      const fileBuffer = Buffer.from(clipboard.text, "utf8");
      uploadCandidate = {
        fileBuffer,
        fileName: buildClipboardTextFileName(),
        fileSizeBytes: fileBuffer.length,
        extension: "txt",
        category: "documents",
      };
    }

    if (!uploadCandidate) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Clipboard content not supported",
        message: "Copy a file, image, or plain text and try again",
      });
      return;
    }
  }

  if (!uploadCandidate) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Clipboard content not supported",
      message: "Copy a file, image, or plain text and try again",
    });
    return;
  }

  const { fileBuffer, fileName, fileSizeBytes, extension, category } = uploadCandidate;

  const maxFileSizeBytes = maxUploadSizeMb * 1024 * 1024;
  if (fileSizeBytes > maxFileSizeBytes) {
    await showToast({
      style: Toast.Style.Failure,
      title: "File too large",
      message: `Maximum allowed size is ${maxUploadSizeMb} MB`,
    });
    return;
  }

  if (!allowedCategories.has(category)) {
    await showToast({
      style: Toast.Style.Failure,
      title: "File type not allowed",
      message: `Enable ${category} in extension preferences to upload this file`,
    });
    return;
  }

  const uploadingToast = await showToast({
    style: Toast.Style.Animated,
    title: "Uploading file to cloud...",
  });

  try {
    const objectKey = generateObjectKey({ category, extension });
    const contentType = getContentTypeFromExtension(extension);

    switch (provider) {
      case "cloudflare-r2":
        await uploadBufferToR2({
          configuration,
          objectKey,
          buffer: fileBuffer,
          contentType,
        });
        break;
      default:
        throw new Error(`Unsupported cloud provider: ${provider}`);
    }

    const publicUrl = buildPublicUrl(configuration.publicBaseUrl, objectKey);
    await Clipboard.copy(publicUrl);

    const historyItem: UploadHistoryItem = {
      id: randomUUID(),
      provider,
      category,
      fileName,
      fileExtension: extension ?? "",
      fileSizeBytes,
      key: objectKey,
      url: publicUrl,
      createdAt: new Date().toISOString(),
    };

    const historyLimit = parseHistoryLimit(preferences.historyLimit);
    const historyResult = await prependHistory(historyItem, historyLimit);

    uploadingToast.style = Toast.Style.Success;
    uploadingToast.title = "Uploaded to cloud";
    uploadingToast.message = "URL copied to clipboard";

    if (historyResult.malformed) {
      await showToast({
        style: Toast.Style.Animated,
        title: "Recovered invalid local history",
        message: "New uploads are now stored with a clean history",
      });
    }
  } catch (error) {
    uploadingToast.style = Toast.Style.Failure;
    uploadingToast.title = "Upload failed";
    uploadingToast.message = getErrorMessage(error);
  }
}
