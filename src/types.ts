import { z } from "zod";

// Column type definition
export type ColumnType = "string" | "jsonb";

// Base Zod schemas
const ColumnTypeSchema = z.enum(["string", "jsonb"]);

const ColumnSchema = z.object({
  name: z.string(),
  key: z.string(),
  type: ColumnTypeSchema,
  order: z.number(),
});

const R2Schema = z.object({
  bucket: z.string(),
  key: z.string(),
  contentType: z.string().optional(),
  size: z.number().optional(),
});

// EnqueuePayload schema - matches client/Vercel
export const EnqueuePayloadSchema = z.object({
  jobId: z.string().uuid(),
  listName: z.string().min(1).max(100),
  firstRowIsHeader: z.boolean(),
  columns: z.array(ColumnSchema).min(1),
  r2: R2Schema,
});

// WorkerMessage schema - EnqueuePayload + additional fields
export const WorkerMessageSchema = EnqueuePayloadSchema.extend({
  userId: z.string(),
  requestedAt: z.string(),
});

// JobStatus schema
export const JobStatusSchema = z.object({
  jobId: z.string(),
  state: z.enum(["queued", "running", "succeeded", "failed"]),
  userId: z.string().optional(),
  listId: z.string().optional(),
  error: z.string().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  processedRows: z.number().optional(),
});

// TypeScript types inferred from schemas
export type EnqueuePayload = z.infer<typeof EnqueuePayloadSchema>;
export type WorkerMessage = z.infer<typeof WorkerMessageSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type Column = z.infer<typeof ColumnSchema>;
export type R2Config = z.infer<typeof R2Schema>;

// Constants
export const INSERT_BATCH_SIZE = 500;
export const PROGRESS_REPORT_INTERVAL = 1000; // Report progress every 1000 rows
export const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

// Helper functions for header normalization (should match client-side logic)
export function stripBom(str: string): string {
  // Strip BOM if present (0xFEFF)
  return str.charCodeAt(0) === 0xfeff ? str.slice(1) : str;
}

export function normalizeHeader(header: string): string {
  return stripBom(header.trim());
}
