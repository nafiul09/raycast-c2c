import { HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { R2Configuration } from "../types";

function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, "");
  }

  return `https://${trimmed.replace(/\/+$/, "")}`;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeConfiguration(configuration: Partial<R2Configuration>): R2Configuration {
  return {
    r2Endpoint: normalizeEndpoint(configuration.r2Endpoint ?? ""),
    r2Bucket: (configuration.r2Bucket ?? "").trim(),
    r2AccessKeyId: (configuration.r2AccessKeyId ?? "").trim(),
    r2SecretAccessKey: (configuration.r2SecretAccessKey ?? "").trim(),
    publicBaseUrl: (configuration.publicBaseUrl ?? "").trim().replace(/\/+$/, ""),
  };
}

export function validateConfiguration(configuration: Partial<R2Configuration>): string[] {
  const errors: string[] = [];

  if (!configuration.r2Endpoint?.trim()) {
    errors.push("R2 Endpoint is required");
  } else if (!isValidHttpUrl(normalizeEndpoint(configuration.r2Endpoint))) {
    errors.push("R2 Endpoint must be a valid URL");
  }
  if (!configuration.r2Bucket?.trim()) {
    errors.push("R2 Bucket is required");
  }
  if (!configuration.r2AccessKeyId?.trim()) {
    errors.push("R2 Access Key ID is required");
  }
  if (!configuration.r2SecretAccessKey?.trim()) {
    errors.push("R2 Secret Access Key is required");
  }
  if (!configuration.publicBaseUrl?.trim()) {
    errors.push("Public Base URL is required");
  } else if (!isValidHttpUrl(configuration.publicBaseUrl.trim())) {
    errors.push("Public Base URL must be a valid URL");
  }

  return errors;
}

function createR2Client(configuration: R2Configuration): S3Client {
  return new S3Client({
    endpoint: normalizeEndpoint(configuration.r2Endpoint),
    region: "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: configuration.r2AccessKeyId.trim(),
      secretAccessKey: configuration.r2SecretAccessKey.trim(),
    },
  });
}

export async function uploadBufferToR2(options: {
  configuration: R2Configuration;
  objectKey: string;
  buffer: Buffer;
  contentType: string;
}): Promise<void> {
  const { configuration, objectKey, buffer, contentType } = options;
  const client = createR2Client(configuration);

  await client.send(
    new PutObjectCommand({
      Bucket: configuration.r2Bucket.trim(),
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
    }),
  );
}

export async function validateR2Connection(configuration: R2Configuration): Promise<void> {
  const client = createR2Client(configuration);
  await client.send(
    new HeadBucketCommand({
      Bucket: configuration.r2Bucket.trim(),
    }),
  );
}
