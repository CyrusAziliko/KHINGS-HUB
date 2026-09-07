import { supabase } from "./supabaseClient.js";

export async function initChatbotPage() {
  const box = document.querySelector("[data-chat-box]");
  const input = document.querySelector("[data-chat-input]");
  const sendBtn = document.querySelector("[data-chat-send]");
  const suggestions = document.querySelector("[data-chat-suggestions]");

  if (!box || !input || !sendBtn) return;

  const renderMessage = (content, who) => {
    const msg = document.createElement("div");
    msg.className = who === "user" ? "chat chat-user" : "chat chat-bot";

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    bubble.textContent = content ?? "";

    const meta = document.createElement("div");
    meta.className = "chat-meta";
    meta.textContent = who === "user" ? "You" : "AI";

    msg.appendChild(bubble);
    msg.appendChild(meta);
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
    return msg;
  };

  const localState = { messages: [] };
  let currentConversationId = null;

  const edgeRequest = async (payload) => {
    // supabase-js will include the user's JWT automatically when session exists.
    const { data, error } = await supabase.functions.invoke(
      window.VAULTDESK_CONFIG.GEMINI_EDGE_FUNCTION,
      { body: payload }
    );
    if (error) throw error;
    return data;
  };

  // Default suggestions
  const defaultSuggestions = [
    "I need to report a safety incident.",
    "Create a ticket: maintenance system access issue.",
    "What should I do during an equipment emergency?",
    "Help me draft an HR-related message.",
  ];

  if (suggestions) {
    suggestions.innerHTML = "";
    defaultSuggestions.forEach((t) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pill";
      btn.textContent = t;
      btn.addEventListener("click", async () => {
        input.value = t;
        await send();
      });
      suggestions.appendChild(btn);
    });
  }

  const clearChatUI = () => {
    box.innerHTML = "";
    localState.messages = [];
  };

  async function loadConversationHistory() {
    clearChatUI();

    if (!currentConversationId) return;

    const res = await edgeRequest({ action: "load", conversation_id: currentConversationId });
    const messages = res?.messages ?? [];

    messages.forEach((m) => {
      renderMessage(m.content, m.role === "user" ? "user" : "bot");
      localState.messages.push({ role: m.role, content: m.content });
    });
  }

  async function ensureConversationIdForSend() {
    // If we don't have a conversation yet, we let the backend create one.
    if (currentConversationId) return currentConversationId;

    // For creation, we pass conversation_id: null/undefined and send action via normal send.
    return null;
  }

  async function send() {
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    renderMessage(text, "user");
    localState.messages.push({ role: "user", content: text });

    sendBtn.disabled = true;
    try {
      const thinkingEl = renderMessage("Thinking…", "bot");

      const payload = {
        conversation_id: currentConversationId ?? null,
        message: text,
      };

      const response = await edgeRequest(payload);
      const answer = response?.reply || response?.answer || response?.response || "";
      const returnedConversationId = response?.conversation_id ?? null;

      if (thinkingEl) thinkingEl.remove();
      renderMessage(answer || "No response.", "bot");
      localState.messages.push({ role: "assistant", content: answer });

      if (returnedConversationId) {
        currentConversationId = returnedConversationId;
      }
    } catch (err) {
      renderMessage(err?.message || String(err), "bot");
    } finally {
      sendBtn.disabled = false;
    }
  }

  // Event handlers
  sendBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await send();
  });

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await send();
    }
  });

  // Conversations sidebar (backend-driven)
  const conversationsEl = document.querySelector("[data-chat-conversations]");
  const newChatBtn = document.querySelector("[data-chat-new]");

  const renderConversations = (items) => {
    if (!conversationsEl) return;
    conversationsEl.innerHTML = "";

    if (!items?.length) {
      const empty = document.createElement("div");
      empty.textContent = "No conversations yet.";
      empty.style.opacity = "0.8";
      conversationsEl.appendChild(empty);
      return;
    }

    items.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn ghost";
      btn.style.textAlign = "left";
      btn.style.padding = "10px";
      btn.style.borderRadius = "12px";
      btn.style.background = c.id === currentConversationId ? "rgba(124,58,237,0.18)" : "transparent";
      btn.textContent = c.title || "Untitled";

      btn.addEventListener("click", async () => {
        currentConversationId = c.id;
        await loadConversationHistory().catch(() => {});
        // re-render selection
        renderConversations(items);
      });

      conversationsEl.appendChild(btn);
    });
  };

  const loadConversationsList = async () => {
    // Ask backend to list conversations (via chat-ai action)
    // If action isn't supported, it will fail silently and we fall back to fresh conversation.
    if (!conversationsEl) return;

    try {
      const res = await edgeRequest({ action: "list_conversations" });
      renderConversations(res?.conversations ?? []);
    } catch (e) {
      // no-op
    }
  };

  if (newChatBtn) {
    newChatBtn.addEventListener("click", async () => {
      currentConversationId = null;
      clearChatUI();
      // Optionally refresh list after creation on first send
      await loadConversationsList().catch(() => {});
    });
  }

  // Initial load: list conversations then load selected (latest if possible)
  await (async () => {
    await loadConversationsList().catch(() => {});

    const selected = window.__VAULTDESK_SELECTED_CONVERSATION_ID__;
    if (selected) currentConversationId = selected;

    // If none selected, try to load most recent if list is available
    if (!currentConversationId && conversationsEl?.children?.length) {
      const firstBtn = conversationsEl.querySelector("button");
      if (firstBtn?.textContent) {
        // We can't reliably get id from text; rely on backend returning messages only when selected.
      }
    }

    await loadConversationHistory().catch(() => {});
  })();
}



