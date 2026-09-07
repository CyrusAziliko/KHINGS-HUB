import {
  createGroupConversation,
  getCurrentMessagingIdentity,
  getOrCreateDirectConversation,
  getProfileSummary,
  listUserConversations,
  loadConversationMessages,
  searchEmployees,
  sendConversationMessage,
  subscribeToMessagingRealtime,
  updateLastReadAt,
} from "./services/workerMessagesService.js";

const moduleState = {
  initialized: false,
  user: null,
  profile: null,
  conversations: [],
  activeConversationId: null,
  listSearch: "",
  messagesByConversation: new Map(),
  profileCache: new Map(),
  employees: [],
  selectedGroupMemberIds: new Set(),
  composerLocked: false,
  unsubscribeRealtime: null,
  elements: {},
};

function escapeHtml(text) {
  if (text == null) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

function getInitials(name) {
  if (!name) return "?";
  return String(name)
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

function getAvatarColor(seed) {
  const palette = ["#2563EB", "#16A34A", "#0EA5E9", "#D97706", "#7C3AED", "#DC2626", "#0891B2"];
  const value = String(seed || "profile");
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

function avatarMarkup(profile, sizeClass = "") {
  if (profile?.avatar_url) {
    return `<img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(profile.full_name || "User")}" class="wm-avatar-img ${sizeClass}" />`;
  }
  const label = profile?.full_name || profile?.email || "User";
  return `<span class="wm-avatar-initials ${sizeClass}" style="background:${getAvatarColor(label)}">${escapeHtml(getInitials(label))}</span>`;
}

function formatRelativeTime(value) {
  if (!value) return "";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
  if (diff < 60 * 1000) return "just now";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h`;
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))}d`;
  return new Date(value).toLocaleDateString();
}

function formatMessageTimestamp(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getConversationTitle(conversation) {
  if (!conversation) return "Conversation";
  if (conversation.title && String(conversation.title).trim()) {
    return String(conversation.title).trim();
  }

  const others = (conversation.participants || []).filter(
    (p) => p.user_id !== moduleState.user?.id
  );

  if (conversation.conversation_type === "direct") {
    return others[0]?.profile?.full_name || others[0]?.profile?.email || "Direct Message";
  }

  if (others.length === 0) return "Group Conversation";
  if (others.length <= 3) {
    return others
      .map((p) => p.profile?.full_name || p.profile?.email || "Member")
      .join(", ");
  }

  const preview = others
    .slice(0, 3)
    .map((p) => p.profile?.full_name || p.profile?.email || "Member")
    .join(", ");
  return `${preview} +${others.length - 3}`;
}

function getConversationSubtitle(conversation) {
  const last = conversation.last_message;
  if (!last) return "No messages yet.";
  const senderName =
    last.sender_id === moduleState.user?.id
      ? "You"
      : last.sender_profile?.full_name || "Coworker";
  return `${senderName}: ${String(last.content || "").trim()}`;
}

function setStatus(text = "", tone = "neutral") {
  const statusEl = moduleState.elements.status;
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.dataset.tone = tone;
}

function setLoadingConversations(isLoading) {
  const listEl = moduleState.elements.conversationList;
  if (!listEl) return;
  if (isLoading) {
    listEl.innerHTML = `<div class="wm-empty">Loading conversations...</div>`;
  }
}

function sortConversations() {
  moduleState.conversations.sort((a, b) => {
    const at = new Date(a.last_message?.created_at || a.updated_at || a.created_at || 0).getTime();
    const bt = new Date(b.last_message?.created_at || b.updated_at || b.created_at || 0).getTime();
    return bt - at;
  });
}

function renderConversationList() {
  const listEl = moduleState.elements.conversationList;
  if (!listEl) return;

  const query = moduleState.listSearch.toLowerCase().trim();
  const items = moduleState.conversations.filter((conversation) => {
    if (!query) return true;
    const title = getConversationTitle(conversation).toLowerCase();
    const subtitle = getConversationSubtitle(conversation).toLowerCase();
    return title.includes(query) || subtitle.includes(query);
  });

  if (items.length === 0) {
    listEl.innerHTML = `<div class="wm-empty">No conversations found.</div>`;
    return;
  }

  listEl.innerHTML = items
    .map((conversation) => {
      const isActive = conversation.id === moduleState.activeConversationId;
      const unread = Number(conversation.unread_count || 0);
      const others = (conversation.participants || []).filter((p) => p.user_id !== moduleState.user?.id);
      const primaryProfile = others[0]?.profile || moduleState.profile;
      return `
        <button class="wm-conversation-item ${isActive ? "active" : ""}" data-conversation-id="${conversation.id}" type="button">
          <div class="wm-conversation-avatar">
            ${avatarMarkup(primaryProfile)}
          </div>
          <div class="wm-conversation-content">
            <div class="wm-conversation-row">
              <span class="wm-conversation-title">${escapeHtml(getConversationTitle(conversation))}</span>
              <span class="wm-conversation-time">${escapeHtml(formatRelativeTime(conversation.last_message?.created_at || conversation.updated_at))}</span>
            </div>
            <div class="wm-conversation-row">
              <span class="wm-conversation-subtitle">${escapeHtml(getConversationSubtitle(conversation))}</span>
              ${unread > 0 ? `<span class="wm-unread-badge">${unread}</span>` : ""}
            </div>
          </div>
        </button>
      `;
    })
    .join("");

  listEl.querySelectorAll("[data-conversation-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const conversationId = button.getAttribute("data-conversation-id");
      if (!conversationId) return;
      await openConversation(conversationId);
    });
  });
}

function renderChatPlaceholder() {
  const pane = moduleState.elements.chatPane;
  if (!pane) return;
  pane.innerHTML = `
    <div class="wm-chat-placeholder">
      <div class="wm-chat-placeholder-icon">💬</div>
      <h3>Select a conversation</h3>
      <p>Start a new message or open an existing conversation to chat with coworkers.</p>
    </div>
  `;
}

function renderChatPane() {
  const pane = moduleState.elements.chatPane;
  if (!pane) return;

  const conversation = moduleState.conversations.find((c) => c.id === moduleState.activeConversationId);
  if (!conversation) {
    renderChatPlaceholder();
    return;
  }

  const messages = moduleState.messagesByConversation.get(conversation.id) || [];
  const title = getConversationTitle(conversation);
  const memberCount = conversation.participants?.length || 0;

  pane.innerHTML = `
    <div class="wm-chat-head">
      <div>
        <h3 class="wm-chat-title">${escapeHtml(title)}</h3>
        <p class="wm-chat-meta">${conversation.conversation_type === "group" ? `${memberCount} members` : "Direct conversation"}</p>
      </div>
    </div>
    <div class="wm-thread" data-thread></div>
    <form class="wm-composer" data-composer>
      <textarea class="wm-input" data-message-input rows="2" maxlength="5000" placeholder="Type your message..." ${moduleState.composerLocked ? "disabled" : ""}></textarea>
      <button class="btn primary wm-send-btn" type="submit" ${moduleState.composerLocked ? "disabled" : ""}>Send</button>
    </form>
  `;

  renderMessages(messages);

  const form = pane.querySelector("[data-composer]");
  const input = pane.querySelector("[data-message-input]");

  if (!form || !input) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (moduleState.composerLocked) return;
    const content = String(input.value || "").trim();
    if (!content) return;

    try {
      moduleState.composerLocked = true;
      form.classList.add("is-busy");
      input.disabled = true;
      const sendBtn = form.querySelector(".wm-send-btn");
      if (sendBtn) sendBtn.disabled = true;
      const sent = await sendConversationMessage({
        conversationId: conversation.id,
        senderId: moduleState.user.id,
        content,
      });
      const ownProfile = moduleState.profile;
      moduleState.profileCache.set(ownProfile.id, ownProfile);
      appendMessage({
        ...sent,
        sender_profile: ownProfile,
      });
      input.value = "";
      await markConversationRead(conversation.id, sent.created_at);
      setStatus("Message sent.", "success");
    } catch (error) {
      console.error("messages: send failed", error);
      setStatus(`Failed to send message: ${error.message || "Unknown error"}`, "error");
    } finally {
      moduleState.composerLocked = false;
      form.classList.remove("is-busy");
      input.disabled = false;
      input.focus();
      const sendBtn = form.querySelector(".wm-send-btn");
      if (sendBtn) sendBtn.disabled = false;
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
}

function renderMessages(messages) {
  const thread = moduleState.elements.chatPane?.querySelector("[data-thread]");
  if (!thread) return;

  if (!messages || messages.length === 0) {
    thread.innerHTML = `<div class="wm-empty-thread">No messages yet. Send the first message.</div>`;
    return;
  }

  thread.innerHTML = messages
    .map((msg) => {
      const isOwn = msg.sender_id === moduleState.user?.id;
      const profile = msg.sender_profile || moduleState.profileCache.get(msg.sender_id) || null;
      const senderName = isOwn ? "You" : profile?.full_name || "Coworker";
      return `
        <article class="wm-message ${isOwn ? "own" : ""}" data-message-id="${msg.id}">
          <div class="wm-message-avatar">${avatarMarkup(profile, "small")}</div>
          <div class="wm-message-body">
            <div class="wm-message-head">
              <span class="wm-message-sender">${escapeHtml(senderName)}</span>
              <time class="wm-message-time">${escapeHtml(formatMessageTimestamp(msg.created_at))}</time>
            </div>
            <p class="wm-message-content">${escapeHtml(msg.content || "")}</p>
          </div>
        </article>
      `;
    })
    .join("");

  thread.scrollTop = thread.scrollHeight;
}

function appendMessage(message) {
  const conversationId = message.conversation_id;
  if (!conversationId) return;

  const current = moduleState.messagesByConversation.get(conversationId) || [];
  if (current.some((m) => m.id === message.id)) return;

  const next = [...current, message];
  moduleState.messagesByConversation.set(conversationId, next);

  const conversation = moduleState.conversations.find((c) => c.id === conversationId);
  if (conversation) {
    conversation.last_message = message;
    conversation.updated_at = message.created_at || conversation.updated_at;
    if (conversationId !== moduleState.activeConversationId && message.sender_id !== moduleState.user.id) {
      conversation.unread_count = Number(conversation.unread_count || 0) + 1;
    }
  }

  sortConversations();
  renderConversationList();

  if (moduleState.activeConversationId === conversationId) {
    renderMessages(next);
  }
}

async function markConversationRead(conversationId, atIso) {
  await updateLastReadAt({
    conversationId,
    userId: moduleState.user.id,
    atIso: atIso || new Date().toISOString(),
  });

  const conversation = moduleState.conversations.find((item) => item.id === conversationId);
  if (conversation) {
    conversation.last_read_at = atIso || new Date().toISOString();
    conversation.unread_count = 0;
  }
  renderConversationList();
}

async function openConversation(conversationId) {
  if (!conversationId) return;
  moduleState.activeConversationId = conversationId;
  renderConversationList();

  try {
    setStatus("Loading messages...", "neutral");
    const messages = await loadConversationMessages(conversationId);
    messages.forEach((msg) => {
      if (msg.sender_profile?.id) {
        moduleState.profileCache.set(msg.sender_profile.id, msg.sender_profile);
      }
    });
    moduleState.messagesByConversation.set(conversationId, messages);
    renderChatPane();
    const newest = messages[messages.length - 1];
    await markConversationRead(conversationId, newest?.created_at || new Date().toISOString());
    setStatus("", "neutral");
  } catch (error) {
    console.error("messages: open conversation failed", error);
    setStatus(`Failed to load messages: ${error.message || "Unknown error"}`, "error");
  }
}

async function refreshConversations({ preserveActive = true } = {}) {
  setLoadingConversations(true);

  const conversations = await listUserConversations(moduleState.user.id);
  conversations.forEach((conversation) => {
    (conversation.participants || []).forEach((p) => {
      if (p.profile?.id) moduleState.profileCache.set(p.profile.id, p.profile);
    });
    if (conversation.last_message?.sender_profile?.id) {
      moduleState.profileCache.set(
        conversation.last_message.sender_profile.id,
        conversation.last_message.sender_profile
      );
    }
  });

  moduleState.conversations = conversations;
  sortConversations();

  if (!preserveActive || !moduleState.activeConversationId) {
    moduleState.activeConversationId = moduleState.conversations[0]?.id || null;
  } else if (!moduleState.conversations.find((c) => c.id === moduleState.activeConversationId)) {
    moduleState.activeConversationId = moduleState.conversations[0]?.id || null;
  }

  renderConversationList();
  if (moduleState.activeConversationId) {
    await openConversation(moduleState.activeConversationId);
  } else {
    renderChatPlaceholder();
  }
}

function renderEmployeeResults() {
  const list = moduleState.elements.newMessageResults;
  if (!list) return;
  const mode = moduleState.elements.newMessageMode?.value || "direct";
  const rows = moduleState.employees;

  if (rows.length === 0) {
    list.innerHTML = `<div class="wm-empty">No employees found.</div>`;
    return;
  }

  list.innerHTML = rows
    .map((employee) => {
      const selected = moduleState.selectedGroupMemberIds.has(employee.id);
      return `
        <button class="wm-employee-item ${selected ? "selected" : ""}" type="button" data-employee-id="${employee.id}">
          <div class="wm-employee-avatar">${avatarMarkup(employee, "small")}</div>
          <div class="wm-employee-meta">
            <strong>${escapeHtml(employee.full_name || employee.email || "Coworker")}</strong>
            <span>${escapeHtml(employee.department || "No department")}</span>
          </div>
          ${mode === "group" ? `<span class="wm-employee-check">${selected ? "✓" : ""}</span>` : ""}
        </button>
      `;
    })
    .join("");

  list.querySelectorAll("[data-employee-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const employeeId = button.getAttribute("data-employee-id");
      if (!employeeId) return;

      const currentMode = moduleState.elements.newMessageMode?.value || "direct";
      if (currentMode === "direct") {
        await startDirectConversation(employeeId);
        return;
      }

      if (moduleState.selectedGroupMemberIds.has(employeeId)) {
        moduleState.selectedGroupMemberIds.delete(employeeId);
      } else {
        moduleState.selectedGroupMemberIds.add(employeeId);
      }
      renderEmployeeResults();
      syncGroupCreateState();
    });
  });
}

