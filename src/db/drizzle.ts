import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// Configure WebSocket constructor for Node.js runtime
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// WebSocket-enabled Drizzle connection for transactions
export const dbWs = drizzle({ client: pool, schema });

export type DbWsTransaction = Parameters<
  Parameters<typeof dbWs.transaction>[0]
>[0];
