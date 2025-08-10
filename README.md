# CSV Import Worker

A background worker service that processes CSV import jobs from QStash, streams files from Cloudflare R2, and imports data into PostgreSQL using Drizzle ORM.

## Architecture

- **Express server** with QStash webhook endpoint
- **Cloudflare R2** for CSV file storage
- **QStash** for reliable job queuing
- **Upstash Redis** for job status tracking
- **PostgreSQL** with Drizzle ORM for data persistence

## Environment Variables

Create a `.env` file with the following variables:

```bash
# Database Configuration
DATABASE_URL="postgresql://username:password@host:port/database"

# Cloudflare R2 Configuration
R2_ACCOUNT_ID="your-r2-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key-id"
R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
R2_BUCKET_NAME="your-r2-bucket-name"

# QStash Configuration
QSTASH_CURRENT_SIGNING_KEY="your-qstash-current-signing-key"
QSTASH_NEXT_SIGNING_KEY="your-qstash-next-signing-key"

# Upstash Redis Configuration
UPSTASH_REDIS_REST_URL="https://your-redis-endpoint.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-redis-token"

# Optional Configuration
DELETE_R2_AFTER_IMPORT="false"  # Set to "true" to delete CSV files after successful import
PORT="3000"  # Server port (default: 3000)
```

## Development

```bash
# Install dependencies
pnpm install

# Start development server with auto-reload
pnpm dev

# Type check
pnpm typecheck
```

## Production

```bash
# Start production server
pnpm start
```

## API Endpoints

### `POST /qstash/import`

Main webhook endpoint for processing CSV import jobs from QStash.

- Verifies QStash signature
- Validates payload schema
- Streams CSV from R2
- Imports data in batches
- Updates job status in Redis

### `GET /health`

Health check endpoint.

## Processing Flow

1. **Receive QStash message** with job metadata and R2 file location
2. **Verify signature** to ensure request authenticity
3. **Mark job as running** in Redis
4. **Check idempotency** - skip if job already processed
5. **Stream CSV from R2** using S3-compatible client
6. **Parse CSV** with proper header handling and type inference
7. **Create database transaction**:
   - Insert list record with jobId for idempotency
   - Insert column definitions
   - Batch insert rows (500 per batch)
8. **Update job status** to succeeded/failed
9. **Optional cleanup** - delete R2 file if configured

## Key Features

- **Idempotency**: Jobs can be safely retried without duplicating data
- **Batch processing**: Inserts rows in configurable batches for performance
- **Progress tracking**: Reports progress every 1000 rows
- **Type inference**: Supports string and JSONB column types
- **Error handling**: Comprehensive error reporting and logging
- **Memory efficient**: Streams large CSV files without loading into memory

## Configuration

- `INSERT_BATCH_SIZE`: 500 rows per database insert batch
- `PROGRESS_REPORT_INTERVAL`: Report progress every 1000 rows
- `MAX_FILE_SIZE`: 200MB maximum CSV file size

## Deployment

Deploy to any Node.js hosting platform (Render, Railway, Fly.io, etc.) and configure:

1. Set environment variables
2. Ensure public HTTPS endpoint is accessible
3. Update `QSTASH_WORKER_URL` in your main application to point to this worker

## Error Handling

The worker handles various error scenarios:

- **Invalid QStash signature**: Returns 401
- **Malformed payload**: Returns 400 with validation details
- **R2 file not found**: Fails job with clear error message
- **JSON parsing errors**: Fails job with specific column and value details
- **Database errors**: Fails job with transaction rollback
- **Network issues**: Automatic retries via QStash
