import crypto from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/apiError.js";
import { isGenericMimeType, normalizeAttachmentMetadata } from "../../utils/attachment-media.js";

let s3Client;

function requireBucket() {
  if (!env.awsS3BucketName) throw new ApiError(500, "AWS S3 bucket is not configured");
  return env.awsS3BucketName;
}

function getClient() {
  if (s3Client) return s3Client;

  if (!env.awsAccessKeyId || !env.awsSecretAccessKey) {
    throw new ApiError(500, "AWS S3 credentials are not configured");
  }

  s3Client = new S3Client({
    region: env.awsRegion,
    endpoint: env.awsS3Endpoint || undefined,
    forcePathStyle: env.awsS3ForcePathStyle || env.awsS3BucketName.includes("."),
    credentials: {
      accessKeyId: env.awsAccessKeyId,
      secretAccessKey: env.awsSecretAccessKey,
    },
  });

  return s3Client;
}

function extensionOf(filename = "") {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function uploadAttachmentToS3(userId, file, options = {}) {
  if (!file?.buffer?.length) throw new ApiError(400, "Choose a file to upload");

  const bucket = requireBucket();
  const metadata = normalizeAttachmentMetadata({
    mimeType: file.mimetype,
    fileName: file.originalname,
    buffer: file.buffer,
  });
  const safeName = metadata.fileName.replace(/[^\w.\-() ]+/g, "_");

  // Format folder path. Ensure it lives under documents/ where IAM permissions are granted on nearmeteacher bucket
  let targetFolder = options.folder ? options.folder.replace(/^\/+|\/+$/g, "") : `documents/whatsapp/templates/${userId}`;
  if (!targetFolder.startsWith("documents/")) {
    targetFolder = `documents/${targetFolder}`;
  }

  const key = `${targetFolder}/${Date.now()}-${crypto.randomUUID()}${extensionOf(safeName)}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: metadata.mimeType,
      Metadata: {
        originalName: safeName,
      },
    }),
    { abortSignal: AbortSignal.timeout(env.awsS3UploadTimeoutMs) },
  );

  return {
    kind: metadata.kind,
    bucket,
    key,
    name: safeName,
    mimeType: metadata.mimeType,
    size: file.size,
  };
}

export async function uploadFileToFolder({ folder = "documents/whatsapp/uploads", fileName, buffer, mimeType = "application/octet-stream" }) {
  if (!buffer?.length) throw new ApiError(400, "File content is required");

  const bucket = requireBucket();
  let targetFolder = folder.replace(/^\/+|\/+$/g, "");
  if (!targetFolder.startsWith("documents/")) {
    targetFolder = `documents/${targetFolder}`;
  }

  const safeName = (fileName || `file-${Date.now()}`).replace(/[^\w.\-() ]+/g, "_");
  const key = `${targetFolder}/${Date.now()}-${crypto.randomUUID()}${extensionOf(safeName)}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        originalName: safeName,
      },
    }),
    { abortSignal: AbortSignal.timeout(env.awsS3UploadTimeoutMs) },
  );

  return {
    bucket,
    key,
    name: safeName,
    mimeType,
    size: buffer.length,
    url: `/api/storage/files/${encodeURIComponent(key)}`,
  };
}

export async function createFolderInBucket(folderPath) {
  if (!folderPath?.trim()) throw new ApiError(400, "Folder name is required");
  const bucket = requireBucket();

  let cleanFolder = folderPath.trim().replace(/^\/+|\/+$/g, "");
  if (!cleanFolder.startsWith("documents/")) {
    cleanFolder = `documents/${cleanFolder}`;
  }
  const folderKey = `${cleanFolder}/`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: folderKey,
      Body: "",
      ContentType: "application/x-directory",
    }),
    { abortSignal: AbortSignal.timeout(env.awsS3UploadTimeoutMs) },
  );

  return {
    bucket,
    folder: cleanFolder,
    key: folderKey,
  };
}

export async function downloadFileByKey(key) {
  if (!key) throw new ApiError(400, "File key is required");

  const bucket = requireBucket();
  const response = await getClient().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { abortSignal: AbortSignal.timeout(env.awsS3UploadTimeoutMs) },
  );

  const buffer = await streamToBuffer(response.Body);
  const fileName = response.Metadata?.originalname || key.split("/").pop() || "file";
  const mimeType = response.ContentType || "application/octet-stream";

  return {
    buffer,
    fileName,
    mimeType,
    size: buffer.length,
  };
}

export async function downloadAttachmentBuffer(attachment) {
  if (!attachment?.key) throw new ApiError(400, "Template attachment is missing");

  const response = await getClient().send(
    new GetObjectCommand({
      Bucket: attachment.bucket || requireBucket(),
      Key: attachment.key,
    }),
    { abortSignal: AbortSignal.timeout(env.awsS3UploadTimeoutMs) },
  );

  const buffer = await streamToBuffer(response.Body);
  const metadata = normalizeAttachmentMetadata({
    mimeType: isGenericMimeType(attachment.mimeType) ? response.ContentType || attachment.mimeType : attachment.mimeType || response.ContentType,
    fileName: attachment.name || response.Metadata?.originalname || "attachment",
    buffer,
  });

  return { buffer, ...metadata };
}
