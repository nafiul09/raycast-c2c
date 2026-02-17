import { Clipboard, getPreferenceValues, openExtensionPreferences, showToast, Toast } from "@raycast/api";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  buildPublicUrl,
  generateObjectKey,
  getContentTypeFromExtension,
  getExtensionFromMimeType,
  resolveImageExtension,
} from "./lib/key";
import { normalizeConfiguration, uploadBufferToR2, validateConfiguration } from "./lib/r2";
import { prependHistory } from "./lib/storage";
import type { ExtensionPreferences, UploadHistoryItem } from "./types";

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

async function readClipboardImageContent(
  content: Clipboard.ReadContent,
): Promise<{ kind: "image"; buffer: Buffer; extension: string } | { kind: "file-unreadable" } | { kind: "not-image" }> {
  let fileReadFailed = false;

  if (content.file) {
    const normalizedPath = normalizeClipboardFilePath(content.file);
    try {
      const buffer = await readFile(normalizedPath);
      const extension = resolveImageExtension(normalizedPath, buffer);
      if (extension) {
        return { kind: "image", buffer, extension };
      }
    } catch {
      fileReadFailed = true;
    }
  }

  const possibleDataUriSources = [content.html, content.text].filter((value): value is string => Boolean(value));
  for (const source of possibleDataUriSources) {
    const extracted = extractImageDataUri(source);
    if (!extracted) {
      continue;
    }

    const extension = getExtensionFromMimeType(extracted.mimeType);
    if (!extension) {
      continue;
    }

    try {
      const buffer = Buffer.from(extracted.base64, "base64");
      if (buffer.length > 0) {
        return { kind: "image", buffer, extension };
      }
    } catch {
      // Ignore invalid base64 and keep searching.
    }
  }

  if (fileReadFailed) {
    return { kind: "file-unreadable" };
  }

  return { kind: "not-image" };
}

export default async function Command() {
  const preferences = getPreferenceValues<ExtensionPreferences>();
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

  const clipboard = await Clipboard.read();
  const clipboardImageResult = await readClipboardImageContent(clipboard);
  if (clipboardImageResult.kind !== "image") {
    if (clipboardImageResult.kind === "file-unreadable") {
      await showToast({
        style: Toast.Style.Failure,
        title: "Cannot read clipboard image",
        message: "Copy a local image and retry",
      });
      return;
    }

    await showToast({
      style: Toast.Style.Failure,
      title: "Last copied clipboard item is not an image",
      message: "Copy an image and try again",
    });
    return;
  }

  const { buffer: imageBuffer, extension } = clipboardImageResult;

  const uploadingToast = await showToast({
    style: Toast.Style.Animated,
    title: "Uploading image to R2...",
  });

  try {
    const objectKey = generateObjectKey({ extension, objectPrefix: configuration.objectPrefix });

    await uploadBufferToR2({
      configuration,
      objectKey,
      buffer: imageBuffer,
      contentType: getContentTypeFromExtension(extension),
    });

    const publicUrl = buildPublicUrl(configuration.publicBaseUrl, objectKey);
    await Clipboard.copy(publicUrl);

    const historyItem: UploadHistoryItem = {
      id: randomUUID(),
      key: objectKey,
      url: publicUrl,
      createdAt: new Date().toISOString(),
    };

    const historyResult = await prependHistory(historyItem);

    uploadingToast.style = Toast.Style.Success;
    uploadingToast.title = "Uploaded to R2";
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
