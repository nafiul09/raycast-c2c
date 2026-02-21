export type GalleryViewMode = "grid" | "list";
export type CloudProvider = "cloudflare-r2";
export type FileCategory = "images" | "videos" | "documents" | "archives" | "audios" | "others";
export type HistoryLimitOption = "50" | "100" | "200" | "500" | "unlimited";

export type UploadHistoryItem = {
  id: string;
  provider: CloudProvider;
  category: FileCategory;
  fileName: string;
  fileExtension: string;
  fileSizeBytes: number;
  key: string;
  url: string;
  createdAt: string;
};

export type R2Configuration = {
  r2Endpoint: string;
  r2Bucket: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  publicBaseUrl: string;
};

export type ExtensionPreferences = {
  cloudProvider?: CloudProvider;
  r2Endpoint?: string;
  r2Bucket?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  publicBaseUrl?: string;
  allowImages?: boolean | string;
  allowVideos?: boolean | string;
  allowDocuments?: boolean | string;
  allowArchives?: boolean | string;
  allowAudios?: boolean | string;
  allowOthers?: boolean | string;
  maxUploadSizeMb?: string;
  historyLimit?: HistoryLimitOption;
};
