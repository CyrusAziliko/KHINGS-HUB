const CHATBOT_URL = "https://khingschatbot-main.vercel.app/";

export async function loadKhingbotModule() {
  console.log("Loading KHINGBot module");

  const panel = document.querySelector('[data-view-panel="khingbot"]');
  if (!panel) {
    console.error("KHINGBot panel missing");
    return;
  }

  // Check if already initialized to avoid duplicate renders
  if (panel.querySelector(".chatbot-container")) {
    console.log("KHINGBot already initialized");
    return;
  }

  panel.innerHTML = `
    <div class="chatbot-container card glass">
      <div class="chatbot-header">
        <div class="chatbot-header-info">
          <h2 class="chatbot-title">🤖 KHINGBot</h2>
          <p class="chatbot-subtitle muted">AI Assistant for KHING's Hub</p>
        </div>
        <div class="chatbot-actions">
          <button class="chatbot-btn chatbot-btn-refresh" title="Refresh Chatbot" aria-label="Refresh Chatbot">
            🔄 Refresh
          </button>
        </div>
      </div>
      <div class="chatbot-body">
        <div class="chatbot-loading" id="chatbot-loading">
          <div class="chatbot-spinner"></div>
          <p>Loading KHINGBot assistant...</p>
        </div>
        <iframe
          class="chatbot-frame"
          id="chatbot-frame"
          src="${CHATBOT_URL}"
          title="KHINGBot Assistant"
          allow="microphone; camera"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        ></iframe>
        <div class="chatbot-error hidden" id="chatbot-error">
          <div class="chatbot-error-icon">⚠️</div>
          <h3>Unable to load KHINGBot</h3>
          <p>The assistant could not be loaded. Please check your internet connection and try again.</p>
          <button class="chatbot-btn chatbot-btn-retry" id="chatbot-retry">Try Again</button>
        </div>
      </div>
    </div>
  `;

  const iframe = document.getElementById("chatbot-frame");
  const loading = document.getElementById("chatbot-loading");
  const errorEl = document.getElementById("chatbot-error");
  const refreshBtn = panel.querySelector(".chatbot-btn-refresh");
  const retryBtn = document.getElementById("chatbot-retry");

  // Iframe load success
  iframe.addEventListener("load", () => {
    loading.classList.add("hidden");
    errorEl.classList.add("hidden");
    console.log("KHINGBot iframe loaded successfully");
  });

  // Iframe load error (fallback detection)
  iframe.addEventListener("error", () => {
    loading.classList.add("hidden");
    errorEl.classList.remove("hidden");
    console.error("KHINGBot iframe failed to load");
  });

  // Timeout fallback: if iframe doesn't load within 15 seconds, show error
  let loadTimeout = setTimeout(() => {
    if (!loading.classList.contains("hidden")) {
      loading.classList.add("hidden");
      errorEl.classList.remove("hidden");
      console.warn("KHINGBot iframe load timeout");
    }
  }, 15000);

  // Clear timeout on successful load
  iframe.addEventListener("load", () => {
    clearTimeout(loadTimeout);
  });

  // Refresh button: reload iframe
  refreshBtn.addEventListener("click", () => {
    loading.classList.remove("hidden");
    errorEl.classList.add("hidden");
    iframe.src = CHATBOT_URL;
    // Reset timeout
    clearTimeout(loadTimeout);
    loadTimeout = setTimeout(() => {
      if (!loading.classList.contains("hidden")) {
        loading.classList.add("hidden");
        errorEl.classList.remove("hidden");
      }
    }, 15000);
  });

  // Retry button
  retryBtn.addEventListener("click", () => {
    loading.classList.remove("hidden");
    errorEl.classList.add("hidden");
    iframe.src = CHATBOT_URL;
    clearTimeout(loadTimeout);
    loadTimeout = setTimeout(() => {
      if (!loading.classList.contains("hidden")) {
        loading.classList.add("hidden");
        errorEl.classList.remove("hidden");
      }
    }, 15000);
  });

  console.log("KHINGBot module loaded successfully");
}

