import "dotenv/config";
import express, { type Request } from "express";
import rawBody from "raw-body";
import { Receiver } from "@upstash/qstash";
import { WorkerMessageSchema } from "./types";
import { processImport } from "./worker";

const app = express();
const port = process.env.PORT || 3000;

// QStash Configuration
const QSTASH_CURRENT_SIGNING_KEY = process.env.QSTASH_CURRENT_SIGNING_KEY;
const QSTASH_NEXT_SIGNING_KEY = process.env.QSTASH_NEXT_SIGNING_KEY;

if (!QSTASH_CURRENT_SIGNING_KEY || !QSTASH_NEXT_SIGNING_KEY) {
  throw new Error("Missing QStash signing key environment variables");
}

// Initialize QStash receiver
const qstashReceiver = new Receiver({
  currentSigningKey: QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: QSTASH_NEXT_SIGNING_KEY,
});

// Health check endpoint
app.get("/health", (_req: Request, res: any) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "csv-import-worker",
  });
});

// Main QStash endpoint for CSV import jobs
app.post("/qstash/import", async (req: any, res: any) => {
  try {
    // Get raw body for signature verification
    const body = await rawBody(req, {
      length: req.headers["content-length"],
      limit: "10mb", // Reasonable limit for metadata payloads
    });

    const signature = req.headers["upstash-signature"] as string;

    if (!signature) {
      console.error("Missing QStash signature header");
      return res.status(401).json({ error: "Missing signature" });
    }

    // Verify QStash signature
    try {
      const isValid = await qstashReceiver.verify({
        signature,
        body: body.toString("utf-8"),
      });

      if (!isValid) {
        console.error("Invalid QStash signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    } catch (verifyError) {
      console.error("QStash signature verification failed:", verifyError);
      return res.status(401).json({ error: "Signature verification failed" });
    }

    // Parse and validate the message
    let message;
    try {
      const parsed = JSON.parse(body.toString("utf-8"));
      message = WorkerMessageSchema.parse(parsed);
    } catch (parseError) {
      console.error("Invalid message payload:", parseError);
      return res.status(400).json({
        error: "Invalid payload",
        details:
          parseError instanceof Error
            ? parseError.message
            : "Unknown parsing error",
      });
    }

    console.log(`Received CSV import job: ${message.jobId}`, {
      listName: message.listName,
      userId: message.userId,
      columnsCount: message.columns.length,
      r2Key: message.r2.key,
    });

    // Respond quickly to QStash (don't await processImport)
    res.status(200).json({
      message: "Job received and queued for processing",
      jobId: message.jobId,
    });

    // Process the import asynchronously
    processImport(message).catch((error) => {
      console.error(`Async processing failed for job ${message.jobId}:`, error);
    });
  } catch (error) {
    console.error("Error handling QStash request:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Error handling middleware
const errorHandler = (error: any, _req: any, res: any, next: any) => {
  console.error("Unhandled error:", error);
  if (res.headersSent) return next(error);
  res.status(500).json({
    error: "Internal server error",
    details: (error as Error).message,
  });
};

app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(`CSV Import Worker running on port ${port}`);
  console.log("Environment check:");
  console.log(
    "- DATABASE_URL:",
    process.env.DATABASE_URL ? "✓ Set" : "✗ Missing"
  );
  console.log(
    "- R2_ACCOUNT_ID:",
    process.env.R2_ACCOUNT_ID ? "✓ Set" : "✗ Missing"
  );
  console.log(
    "- R2_ACCESS_KEY_ID:",
    process.env.R2_ACCESS_KEY_ID ? "✓ Set" : "✗ Missing"
  );
  console.log(
    "- R2_SECRET_ACCESS_KEY:",
    process.env.R2_SECRET_ACCESS_KEY ? "✓ Set" : "✗ Missing"
  );
  console.log(
    "- R2_BUCKET_NAME:",
    process.env.R2_BUCKET_NAME ? "✓ Set" : "✗ Missing"
  );
  console.log(
    "- QSTASH_CURRENT_SIGNING_KEY:",
    QSTASH_CURRENT_SIGNING_KEY ? "✓ Set" : "✗ Missing"
  );
  console.log(
    "- QSTASH_NEXT_SIGNING_KEY:",
    QSTASH_NEXT_SIGNING_KEY ? "✓ Set" : "✗ Missing"
  );
  console.log(
    "- UPSTASH_REDIS_REST_URL:",
    process.env.UPSTASH_REDIS_REST_URL ? "✓ Set" : "✗ Missing"
  );
  console.log(
    "- UPSTASH_REDIS_REST_TOKEN:",
    process.env.UPSTASH_REDIS_REST_TOKEN ? "✓ Set" : "✗ Missing"
  );
  console.log(
    "- DELETE_R2_AFTER_IMPORT:",
    process.env.DELETE_R2_AFTER_IMPORT || "false"
  );
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down gracefully");
  process.exit(0);
});
