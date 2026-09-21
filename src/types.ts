/**
 * Fly Dragon AI
 *
 * Type definitions for the Cloudflare Workers AI chat application.
 */

/**
 * Cloudflare Worker environment bindings.
 */
export interface Env {
	/**
	 * Cloudflare Workers AI binding.
	 *
	 * Used by src/index.ts:
	 * env.AI.run(...)
	 */
	AI: Ai;

	/**
	 * Static asset binding.
	 *
	 * Serves public/index.html and public/chat.js.
	 */
	ASSETS: {
		fetch: (request: Request) => Promise<Response>;
	};
}

/**
 * Supported chat message roles.
 */
export type ChatMessageRole =
	| "system"
	| "user"
	| "assistant";

/**
 * A single message in the conversation.
 *
 * The frontend sends the previous conversation history
 * to /api/chat on every request.
 */
export interface ChatMessage {
	role: ChatMessageRole;
	content: string;
}

/**
 * Request body accepted by POST /api/chat.
 *
 * Example:
 *
 * {
 *   "messages": [
 *     {
 *       "role": "user",
 *       "content": "Tell me about Japan visa."
 *     }
 *   ]
 * }
 */
export interface ChatRequest {
	messages?: ChatMessage[];
}

/**
 * Standard error returned by the chat API.
 */
export interface ChatErrorResponse {
	error: string;
	model?: string;
	gateway?: string;
	details?: string;
}