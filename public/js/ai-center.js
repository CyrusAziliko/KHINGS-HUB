(function () {
  const STORAGE_KEY = "khing_ai_center_session_v1";

  const chatLog = document.getElementById("ai-chat-log");
  const chatForm = document.getElementById("ai-chat-form");
  const chatInput = document.getElementById("ai-chat-input");
  const attachBtn = document.getElementById("ai-attach-btn");
  const micBtn = document.getElementById("ai-mic-btn");
  const clearBtn = document.getElementById("ai-clear-session");
  const inlineStatus = document.getElementById("ai-inline-status");
  const chips = Array.from(document.querySelectorAll(".ai-chip"));

  const quickPrompts = {
    tickets: "Show me my most urgent ticket priorities for today.",
    equipment: "Give me a quick equipment readiness checklist for this shift.",
    safety: "What safety checks should I complete before starting work?",
    reports: "Help me summarize today’s operational report highlights.",
    policies: "Remind me of key policies for incident reporting.",
    profile: "What profile details should I keep updated for operations?"
  };

  const deterministicReplies = [
    "Acknowledged. Start with high-priority tasks first, then clear medium items before shift close.",
    "Recommended sequence: verify safety status, confirm equipment readiness, then update reports.",
    "I suggest documenting critical actions immediately to keep team visibility accurate.",
    "Use a quick triage flow: assess risk, assign owner, set due time, and track completion.",
    "For best outcomes, focus on safety compliance and overdue operational blockers first."
  ];

  let messages = [];

  function safeNowTime() {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function showInlineStatus(text) {
    if (!inlineStatus) return;
    inlineStatus.textContent = text;
    if (!text) return;
    window.setTimeout(() => {
      if (inlineStatus.textContent === text) inlineStatus.textContent = "";
    }, 1800);
  }

  function scrollToBottom() {
    if (!chatLog) return;
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function persistMessages() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (_) {}
  }

  function loadMessages() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string");
    } catch (_) {
      return [];
    }
  }

  function createMessageNode(msg) {
    const wrap = document.createElement("div");
    wrap.className = `ai-message ${msg.role}`;

    const text = document.createElement("div");
    text.textContent = msg.text;
    wrap.appendChild(text);

    const meta = document.createElement("div");
    meta.className = "ai-message-meta";
    meta.textContent = `${msg.role === "user" ? "You" : "AI Assistant"} • ${msg.time || safeNowTime()}`;
    wrap.appendChild(meta);

    return wrap;
  }

  function render() {
    if (!chatLog) return;
    chatLog.innerHTML = "";

    if (messages.length === 0) {
      const welcome = document.createElement("div");
      welcome.className = "ai-welcome";
      welcome.textContent =
        "Welcome to KHING'S HUB AI Center. Ask about tickets, equipment, safety, reports, policies, or your profile.";
      chatLog.appendChild(welcome);
      scrollToBottom();
      return;
    }

    for (const msg of messages) {
      chatLog.appendChild(createMessageNode(msg));
    }

    scrollToBottom();
  }

  function deterministicReplyFor(userText) {
    const input = String(userText || "").toLowerCase();

    if (input.includes("ticket")) {
      return "Tickets focus:\n• Review critical and overdue tickets first\n• Confirm ownership and due time\n• Escalate blockers affecting operations";
    }
    if (input.includes("equipment")) {
      return "Equipment focus:\n• Check pre-shift inspection logs\n• Flag unavailable assets immediately\n• Prioritize maintenance for high-use machines";
    }
    if (input.includes("safety")) {
      return "Safety focus:\n• Complete PPE and hazard checks\n• Verify incident channels are clear\n• Report near-misses before shift close";
    }
    if (input.includes("report")) {
      return "Reports focus:\n• Capture key metrics and exceptions\n• Summarize completed vs pending actions\n• Highlight risks needing supervisor review";
    }
    if (input.includes("polic")) {
      return "Policy focus:\n• Follow incident reporting timelines\n• Maintain accurate operational records\n• Ensure escalation paths are respected";
    }
    if (input.includes("profile")) {
      return "Profile focus:\n• Keep contact and role details current\n• Verify team/department mapping\n• Update availability for scheduling accuracy";
    }

    let sum = 0;
    for (let i = 0; i < input.length; i += 1) sum += input.charCodeAt(i);
    return deterministicReplies[sum % deterministicReplies.length];
  }

  function addMessage(role, text) {
    messages.push({
      role,
      text,
      time: safeNowTime()
    });
    persistMessages();
    render();
  }

  function handleSend(rawText) {
    const text = String(rawText || "").trim();
    if (!text) return;

    addMessage("user", text);

    window.setTimeout(() => {
      const reply = deterministicReplyFor(text);
      addMessage("assistant", reply);
    }, 180);
  }

  function setupEvents() {
    if (chatForm) {
      chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = chatInput ? chatInput.value : "";
        handleSend(text);
        if (chatInput) {
          chatInput.value = "";
          chatInput.focus();
        }
      });
    }

    if (chatInput) {
      chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (chatForm) chatForm.requestSubmit();
        }
      });
    }

    for (const chip of chips) {
      chip.addEventListener("click", () => {
        const key = chip.getAttribute("data-prompt") || "";
        const prompt = quickPrompts[key];
        if (!prompt) return;
        if (chatInput) chatInput.value = prompt;
        handleSend(prompt);
        if (chatInput) {
          chatInput.value = "";
          chatInput.focus();
        }
      });
    }

    if (attachBtn) {
      attachBtn.addEventListener("click", () => {
        showInlineStatus("Attachment upload will be available in AI-1.2.");
      });
    }

    if (micBtn) {
      micBtn.addEventListener("click", () => {
        showInlineStatus("Voice input will be available in AI-1.2.");
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        messages = [];
        persistMessages();
        render();
        showInlineStatus("Session cleared.");
      });
    }
  }

  function init() {
    messages = loadMessages();
    render();
    setupEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
