export type GalleryViewMode = "grid" | "list";

export type UploadHistoryItem = {
  id: string;
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
  objectPrefix?: string;
};

export type ExtensionPreferences = Partial<R2Configuration>;
