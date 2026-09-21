/**
 * Fly Dragon AI
 * Cloudflare Workers AI type definitions
 */

export interface Env {
	AI: Ai;

	ASSETS: {
		fetch(request: Request): Promise<Response>;
	};
}

export type ChatMessageRole =
	| "system"
	| "user"
	| "assistant";

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