function syncGroupCreateState() {
  const createButton = moduleState.elements.newMessageCreateGroup;
  if (!createButton) return;
  const groupName = String(moduleState.elements.newMessageGroupName?.value || "").trim();
  createButton.disabled = moduleState.selectedGroupMemberIds.size < 2 || !groupName;
}

async function loadEmployees(searchText = "") {
  moduleState.employees = await searchEmployees({
    currentUserId: moduleState.user.id,
    searchText,
    limit: 40,
  });
  moduleState.employees.forEach((employee) => {
    moduleState.profileCache.set(employee.id, employee);
  });
  renderEmployeeResults();
}

function closeNewMessageModal() {
  const modal = moduleState.elements.newMessageModal;
  if (!modal) return;
  modal.classList.remove("open");
}

async function startDirectConversation(employeeId) {
  try {
    setStatus("Opening direct conversation...", "neutral");
    const conversationId = await getOrCreateDirectConversation({
      currentUserId: moduleState.user.id,
      peerUserId: employeeId,
    });
    closeNewMessageModal();
    await refreshConversations({ preserveActive: true });
    await openConversation(conversationId);
    setStatus("", "neutral");
  } catch (error) {
    console.error("messages: direct conversation failed", error);
    setStatus(`Unable to start conversation: ${error.message || "Unknown error"}`, "error");
  }
}

