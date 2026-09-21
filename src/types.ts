/**
 * Fly Dragon AI
 * Cloudflare Workers AI type definitions
 */

export type ChatMessageRole =
  | "system"
  | "user"
  | "assistant";

export interface Env {
  // Core AI
  AI: Ai;

  // R2 Buckets
  AI_CHAT_BUCKET: R2Bucket;
  flytripvisa_r2: R2Bucket;

  // KV
  flytripvisa_kv: KVNamespace;

  // D1 Database
  flytripvisa_db: D1Database;

  // AI Search
  dragon: AiSearch;

  // Browser / Images / Version
  Browser: BrowserWorker;
  Images: ImagesBinding;
  Version: VersionMetadata;

  // Static assets (from wrangler)
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}

export interface ChatRequest {
  messages?: ChatMessage[];
}

export interface ChatErrorResponse {
  error: string;
  model?: string;
  details?: string;
}

export interface UploadResponse {
  url?: string;
  key?: string;
  error?: string;
}
