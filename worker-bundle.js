// Fly Dragon AI — Main Worker
// AI Gateway: ai_dragon | Model: @cf/meta/llama-3.1-8b-instruct-fast

// Constants
const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const GATEWAY_ID = "ai_dragon";
const SYSTEM_PROMPT = `You are Fly Dragon AI...`;

// Tool Registry (same structure, updated references)
const TOOLS = { ... };
function detectToolCall(message) { ... }

// CORS (allow all)
function corsHeaders(origin) { ... }

// Rate Limiting (same)
// Validation (same, but also accept messages array)
// Content-Type (same)

// Main Handler (same structure)
export default { async fetch(request, env) { ... } };

// Health endpoint (same, uses constants)
// Status endpoint (same)
// Tools list endpoint (same)

// Chat endpoint (updated to accept messages array + gateway option)
async function handleChat(request, env) { ... }

// Utilities (same)