async function startGroupConversation() {
  const title = String(moduleState.elements.newMessageGroupName?.value || "").trim();
  try {
    setStatus("Creating group conversation...", "neutral");
    const conversationId = await createGroupConversation({
      currentUserId: moduleState.user.id,
      title,
      memberIds: Array.from(moduleState.selectedGroupMemberIds),
    });
    closeNewMessageModal();
    await refreshConversations({ preserveActive: true });
    await openConversation(conversationId);
    setStatus("Group conversation created.", "success");
  } catch (error) {
    console.error("messages: group conversation failed", error);
    setStatus(`Unable to create group: ${error.message || "Unknown error"}`, "error");
  }
}

function wireNewMessageModal() {
  const modal = moduleState.elements.newMessageModal;
  if (!modal) return;

  moduleState.elements.newMessageOpen?.addEventListener("click", async () => {
    try {
      moduleState.selectedGroupMemberIds.clear();
      moduleState.elements.newMessageGroupName.value = "";
      moduleState.elements.newMessageSearch.value = "";
      modal.classList.add("open");
      moduleState.elements.newMessageMode.value = "direct";
      moduleState.elements.newMessageGroupFields.classList.add("hidden");
      await loadEmployees("");
      syncGroupCreateState();
      moduleState.elements.newMessageSearch.focus();
    } catch (error) {
      console.error("messages: failed to open new message modal", error);
      setStatus(`Unable to load employee list: ${error.message || "Unknown error"}`, "error");
    }
  });

  moduleState.elements.newMessageClose?.addEventListener("click", () => closeNewMessageModal());

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeNewMessageModal();
  });

  moduleState.elements.newMessageMode?.addEventListener("change", () => {
    const mode = moduleState.elements.newMessageMode.value;
    if (mode === "group") {
      moduleState.elements.newMessageGroupFields.classList.remove("hidden");
    } else {
      moduleState.selectedGroupMemberIds.clear();
      moduleState.elements.newMessageGroupFields.classList.add("hidden");
    }
    renderEmployeeResults();
    syncGroupCreateState();
  });

  moduleState.elements.newMessageSearch?.addEventListener("input", async (event) => {
    const text = event.target.value || "";
    try {
      await loadEmployees(text);
    } catch (error) {
      console.error("messages: employee search failed", error);
      setStatus(`Employee search failed: ${error.message || "Unknown error"}`, "error");
    }
  });

  moduleState.elements.newMessageGroupName?.addEventListener("input", () => {
    syncGroupCreateState();
  });

  moduleState.elements.newMessageCreateGroup?.addEventListener("click", async () => {
    await startGroupConversation();
  });
}

