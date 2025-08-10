import csv from "csv-parser";
import { eq } from "drizzle-orm";
import { dbWs, DbWsTransaction } from "./db/drizzle";
import { lists, listColumns, listRows } from "./db/schema";
import { getObjectStream, deleteObject } from "./r2";
import {
  markRunning,
  reportProgress,
  markSucceeded,
  markFailed,
} from "./status";
import {
  WorkerMessage,
  INSERT_BATCH_SIZE,
  PROGRESS_REPORT_INTERVAL,
  ColumnType,
  MAX_FILE_SIZE,
} from "./types";

/**
 * Process a CSV import job
 */
export async function processImport(message: WorkerMessage): Promise<void> {
  const { jobId, listName, firstRowIsHeader, columns, r2, userId } = message;

  console.log(`Starting CSV import job ${jobId}`, {
    listName,
    firstRowIsHeader,
    columnsCount: columns.length,
    r2Key: r2.key,
    userId,
  });

  try {
    // Mark job as running
    await markRunning(jobId);

    // Get CSV stream from R2 with file size validation
    const { stream: csvStream, contentLength } = await getObjectStream(
      r2.bucket,
      r2.key,
      MAX_FILE_SIZE
    );

    console.log(`Processing CSV file: ${r2.key}`, {
      size: contentLength
        ? `${(contentLength / 1024 / 1024).toFixed(2)}MB`
        : "unknown",
      maxAllowed: `${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB`,
    });

    // Process CSV in transaction
    let thisWorkerProcessedRows = false;
    const result = await dbWs.transaction(async (tx) => {
      // Atomic insert with conflict handling for idempotency
      let newList;
      try {
        [newList] = await tx
          .insert(lists)
          .values({
            userId,
            name: listName,
            jobId,
          })
          .returning({ id: lists.id });
      } catch (error: any) {
        // Handle unique constraint violation on jobId (more robust check)
        if (error.code === "23505") {
          // Job already processed by another worker, fetch existing list
          const existingList = await tx
            .select({ id: lists.id })
            .from(lists)
            .where(eq(lists.jobId, jobId))
            .limit(1);

          if (existingList.length > 0) {
            console.log(
              `Job ${jobId} already processed by another worker, list exists: ${existingList[0].id}`
            );
            return { listId: existingList[0].id, isDuplicate: true };
          }
        }
        throw error; // Re-throw if not a jobId conflict
      }

      console.log(`Created list ${newList.id} for job ${jobId}`);

      // Insert column definitions
      const columnData = columns.map((col) => ({
        listId: newList.id,
        name: col.name,
        key: col.key,
        type: col.type,
        order: col.order,
      }));

      await tx.insert(listColumns).values(columnData);
      console.log(
        `Inserted ${columns.length} column definitions for list ${newList.id}`
      );

      // Process CSV rows
      await processCsvRows(
        csvStream,
        newList.id,
        columns,
        firstRowIsHeader,
        jobId,
        tx
      );

      thisWorkerProcessedRows = true;
      return { listId: newList.id, isDuplicate: false };
    });

    // Only mark as succeeded if this worker actually processed the rows
    if (thisWorkerProcessedRows) {
      await markSucceeded(jobId, result.listId);
    } else {
      console.log(
        `Job ${jobId} was duplicate - not marking as succeeded (other worker may still be processing)`
      );
    }

    const listId = result.listId;

    // Optional: Clean up R2 object if configured
    const shouldDeleteR2 = process.env.DELETE_R2_AFTER_IMPORT === "true";
    if (shouldDeleteR2) {
      await deleteObject(r2.bucket, r2.key);
    }

    console.log(
      `Successfully completed CSV import job ${jobId}, created list ${listId}`
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error during CSV import";
    console.error(`Failed to process CSV import job ${jobId}:`, error);
    await markFailed(jobId, errorMessage);
    throw error;
  }
}

/**
 * Process CSV rows and insert into database
 */
async function processCsvRows(
  csvStream: NodeJS.ReadableStream,
  listId: string,
  columns: Array<{
    name: string;
    key: string;
    type: ColumnType;
    order: number;
  }>,
  firstRowIsHeader: boolean,
  jobId: string,
  tx: DbWsTransaction
): Promise<void> {
  return new Promise((resolve, reject) => {
    let processedRows = 0;
    let batch: Array<{ listId: string; data: Record<string, any> }> = [];

    // Create column key mapping for easy lookup
    const columnMap = new Map(columns.map((col) => [col.name, col]));

    // Configure CSV parser with canonical headers (eliminates header mismatch issues)
    const parserOptions: any = {
      // Always use our canonical column names as headers
      headers: columns.map((col) => col.name),
      // Use mapValues to trim all cell values
      mapValues: ({ value }: { value: string }) =>
        typeof value === "string" ? value.trim() : value,
    };

    // If CSV has header row, skip it since we're using canonical headers
    if (firstRowIsHeader) {
      parserOptions.skipLines = 1;
    }

    const parser = csv(parserOptions);

    parser.on("data", async (row: Record<string, string>) => {
      try {
        // Skip completely empty rows (all values are empty or null)
        const hasData = Object.values(row).some(
          (value) => value != null && value.toString().trim() !== ""
        );
        if (!hasData) {
          return;
        }

        // Build data object with proper typing
        const dataObj: Record<string, any> = {};

        // With canonical headers, every column in row corresponds to a defined column
        for (const [columnName, rawValue] of Object.entries(row)) {
          const column = columnMap.get(columnName);
          // This should never be null since we use canonical headers
          if (!column) {
            throw new Error(
              `Unexpected: column "${columnName}" not found in column map`
            );
          }

          // Value is already trimmed by mapValues
          const trimmedValue = rawValue;

          // Parse value based on column type
          if (column.type === "jsonb" && trimmedValue) {
            try {
              // Only attempt JSON parsing for non-empty values that look like JSON
              const firstChar = trimmedValue.match(/\S/)?.[0];
              if (firstChar === "{" || firstChar === "[") {
                const parsed = JSON.parse(trimmedValue);
                if (
                  parsed !== null &&
                  (Array.isArray(parsed) || typeof parsed === "object")
                ) {
                  dataObj[column.key] = parsed;
                } else {
                  dataObj[column.key] = trimmedValue;
                }
              } else {
                dataObj[column.key] = trimmedValue;
              }
            } catch (parseError) {
              throw new Error(
                `Invalid JSON in column "${column.name}": ${trimmedValue}`
              );
            }
          } else {
            dataObj[column.key] = trimmedValue || null;
          }
        }

        // Add to batch
        batch.push({
          listId,
          data: dataObj,
        });

        processedRows++;

        // Insert batch when it reaches the limit
        if (batch.length >= INSERT_BATCH_SIZE) {
          // Pause the parser to prevent backpressure during async DB operation
          parser.pause();
          try {
            await insertBatch(tx, batch);
            batch = [];
          } finally {
            // Always resume, even if insert fails
            parser.resume();
          }
        }

        // Report progress periodically
        if (processedRows % PROGRESS_REPORT_INTERVAL === 0) {
          // Pause the parser during progress reporting
          parser.pause();
          try {
            await reportProgress(jobId, processedRows);
          } finally {
            // Always resume, even if progress reporting fails
            parser.resume();
          }
        }
      } catch (error) {
        parser.destroy();
        reject(error);
        return;
      }
    });

    parser.on("end", async () => {
      try {
        // Insert remaining rows in batch
        if (batch.length > 0) {
          await insertBatch(tx, batch);
        }

        // Final progress report
        await reportProgress(jobId, processedRows);

        console.log(`Processed ${processedRows} rows for list ${listId}`);

        resolve();
      } catch (error) {
        reject(error);
      }
    });

    parser.on("error", (error) => {
      reject(new Error(`CSV parsing error: ${error.message}`));
    });

    // Start streaming
    csvStream.pipe(parser);
  });
}

/**
 * Insert a batch of rows into the database
 */
async function insertBatch(
  tx: DbWsTransaction,
  batch: Array<{ listId: string; data: Record<string, any> }>
): Promise<void> {
  if (batch.length === 0) return;

  try {
    await tx.insert(listRows).values(batch);
    console.log(`Inserted batch of ${batch.length} rows`);
  } catch (error) {
    console.error(`Failed to insert batch of ${batch.length} rows:`, error);
    throw error;
  }
}
