/**
 * Fly Dragon AI
 * Real-time streaming chat client
 *
 * Features:
 * - POST /api/chat
 * - Server-Sent Events (SSE) streaming
 * - Conversation history in localStorage
 * - New chat
 * - Quick prompts
 * - Auto-resizing textarea
 * - Auto-scroll
 * - Error handling
 */

(() => {
  "use strict";

  // ------------------------------------------------------------
  // DOM ELEMENTS
  // ------------------------------------------------------------

  const chatForm = document.getElementById("chatForm");
  const messageInput = document.getElementById("messageInput");
  const sendButton = document.getElementById("sendButton");
  const messages = document.getElementById("messages");
  const chatArea = document.getElementById("chatArea");
  const welcome = document.getElementById("welcome");
  const quickPrompts = document.getElementById("quickPrompts");
  const newChatButton = document.getElementById("newChatButton");

  // ------------------------------------------------------------
  // CONFIG
  // ------------------------------------------------------------

  const STORAGE_KEY = "flydragon-chat-history";

  const API_URL = "/api/chat";

  let conversation = [];
  let isStreaming = false;

  // ------------------------------------------------------------
  // INITIALIZATION
  // ------------------------------------------------------------

  function init() {
    if (!chatForm || !messageInput || !messages) {
      console.error("Fly Dragon AI: Required chat elements are missing.");
      return;
    }

    loadHistory();
    setupEvents();
    autoResize();

    if (conversation.length) {
      hideWelcome();
      renderHistory();
    } else {
      showWelcome();
    }
  }

  // ------------------------------------------------------------
  // EVENT HANDLERS
  // ------------------------------------------------------------

  function setupEvents() {
    // Submit
    chatForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (isStreaming) return;

      const text = messageInput.value.trim();

      if (!text) return;

      await sendMessage(text);
    });

    // Textarea resize
    messageInput.addEventListener("input", autoResize);

    // Enter = send
    // Shift + Enter = new line
    messageInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();

        if (!isStreaming) {
          chatForm.requestSubmit();
        }
      }
    });

    // New chat
    if (newChatButton) {
      newChatButton.addEventListener("click", newChat);
    }

    // Quick prompts
    document.querySelectorAll("[data-prompt]").forEach((button) => {
      button.addEventListener("click", () => {
        const prompt = button.dataset.prompt || "";

        if (!prompt || isStreaming) return;

        messageInput.value = prompt;
        autoResize();
        messageInput.focus();
      });
    });
  }

  // ------------------------------------------------------------
  // SEND MESSAGE
  // ------------------------------------------------------------

  async function sendMessage(text) {
    if (isStreaming) return;

    isStreaming = true;
    setLoading(true);

    hideWelcome();

    // Add user message to UI
    addMessage("user", text);

    // Add user message to conversation
    conversation.push({
      role: "user",
      content: text
    });

    saveHistory();

    // Clear input
    messageInput.value = "";
    autoResize();

    // Create empty assistant message
    const assistant = createMessageElement("assistant");

    messages.appendChild(assistant.container);

    const contentElement = assistant.content;

    let assistantText = "";

    try {
      const response = await fetch(API_URL, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },

        body: JSON.stringify({
          messages: conversation
        })
      });

      // --------------------------------------------------------
      // HTTP ERROR
      // --------------------------------------------------------

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");

        let message = errorText;

        // Try JSON error
        try {
          const json = JSON.parse(errorText);

          message =
            json.error ||
            json.message ||
            json.detail ||
            errorText;
        } catch (_) {
          // Not JSON
        }

        throw new Error(
          message || `HTTP ${response.status}`
        );
      }

      // --------------------------------------------------------
      // STREAMING CHECK
      // --------------------------------------------------------

      if (!response.body) {
        throw new Error(
          "Streaming is not supported by this response."
        );
      }

      // --------------------------------------------------------
      // READ SSE STREAM
      // --------------------------------------------------------

      const reader = response.body.getReader();

      const decoder = new TextDecoder("utf-8");

      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, {
          stream: true
        });

        // SSE events are separated by blank lines
        const parts = buffer.split(/\r?\n\r?\n/);

        buffer = parts.pop() || "";

        for (const event of parts) {
          const token = extractToken(event);

          if (token === null) {
            continue;
          }

          if (token === "[DONE]") {
            continue;
          }

          assistantText += token;

          contentElement.textContent = assistantText;

          scrollToBottom();
        }
      }

      // --------------------------------------------------------
      // FLUSH DECODER
      // --------------------------------------------------------

      buffer += decoder.decode();

      if (buffer.trim()) {
        const token = extractToken(buffer);

        if (
          token !== null &&
          token !== "[DONE]"
        ) {
          assistantText += token;

          contentElement.textContent = assistantText;

          scrollToBottom();
        }
      }

      // --------------------------------------------------------
      // EMPTY RESPONSE
      // --------------------------------------------------------

      if (!assistantText.trim()) {
        assistantText =
          "I didn't receive a response from the AI.";

        contentElement.textContent = assistantText;
      }

      // --------------------------------------------------------
      // SAVE ASSISTANT RESPONSE
      // --------------------------------------------------------

      conversation.push({
        role: "assistant",
        content: assistantText
      });

      saveHistory();

    } catch (error) {
      console.error(
        "Fly Dragon AI chat error:",
        error
      );

      const errorMessage =
        getErrorMessage(error);

      // If partial response exists, keep it
      if (assistantText.trim()) {
        contentElement.textContent =
          assistantText +
          "\n\n⚠️ " +
          errorMessage;
      } else {
        contentElement.textContent =
          "⚠️ " + errorMessage;
      }

    } finally {
      isStreaming = false;
      setLoading(false);

      scrollToBottom();

      messageInput.focus();
    }
  }

  // ------------------------------------------------------------
  // SSE TOKEN EXTRACTION
  // ------------------------------------------------------------

  function extractToken(event) {
    if (!event) {
      return null;
    }

    const lines = event.split(/\r?\n/);

    let dataLines = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Ignore comments
      if (!trimmed || trimmed.startsWith(":")) {
        continue;
      }

      // Standard SSE format
      if (trimmed.startsWith("data:")) {
        dataLines.push(
          trimmed.slice(5).trimStart()
        );
      }
    }

    if (!dataLines.length) {
      return null;
    }

    const data = dataLines.join("\n");

    if (!data) {
      return null;
    }

    if (data === "[DONE]") {
      return "[DONE]";
    }

    // ----------------------------------------------------------
    // JSON SSE
    // ----------------------------------------------------------

    try {
      const json = JSON.parse(data);

      // Common formats
      if (typeof json === "string") {
        return json;
      }

      if (
        typeof json.response === "string"
      ) {
        return json.response;
      }

      if (
        typeof json.token === "string"
      ) {
        return json.token;
      }

      if (
        typeof json.content === "string"
      ) {
        return json.content;
      }

      if (
        typeof json.text === "string"
      ) {
        return json.text;
      }

      // OpenAI-style delta
      if (
        json.choices &&
        json.choices[0] &&
        json.choices[0].delta &&
        typeof json.choices[0].delta.content === "string"
      ) {
        return json.choices[0].delta.content;
      }

      // Cloudflare-style nested response
      if (
        json.result &&
        typeof json.result.response === "string"
      ) {
        return json.result.response;
      }

      if (
        json.result &&
        typeof json.result.token === "string"
      ) {
        return json.result.token;
      }

      // Error returned inside stream
      if (json.error) {
        return `\n\n⚠️ ${json.error}`;
      }

      return "";

    } catch (_) {
      // --------------------------------------------------------
      // Plain-text SSE
      // --------------------------------------------------------

      return data;
    }
  }

  // ------------------------------------------------------------
  // ADD MESSAGE
  // ------------------------------------------------------------

  function addMessage(role, text) {
    const message = createMessageElement(
      role,
      text
    );

    messages.appendChild(
      message.container
    );

    scrollToBottom();

    return message;
  }

  // ------------------------------------------------------------
  // CREATE MESSAGE ELEMENT
  // ------------------------------------------------------------

  function createMessageElement(
    role,
    text = ""
  ) {
    const container =
      document.createElement("div");

    container.className =
      `message message-${role}`;

    const inner =
      document.createElement("div");

    inner.className = "message-inner";

    const content =
      document.createElement("div");

    content.className =
      "message-content";

    // Use textContent instead of innerHTML
    // to prevent injected HTML/XSS.
    content.textContent = text;

    inner.appendChild(content);
    container.appendChild(inner);

    return {
      container,
      content
    };
  }

  // ------------------------------------------------------------
  // RENDER HISTORY
  // ------------------------------------------------------------

  function renderHistory() {
    messages.innerHTML = "";

    conversation.forEach((message) => {
      if (
        !message ||
        !message.role ||
        typeof message.content !== "string"
      ) {
        return;
      }

      // Only render user/assistant messages
      if (
        message.role !== "user" &&
        message.role !== "assistant"
      ) {
        return;
      }

      const element = createMessageElement(
        message.role,
        message.content
      );

      messages.appendChild(
        element.container
      );
    });

    scrollToBottom();
  }

  // ------------------------------------------------------------
  // LOCAL STORAGE
  // ------------------------------------------------------------

  function saveHistory() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(conversation)
      );
    } catch (error) {
      console.warn(
        "Fly Dragon AI: Could not save chat history.",
        error
      );
    }
  }

  function loadHistory() {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        conversation = [];
        return;
      }

      const parsed = JSON.parse(saved);

      if (!Array.isArray(parsed)) {
        conversation = [];
        return;
      }

      // Sanitize stored messages
      conversation = parsed.filter(
        (message) => {
          return (
            message &&
            typeof message === "object" &&
            (
              message.role === "user" ||
              message.role === "assistant"
            ) &&
            typeof message.content === "string"
          );
        }
      );

    } catch (error) {
      console.warn(
        "Fly Dragon AI: Could not load chat history.",
        error
      );

      conversation = [];
    }
  }

  // ------------------------------------------------------------
  // NEW CHAT
  // ------------------------------------------------------------

  function newChat() {
    if (isStreaming) {
      return;
    }

    conversation = [];

    try {
      localStorage.removeItem(
        STORAGE_KEY
      );
    } catch (error) {
      console.warn(
        "Fly Dragon AI: Could not clear history.",
        error
      );
    }

    messages.innerHTML = "";

    showWelcome();

    messageInput.value = "";

    autoResize();

    messageInput.focus();
  }

  // ------------------------------------------------------------
  // WELCOME SCREEN
  // ------------------------------------------------------------

  function hideWelcome() {
    if (welcome) {
      welcome.hidden = true;
      welcome.classList.add("hidden");
    }

    if (quickPrompts) {
      quickPrompts.classList.add("hidden");
    }
  }

  function showWelcome() {
    if (welcome) {
      welcome.hidden = false;
      welcome.classList.remove("hidden");
    }

    if (quickPrompts) {
      quickPrompts.classList.remove("hidden");
    }
  }

  // ------------------------------------------------------------
  // LOADING STATE
  // ------------------------------------------------------------

  function setLoading(loading) {
    if (sendButton) {
      sendButton.disabled = loading;

      sendButton.setAttribute(
        "aria-busy",
        loading ? "true" : "false"
      );
    }

    if (messageInput) {
      messageInput.disabled = loading;
    }

    if (chatForm) {
      chatForm.classList.toggle(
        "is-loading",
        loading
      );
    }

    if (chatArea) {
      chatArea.classList.toggle(
        "is-loading",
        loading
      );
    }
  }

  // ------------------------------------------------------------
  // AUTO RESIZE TEXTAREA
  // ------------------------------------------------------------

  function autoResize() {
    if (!messageInput) {
      return;
    }

    messageInput.style.height = "auto";

    const maxHeight = 180;

    const newHeight = Math.min(
      messageInput.scrollHeight,
      maxHeight
    );

    messageInput.style.height =
      `${newHeight}px`;

    messageInput.style.overflowY =
      messageInput.scrollHeight > maxHeight
        ? "auto"
        : "hidden";
  }

  // ------------------------------------------------------------
  // SCROLL
  // ------------------------------------------------------------

  function scrollToBottom() {
    if (!messages) {
      return;
    }

    requestAnimationFrame(() => {
      messages.scrollTop =
        messages.scrollHeight;
    });

    if (chatArea) {
      requestAnimationFrame(() => {
        chatArea.scrollTop =
          chatArea.scrollHeight;
      });
    }
  }

  // ------------------------------------------------------------
  // ERROR MESSAGE
  // ------------------------------------------------------------

  function getErrorMessage(error) {
    if (!error) {
      return "Something went wrong.";
    }

    const message =
      String(error.message || error);

    // Network error
    if (
      message.includes("Failed to fetch") ||
      message.includes("NetworkError")
    ) {
      return (
        "Unable to connect to Fly Dragon AI. " +
        "Please check your internet connection " +
        "and try again."
      );
    }

    // Common Cloudflare errors
    if (
      message.includes("Insufficient wholesale credits")
    ) {
      return (
        "The AI model is currently unavailable " +
        "because the AI Gateway has insufficient credits."
      );
    }

    if (
      message.includes("Quota") ||
      message.includes("quota")
    ) {
      return (
        "The AI service quota has been exceeded. " +
        "Please try again later."
      );
    }

    if (
      message.includes("Unauthorized") ||
      message.includes("401")
    ) {
      return (
        "The AI service authorization failed. " +
        "Please check the server configuration."
      );
    }

    if (
      message.includes("403")
    ) {
      return (
        "The AI service denied the request."
      );
    }

    if (
      message.includes("404")
    ) {
      return (
        "The AI chat endpoint was not found. " +
        "Please check the Worker API configuration."
      );
    }

    if (
      message.includes("429")
    ) {
      return (
        "Too many requests. " +
        "Please wait a moment and try again."
      );
    }

    if (
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504")
    ) {
      return (
        "The AI server is temporarily unavailable. " +
        "Please try again in a moment."
      );
    }

    return message || "Something went wrong.";
  }

  // ------------------------------------------------------------
  // START
  // ------------------------------------------------------------

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }

})();

Important

This version keeps your frontend endpoint exactly as:

const API_URL = "/api/chat";

and sends:

{
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    }
  ]
}

The client also accepts several common SSE response formats, including:

data: Hello

data: {"response":"Hello"}

data: {"token":"Hello"}

data: {"content":"Hello"}

and OpenAI-style:

data: {"choices":[{"delta":{"content":"Hello"}}]}

One important architectural point: "chat.js" cannot fix a Worker that isn't actually returning SSE data. Your "/api/chat" Worker must return a valid streaming "Response" with an SSE-compatible "Content-Type" (normally "text/event-stream"). If you give me your current "src/index.js", I can make the Worker and this "chat.js" match each other exactly.