function wireConversationSearch() {
  moduleState.elements.search?.addEventListener("input", (event) => {
    moduleState.listSearch = String(event.target.value || "");
    renderConversationList();
  });
}

function attachRealtime() {
  if (moduleState.unsubscribeRealtime) {
    moduleState.unsubscribeRealtime();
    moduleState.unsubscribeRealtime = null;
  }

  moduleState.unsubscribeRealtime = subscribeToMessagingRealtime({
    userId: moduleState.user.id,
    onMessageInsert: async (message) => {
      if (!message?.id || !message?.conversation_id) return;

      const senderId = message.sender_id;
      if (senderId && !moduleState.profileCache.has(senderId)) {
        try {
          const profile = await getProfileSummary(senderId);
          if (profile?.id) moduleState.profileCache.set(profile.id, profile);
        } catch (error) {
          console.error("messages: sender profile lookup failed", error);
        }
      }

      const withProfile = {
        ...message,
        sender_profile: moduleState.profileCache.get(senderId) || null,
      };

      const knownConversation = moduleState.conversations.find(
        (conversation) => conversation.id === withProfile.conversation_id
      );

      if (!knownConversation) {
        try {
          await refreshConversations({ preserveActive: true });
        } catch (error) {
          console.error("messages: refresh failed after unknown conversation message", error);
        }
        return;
      }

      appendMessage(withProfile);

      if (
        withProfile.conversation_id === moduleState.activeConversationId &&
        withProfile.sender_id !== moduleState.user.id
      ) {
        try {
          await markConversationRead(withProfile.conversation_id, withProfile.created_at);
        } catch (error) {
          console.error("messages: mark read failed", error);
        }
      }
    },
    onConversationChange: async () => {
      try {
        await refreshConversations({ preserveActive: true });
      } catch (error) {
        console.error("messages: conversation refresh failed", error);
      }
    },
    onParticipantChange: async () => {
      try {
        await refreshConversations({ preserveActive: true });
      } catch (error) {
        console.error("messages: participant refresh failed", error);
      }
    },
  });
}

