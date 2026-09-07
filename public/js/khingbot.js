const CHATBOT_URL = "https://khingschatbot-main.vercel.app/";

export function initKhingBotPage() {
  // --- Always render inline panel into [data-khingbot-root] ---
  const root = document.querySelector("[data-khingbot-root]");
  if (root && !root.querySelector(".chatbot-container")) {
    root.innerHTML = `
      <div class="chatbot-container card glass">
        <div class="chatbot-header">
          <div class="chatbot-header-info">
            <h2 class="chatbot-title">🤖 KHINGBot</h2>
            <p class="chatbot-subtitle muted">AI Assistant for KHING's Hub</p>
          </div>
          <div class="chatbot-actions">
            <button class="chatbot-btn chatbot-btn-refresh" title="Refresh Chatbot">🔄 Refresh</button>
          </div>
        </div>
        <div class="chatbot-body">
          <div class="chatbot-loading" id="chatbot-loading-fallback">
            <div class="chatbot-spinner"></div>
            <p>Loading KHINGBot assistant...</p>
          </div>
          <iframe
            class="chatbot-frame"
            src="${CHATBOT_URL}"
            title="KHINGBot Assistant"
            allow="microphone; camera"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          ></iframe>
          <div class="chatbot-error hidden" id="chatbot-error-fallback">
            <div class="chatbot-error-icon">⚠️</div>
            <h3>Unable to load KHINGBot</h3>
            <p>The assistant could not be loaded. Please check your internet connection and try again.</p>
            <button class="chatbot-btn chatbot-btn-retry" id="chatbot-retry-fallback">Try Again</button>
          </div>
        </div>
      </div>
    `;

    // Wire up inline panel controls
    const iframe = root.querySelector(".chatbot-frame");
    const loading = document.getElementById("chatbot-loading-fallback");
    const errorEl = document.getElementById("chatbot-error-fallback");

    iframe.addEventListener("load", () => {
      loading?.classList.add("hidden");
      errorEl?.classList.add("hidden");
    });

    iframe.addEventListener("error", () => {
      loading?.classList.add("hidden");
      errorEl?.classList.remove("hidden");
    });

    root.querySelector(".chatbot-btn-refresh")?.addEventListener("click", () => {
      loading?.classList.remove("hidden");
      errorEl?.classList.add("hidden");
      iframe.src = CHATBOT_URL;
    });


    document.getElementById("chatbot-retry-fallback")?.addEventListener("click", () => {
      loading?.classList.remove("hidden");
      errorEl?.classList.add("hidden");
      iframe.src = CHATBOT_URL;
    });
  }

  // --- Modal (FAB) setup (only if FAB/modal elements exist) ---
  const fab = document.getElementById("khingbot-fab");
  const modal = document.getElementById("khingbot-modal");
  const closeBtn = document.getElementById("khingbot-close");
  const minimizeBtn = document.getElementById("khingbot-minimize");
  const windowBox = modal?.querySelector(".khingbot-window");
  const header = windowBox?.querySelector(".khingbot-header");

  if (!fab || !modal || !closeBtn || !minimizeBtn || !windowBox || !header) return;

  // Ensure modal iframe always points to the live KHINGBot URL and is visible.
  const modalIframe = modal.querySelector("iframe");
  if (modalIframe) {
    modalIframe.src = CHATBOT_URL;
    modalIframe.classList.remove("hidden");
  }

  const open = () => {
    if (!windowBox.style.left && !windowBox.style.top) {
      windowBox.style.right = "20px";
      windowBox.style.bottom = "20px";
      windowBox.style.left = "auto";
      windowBox.style.top = "auto";
      windowBox.style.position = "fixed";
    }
    modal.classList.remove("hidden");
  };

  const close = () => {
    modal.classList.add("hidden");
  };

  const minimize = () => {
    const isMinimized = windowBox.dataset.minimized === "true";

    if (isMinimized) {
      windowBox.dataset.minimized = "false";
      windowBox.style.width = "420px";
      windowBox.style.height = "600px";
      windowBox.style.maxWidth = "calc(100vw - 24px)";
      windowBox.style.maxHeight = "calc(100vh - 24px)";
      modal.classList.remove("hidden");
    } else {
      windowBox.dataset.minimized = "true";
      windowBox.style.width = "210px";
      windowBox.style.height = "54px";
      windowBox.style.maxWidth = "210px";
      windowBox.style.maxHeight = "54px";
      windowBox.style.overflow = "hidden";
      modal.classList.remove("hidden");
    }
  };

  fab.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  minimizeBtn.addEventListener("click", minimize);

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  header.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("button, a, input, textarea, select")) return;
    if (windowBox.dataset.minimized === "true") return;

    const rect = windowBox.getBoundingClientRect();
    isDragging = true;
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    windowBox.style.left = `${rect.left}px`;
    windowBox.style.top = `${rect.top}px`;
    windowBox.style.right = "auto";
    windowBox.style.bottom = "auto";
    windowBox.style.position = "fixed";
    header.setPointerCapture(e.pointerId);
  });

  header.addEventListener("pointermove", (e) => {
    if (!isDragging) return;

    const boxRect = windowBox.getBoundingClientRect();
    const maxX = Math.max(0, window.innerWidth - boxRect.width);
    const maxY = Math.max(0, window.innerHeight - boxRect.height);
    const nextX = Math.min(Math.max(0, e.clientX - offsetX), maxX);
    const nextY = Math.min(Math.max(0, e.clientY - offsetY), maxY);

    windowBox.style.left = `${nextX}px`;
    windowBox.style.top = `${nextY}px`;
  });

  header.addEventListener("pointerup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    header.releasePointerCapture(e.pointerId);
  });

  header.addEventListener("pointercancel", (e) => {
    if (!isDragging) return;
    isDragging = false;
    header.releasePointerCapture(e.pointerId);
  });

  // Allow buttons on pages to open the same modal.
  document
    .querySelectorAll("[data-open-khingbot-modal]")
    .forEach((btn) => btn.addEventListener("click", open));

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  // Close on ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}
