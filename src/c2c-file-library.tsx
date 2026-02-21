import {
  Action,
  ActionPanel,
  Alert,
  confirmAlert,
  Grid,
  Icon,
  Keyboard,
  List,
  getPreferenceValues,
  openExtensionPreferences,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { isImageCategory } from "./lib/file-types";
import { normalizeConfiguration, validateConfiguration } from "./lib/r2";
import {
  clearHistory,
  getGalleryViewMode,
  getHistory,
  removeHistoryItem,
  setGalleryViewMode,
  setHistory,
} from "./lib/storage";
import type {
  ExtensionPreferences,
  FileCategory,
  GalleryViewMode,
  HistoryLimitOption,
  UploadHistoryItem,
} from "./types";

type CategoryFilter = "all" | FileCategory;

const CATEGORY_FILTERS: Array<{ title: string; value: CategoryFilter }> = [
  { title: "All", value: "all" },
  { title: "Images", value: "images" },
  { title: "Videos", value: "videos" },
  { title: "Documents", value: "documents" },
  { title: "Archives", value: "archives" },
  { title: "Audios", value: "audios" },
  { title: "Others", value: "others" },
];

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "Unknown size";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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

function getNonImageIcon(category: FileCategory): Icon {
  switch (category) {
    case "videos":
      return Icon.Video;
    case "documents":
      return Icon.Document;
    case "archives":
      return Icon.Box;
    case "audios":
      return Icon.Music;
    case "others":
      return Icon.Paperclip;
    default:
      return Icon.Document;
  }
}

export default function Command() {
  const [history, setHistoryState] = useState<UploadHistoryItem[]>([]);
  const [viewMode, setViewMode] = useState<GalleryViewMode>("list");
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);

        const preferences = getPreferenceValues<ExtensionPreferences>();
        const configErrors = validateConfiguration(normalizeConfiguration(preferences));
        const historyLimit = parseHistoryLimit(preferences.historyLimit);
        if (configErrors.length > 0) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Configure extension preferences first",
            message: configErrors[0],
          });
          await openExtensionPreferences();
        }

        const [historyResult, viewResult] = await Promise.all([getHistory(), getGalleryViewMode()]);
        const normalizedHistory =
          historyLimit === null ? historyResult.items : historyResult.items.slice(0, historyLimit);

        setHistoryState(normalizedHistory);
        setViewMode(viewResult.mode);

        if (historyResult.malformed || viewResult.malformed) {
          await showToast({
            style: Toast.Style.Animated,
            title: "Recovered invalid local data",
            message: "File library loaded with safe defaults",
          });

          if (historyResult.malformed) {
            await setHistory(normalizedHistory, historyLimit);
          }
          if (viewResult.malformed) {
            await setGalleryViewMode(viewResult.mode);
          }
        }

        if (normalizedHistory.length !== historyResult.items.length) {
          await setHistory(normalizedHistory, historyLimit);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown load error";
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to open file library",
          message,
        });
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const filteredHistory = useMemo(() => {
    if (selectedCategory === "all") {
      return history;
    }
    return history.filter((item) => item.category === selectedCategory);
  }, [history, selectedCategory]);

  async function handleToggleView() {
    const nextMode: GalleryViewMode = viewMode === "grid" ? "list" : "grid";
    setViewMode(nextMode);
    await setGalleryViewMode(nextMode);
  }

  async function handleRemoveItem(id: string) {
    await removeHistoryItem(id);
    setHistoryState((current) => current.filter((item) => item.id !== id));
    await showToast({ style: Toast.Style.Success, title: "Removed from library" });
  }

  async function handleClearHistory() {
    const confirmed = await confirmAlert({
      title: "Clear file library history?",
      message: "This only removes locally stored URLs in Raycast.",
      primaryAction: {
        title: "Clear",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (!confirmed) {
      return;
    }

    await clearHistory();
    setHistoryState([]);
    await showToast({ style: Toast.Style.Success, title: "File library history cleared" });
  }

  const toggleLabel = viewMode === "grid" ? "Switch to List View" : "Switch to Grid View";

  const settingsAction = (
    <Action
      title="Open Extension Preferences"
      icon={Icon.Gear}
      onAction={() => {
        void openExtensionPreferences();
      }}
    />
  );

  const emptyActions = (
    <ActionPanel>
      {settingsAction}
      <Action title={toggleLabel} icon={Icon.AppWindowList} onAction={handleToggleView} />
      <Action
        title="Clear File Library History"
        style={Action.Style.Destructive}
        icon={Icon.Trash}
        onAction={handleClearHistory}
      />
    </ActionPanel>
  );

  function renderItemActions(item: UploadHistoryItem) {
    return (
      <ActionPanel>
        <Action.CopyToClipboard title="Copy URL" content={item.url} shortcut={{ modifiers: ["cmd"], key: "c" }} />
        <Action.OpenInBrowser title="Open in Browser" url={item.url} />
        {settingsAction}
        <Action
          title="Remove from History"
          style={Action.Style.Destructive}
          icon={Icon.Trash}
          shortcut={Keyboard.Shortcut.Common.Remove}
          onAction={() => {
            void handleRemoveItem(item.id);
          }}
        />
        <Action title={toggleLabel} icon={Icon.AppWindowList} onAction={handleToggleView} />
        <Action
          title="Clear File Library History"
          style={Action.Style.Destructive}
          icon={Icon.Trash}
          onAction={() => {
            void handleClearHistory();
          }}
        />
      </ActionPanel>
    );
  }

  const categoryAccessory = (
    <List.Dropdown
      tooltip="Filter by file category"
      value={selectedCategory}
      onChange={(value) => setSelectedCategory(value as CategoryFilter)}
    >
      {CATEGORY_FILTERS.map((filter) => (
        <List.Dropdown.Item key={filter.value} title={filter.title} value={filter.value} />
      ))}
    </List.Dropdown>
  );

  if (viewMode === "grid") {
    return (
      <Grid
        isLoading={isLoading}
        inset={Grid.Inset.Zero}
        columns={5}
        searchBarPlaceholder="Search uploaded files by name, key, or URL"
        searchBarAccessory={categoryAccessory}
      >
        {filteredHistory.length === 0 ? (
          <Grid.EmptyView
            title="No uploads found"
            description="Use Upload Clipboard File to Cloud to add items"
            icon={Icon.Document}
            actions={emptyActions}
          />
        ) : (
          filteredHistory.map((item) => (
            <Grid.Item
              key={item.id}
              content={isImageCategory(item.category) ? item.url : getNonImageIcon(item.category)}
              title={item.fileName}
              subtitle={`${toTitleCase(item.category)} • ${formatBytes(item.fileSizeBytes)}`}
              keywords={[item.fileName, item.key, item.url, item.fileExtension]}
              actions={renderItemActions(item)}
            />
          ))
        )}
      </Grid>
    );
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search uploaded files by name, key, or URL"
      searchBarAccessory={categoryAccessory}
    >
      {filteredHistory.length === 0 ? (
        <List.EmptyView
          title="No uploads found"
          description="Use Upload Clipboard File to Cloud to add items"
          icon={Icon.Document}
          actions={emptyActions}
        />
      ) : (
        filteredHistory.map((item) => (
          <List.Item
            key={item.id}
            icon={isImageCategory(item.category) ? { source: item.url } : getNonImageIcon(item.category)}
            title={item.fileName}
            subtitle={item.url}
            keywords={[item.fileName, item.key, item.url, item.fileExtension]}
            accessories={[
              { text: item.key },
              { tag: toTitleCase(item.category) },
              { text: formatBytes(item.fileSizeBytes) },
              { text: formatDate(item.createdAt) },
            ]}
            actions={renderItemActions(item)}
          />
        ))
      )}
    </List>
  );
}