function renderShell(root) {
  root.innerHTML = `
    <section class="wm-shell">
      <div class="wm-toolbar">
        <div class="wm-search-wrap">
          <span class="wm-search-icon">🔎</span>
          <input class="wm-search" data-wm-search type="search" placeholder="Search conversations..." />
        </div>
        <button class="btn primary" type="button" data-wm-new-message>+ New Message</button>
      </div>
      <div class="wm-layout">
        <aside class="wm-sidebar">
          <div class="wm-list" data-wm-conversation-list></div>
        </aside>
        <section class="wm-chat" data-wm-chat-pane></section>
      </div>
      <div class="wm-status" data-wm-status aria-live="polite"></div>
    </section>

    <div class="wm-modal" data-wm-modal>
      <div class="wm-modal-card">
        <div class="wm-modal-head">
          <h3>New Message</h3>
          <button type="button" class="btn ghost" data-wm-close-modal>Close</button>
        </div>
        <div class="wm-modal-controls">
          <label class="wm-label">
            Type
            <select data-wm-mode class="wm-select">
              <option value="direct">Direct</option>
              <option value="group">Group</option>
            </select>
          </label>
          <label class="wm-label wm-grow">
            Find coworker
            <input type="search" data-wm-employee-search class="wm-input-inline" placeholder="Name, email, or department..." />
          </label>
        </div>
        <div class="wm-group-fields hidden" data-wm-group-fields>
          <label class="wm-label wm-grow">
            Group name
            <input type="text" data-wm-group-name class="wm-input-inline" placeholder="Shift Handover Team" maxlength="120" />
          </label>
          <button type="button" class="btn primary" data-wm-create-group disabled>Create Group</button>
        </div>
        <div class="wm-employee-list" data-wm-employee-list></div>
      </div>
    </div>
  `;

  moduleState.elements = {
    search: root.querySelector("[data-wm-search]"),
    conversationList: root.querySelector("[data-wm-conversation-list]"),
    chatPane: root.querySelector("[data-wm-chat-pane]"),
    status: root.querySelector("[data-wm-status]"),
    newMessageOpen: root.querySelector("[data-wm-new-message]"),
    newMessageModal: root.querySelector("[data-wm-modal]"),
    newMessageClose: root.querySelector("[data-wm-close-modal]"),
    newMessageMode: root.querySelector("[data-wm-mode]"),
    newMessageSearch: root.querySelector("[data-wm-employee-search]"),
    newMessageResults: root.querySelector("[data-wm-employee-list]"),
    newMessageGroupFields: root.querySelector("[data-wm-group-fields]"),
    newMessageGroupName: root.querySelector("[data-wm-group-name]"),
    newMessageCreateGroup: root.querySelector("[data-wm-create-group]"),
  };
}

export async function initMessagesPanel() {
  const root = document.querySelector("[data-messages-root]");
  if (!root) return;
  if (moduleState.initialized) return;
  moduleState.initialized = true;

  try {
    renderShell(root);
    wireConversationSearch();
    wireNewMessageModal();
    setStatus("Loading messaging workspace...", "neutral");

    const identity = await getCurrentMessagingIdentity();
    moduleState.user = identity.user;
    moduleState.profile = identity.profile;
    moduleState.profileCache.set(identity.profile.id, identity.profile);

    await refreshConversations({ preserveActive: false });
    attachRealtime();
    setStatus("", "neutral");
  } catch (error) {
    moduleState.initialized = false;
    console.error("messages: init failed", error);
    root.innerHTML = `
      <div class="wm-empty">
        Messaging failed to initialize.<br />
        <span class="muted">${escapeHtml(error.message || "Unknown error")}</span>
      </div>
    `;
  }
}
