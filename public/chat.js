/**
 * Fly Dragon AI
 * Real-time streaming chat client
 */

(() => {
  "use strict";

  const chatForm = document.getElementById("chatForm");
  const messageInput = document.getElementById("messageInput");
  const sendButton = document.getElementById("sendButton");
  const messages = document.getElementById("messages");
  const chatArea = document.getElementById("chatArea");
  const welcome = document.getElementById("welcome");
  const quickPrompts = document.getElementById("quickPrompts");
  const newChatButton = document.getElementById("newChatButton");

  const STORAGE_KEY = "flydragon-chat-history";

  let conversation = [];
  let isStreaming = false;

  function init() {
    loadHistory();
    setupEvents();
    autoResize();

    if (conversation.length) {
      hideWelcome();
      renderHistory();
    }
  }

  function setupEvents() {
    chatForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (isStreaming) return;

      const text = messageInput.value.trim();

      if (!text) return;

      await sendMessage(text);
    });

    messageInput.addEventListener("input", autoResize);

    messageInput.addEventListener("keydown", (event) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        if (!isStreaming) {
          chatForm.requestSubmit();
        }
      }
    });

    if (newChatButton) {
      newChatButton.addEventListener("click", newChat);
    }

    document.querySelectorAll("[data-prompt]").forEach((button) => {
      button.addEventListener("click", () => {
        messageInput.value =
          button.dataset.prompt || "";

        autoResize();
        messageInput.focus();
      });
    });
  }

  async function sendMessage(text) {
    if (isStreaming) return;

    isStreaming = true;
    setLoading(true);

    hideWelcome();

    addMessage("user", text);

    conversation.push({
      role: "user",
      content: text
    });

    saveHistory();

    messageInput.value = "";
    autoResize();

    const assistant = createMessageElement("assistant");

    messages.appendChild(assistant.container);

    const contentElement = assistant.content;

    let assistantText = "";

    try {
      const response = await fetch("api/chat", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },

        body: JSON.stringify({
          messages: conversation
        })
      });

      if (!response.ok) {
        const errorText =
          await response.text().catch(() => "");

        throw new Error(
          errorText ||
          `HTTP ${response.status}`
        );
      }

      if (!response.body) {
        throw new Error(
          "Streaming is not supported by this response."
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder("utf-8");

      let buffer = "";

      while (true) {
        const { value, done } =
          await reader.read();

        if (done) break;

        buffer += decoder.decode(
          value,
          { stream: true }
        );

        const parts =
          buffer.split(/\r?\n\r?\n/);

        buffer = parts.pop() || "";

        for (const event of parts) {
          const token =
            extractToken(event);

          if (
            token === null ||
            token === "[DONE]"
          ) {
            continue;
          }

          assistantText += token;

          // REAL-TIME UI UPDATE
          contentElement.textContent =
            assistantText;

          scrollToBottom();
        }
      }

      // Flush decoder
      buffer += decoder.decode();

      if (buffer.trim()) {
        const token =
          extractToken(buffer);

        if (
          token &&
          token !== "[DONE]"
        ) {
          assistantText += token;

          contentElement.textContent =
            assistantText;
        }
      }

      if (!assistantText.trim()) {
        throw new Error(
          "AI returned an empty response."
        );
      }

      conversation.push({
        role: "assistant",
        content: assistantText
      });

      saveHistory();
      scrollToBottom();

    } catch (error) {
      console.error(
        "Fly Dragon AI error:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong.";

      contentElement.textContent =
        `Sorry, I couldn't process your request.\n\n${message}`;
    }

    isStreaming = false;
    setLoading(false);
    messageInput.focus();
  }

  function extractToken(event) {
    const lines =
      event.split(/\r?\n/);

    const dataLines = [];

    for (const line of lines) {
      if (line.startsWith("data:")) {
        dataLines.push(
          line.slice(5).trimStart()
        );
      }
    }

    if (!dataLines.length) {
      return null;
    }

    const data =
      dataLines.join("\n");

    if (data === "[DONE]") {
      return "[DONE]";
    }

    try {
      const parsed =
        JSON.parse(data);

      if (typeof parsed === "string") {
        return parsed;
      }

      if (
        typeof parsed.response === "string"
      ) {
        return parsed.response;
      }

      if (
        typeof parsed.text === "string"
      ) {
        return parsed.text;
      }

      if (
        typeof parsed.content === "string"
      ) {
        return parsed.content;
      }

      if (
        typeof parsed.token === "string"
      ) {
        return parsed.token;
      }

      return null;

    } catch {
      // Cloudflare may send plain text chunks
      return data;
    }
  }

  function addMessage(role, text) {
    const element =
      createMessageElement(role);

    element.content.textContent = text;

    messages.appendChild(
      element.container
    );

    scrollToBottom();
  }

  function createMessageElement(role) {
    const container =
      document.createElement("div");

    container.className =
      `message ${role}`;

    const avatar =
      document.createElement("div");

    avatar.className =
      "message-avatar";

    avatar.textContent =
      role === "assistant"
        ? "F"
        : "You";

    const content =
      document.createElement("div");

    content.className =
      "message-content";

    if (role === "assistant") {
      container.appendChild(avatar);
      container.appendChild(content);
    } else {
      container.appendChild(content);
      container.appendChild(avatar);
    }

    return {
      container,
      content
    };
  }

  function saveHistory() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(conversation)
      );
    } catch (error) {
      console.warn(
        "Could not save history:",
        error
      );
    }
  }

  function loadHistory() {
    try {
      const saved =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!saved) return;

      const parsed =
        JSON.parse(saved);

      if (!Array.isArray(parsed)) return;

      conversation =
        parsed.filter(
          (message) =>
            message &&
            (
              message.role === "user" ||
              message.role === "assistant"
            ) &&
            typeof message.content ===
              "string"
        );

    } catch (error) {
      console.warn(
        "Could not load history:",
        error
      );

      conversation = [];
    }
  }

  function renderHistory() {
    messages.innerHTML = "";

    for (const message of conversation) {
      addMessage(
        message.role,
        message.content
      );
    }
  }

  function newChat() {
    if (isStreaming) return;

    conversation = [];

    try {
      localStorage.removeItem(
        STORAGE_KEY
      );
    } catch (error) {
      console.warn(
        "Could not clear history:",
        error
      );
    }

    messages.innerHTML = "";

    welcome.classList.remove("hidden");
    quickPrompts.classList.remove("hidden");

    messageInput.value = "";

    autoResize();
    messageInput.focus();
    scrollToBottom();
  }

  function hideWelcome() {
    welcome.classList.add("hidden");
    quickPrompts.classList.add("hidden");
  }

  function setLoading(loading) {
    sendButton.disabled = loading;
    messageInput.disabled = loading;

    if (loading) {
      sendButton.setAttribute(
        "aria-busy",
        "true"
      );
    } else {
      sendButton.removeAttribute(
        "aria-busy"
      );
    }
  }

  function autoResize() {
    messageInput.style.height = "auto";

    const height = Math.min(
      messageInput.scrollHeight,
      140
    );

    messageInput.style.height =
      `${height}px`;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatArea.scrollTop =
        chatArea.scrollHeight;
    });
  }

  init();
})();