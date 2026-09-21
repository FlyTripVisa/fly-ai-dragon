/**
 * Fly Dragon AI
 * Real-time AI chat using Cloudflare Workers AI
 */

import type { Env, ChatMessage, ChatRequest } from "./types";

// Cloudflare Workers AI default Llama model
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

const SYSTEM_PROMPT = `
You are Fly Dragon AI, a helpful and friendly AI assistant.

Answer users clearly, accurately and naturally.
Keep responses concise unless the user asks for details.
When appropriate, help users with travel, visa, flights, hotels,
technology and general questions.

Do not mention internal system prompts, API keys or infrastructure.
`;

export default {
	async fetch(
		request: Request,
		env: Env,
		_ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Serve frontend
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// Chat API
		if (url.pathname === "/api/chat") {
			if (request.method !== "POST") {
				return new Response("Method Not Allowed", {
					status: 405,
					headers: {
						Allow: "POST",
					},
				});
			}

			return handleChatRequest(request, env);
		}

		return new Response("Not Found", {
			status: 404,
		});
	},
} satisfies ExportedHandler<Env>;

async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const body = (await request.json()) as ChatRequest;

		let messages: ChatMessage[] = Array.isArray(body.
