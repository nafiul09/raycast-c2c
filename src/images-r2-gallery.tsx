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
import { useEffect, useState } from "react";
import {
  clearHistory,
  getGalleryViewMode,
  getHistory,
  removeHistoryItem,
  setGalleryViewMode,
  setHistory,
} from "./lib/storage";
import { normalizeConfiguration, validateConfiguration } from "./lib/r2";
import type { ExtensionPreferences, GalleryViewMode, UploadHistoryItem } from "./types";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString();
}

export default function Command() {
  const [history, setHistoryState] = useState<UploadHistoryItem[]>([]);
  const [viewMode, setViewMode] = useState<GalleryViewMode>("grid");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);

        const preferences = getPreferenceValues<ExtensionPreferences>();
        const configErrors = validateConfiguration(normalizeConfiguration(preferences));
        if (configErrors.length > 0) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Configure extension preferences first",
            message: configErrors[0],
          });
          await openExtensionPreferences();
        }

        const [historyResult, viewResult] = await Promise.all([getHistory(), getGalleryViewMode()]);
        setHistoryState(historyResult.items);
        setViewMode(viewResult.mode);

        if (historyResult.malformed || viewResult.malformed) {
          await showToast({
            style: Toast.Style.Animated,
            title: "Recovered invalid local data",
            message: "Gallery loaded with safe defaults",
          });

          if (historyResult.malformed) {
            await setHistory(historyResult.items);
          }
          if (viewResult.malformed) {
            await setGalleryViewMode(viewResult.mode);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown load error";
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to open gallery",
          message,
        });
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  async function handleToggleView() {
    const nextMode: GalleryViewMode = viewMode === "grid" ? "list" : "grid";
    setViewMode(nextMode);
    await setGalleryViewMode(nextMode);
  }

  async function handleRemoveItem(id: string) {
    await removeHistoryItem(id);
    setHistoryState((current) => current.filter((item) => item.id !== id));
    await showToast({ style: Toast.Style.Success, title: "Removed from history" });
  }

  async function handleClearHistory() {
    const confirmed = await confirmAlert({
      title: "Clear gallery history?",
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
    await showToast({ style: Toast.Style.Success, title: "Gallery history cleared" });
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
        title="Clear Gallery History"
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
          title="Clear Gallery History"
          style={Action.Style.Destructive}
          icon={Icon.Trash}
          onAction={() => {
            void handleClearHistory();
          }}
        />
      </ActionPanel>
    );
  }

  if (viewMode === "grid") {
    return (
      <Grid
        isLoading={isLoading}
        inset={Grid.Inset.Zero}
        columns={5}
        searchBarPlaceholder="Search uploaded images by key or URL"
      >
        {history.length === 0 ? (
          <Grid.EmptyView
            title="No uploads yet"
            description="Use Upload Clipboard Image to add items"
            icon={Icon.Image}
            actions={emptyActions}
          />
        ) : (
          history.map((item) => (
            <Grid.Item
              key={item.id}
              content={item.url}
              title={item.key}
              subtitle={formatDate(item.createdAt)}
              actions={renderItemActions(item)}
            />
          ))
        )}
      </Grid>
    );
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search uploaded images by key or URL">
      {history.length === 0 ? (
        <List.EmptyView
          title="No uploads yet"
          description="Use Upload Clipboard Image to add items"
          icon={Icon.Image}
          actions={emptyActions}
        />
      ) : (
        history.map((item) => (
          <List.Item
            key={item.id}
            icon={{ source: item.url }}
            title={item.key}
            subtitle={item.url}
            accessories={[{ text: formatDate(item.createdAt) }]}
            actions={renderItemActions(item)}
          />
        ))
      )}
    </List>
  );
}
