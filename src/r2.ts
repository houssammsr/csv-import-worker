import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  throw new Error("Missing R2 configuration environment variables");
}

// Create R2 client (S3-compatible)
export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Get a readable stream for a CSV file from R2
 * @param bucket R2 bucket name
 * @param key Object key in the bucket
 * @param maxFileSize Optional maximum file size in bytes
 * @returns Readable stream of the CSV file and metadata
 */
export async function getObjectStream(
  bucket: string,
  key: string,
  maxFileSize?: number
): Promise<{ stream: Readable; contentLength?: number }> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await (r2Client as any).send(command);

    if (!response.Body) {
      throw new Error(`Object not found: ${bucket}/${key}`);
    }

    // Enforce file size limit if provided
    if (
      maxFileSize &&
      response.ContentLength &&
      response.ContentLength > maxFileSize
    ) {
      throw new Error(
        `File too large: ${response.ContentLength} bytes exceeds limit of ${maxFileSize} bytes`
      );
    }

    // Convert the response body to a Node.js Readable stream
    const stream = response.Body as Readable;

    console.log(`Successfully opened stream for ${bucket}/${key}`, {
      contentLength: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified,
    });

    return { stream, contentLength: response.ContentLength };
  } catch (error) {
    console.error(
      `Failed to get object stream from R2: ${bucket}/${key}`,
      error
    );
    throw new Error(
      `Failed to stream CSV file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Delete an object from R2 (for cleanup after successful import)
 * @param bucket R2 bucket name
 * @param key Object key in the bucket
 */
export async function deleteObject(bucket: string, key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await (r2Client as any).send(command);
    console.log(`Successfully deleted object: ${bucket}/${key}`);
  } catch (error) {
    console.error(`Failed to delete object from R2: ${bucket}/${key}`, error);
    // Don't throw here - cleanup failure shouldn't fail the job
  }
}

/**
 * Check if an object exists in R2
 * @param bucket R2 bucket name
 * @param key Object key in the bucket
 * @returns true if object exists, false otherwise
 */
export async function objectExists(
  bucket: string,
  key: string
): Promise<boolean> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await (r2Client as any).send(command);
    return true;
  } catch (error) {
    return false;
  }
}
