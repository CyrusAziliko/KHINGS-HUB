export function initUserModal() {
  // No Supabase/auth changes in Phase 3.2
  // This modal is purely UI wiring: it listens for the open event and renders a placeholder container.

  const EVENT_NAME = "open-create-user-modal";

  const ensureModalContainer = () => {
    let host = document.getElementById("user-modal-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "user-modal-host";
      document.body.appendChild(host);
    }
    return host;
  };

  const closeModal = () => {
    const host = document.getElementById("user-modal-host");
    if (host) host.innerHTML = "";

    const openBtn = document.getElementById("refresh-users-btn");
    if (openBtn) openBtn.focus();
  };

  const renderCreateUserModal = () => {
    const host = ensureModalContainer();
    host.innerHTML = `
      <div class="user-modal-overlay" role="presentation" data-user-modal-overlay>
        <div class="user-modal" role="dialog" aria-modal="true" aria-label="Create user">
          <div class="user-modal-header">
            <h3>Create User</h3>
            <button type="button" class="user-modal-close" aria-label="Close" data-user-modal-close>✕</button>
          </div>

          <div class="user-modal-body">
            <div class="user-modal-placeholder">
              Create User module is available in Phase 3.2.
            </div>
          </div>

          <div class="user-modal-footer">
            <button type="button" class="user-modal-btn" disabled>Save</button>
            <button type="button" class="user-modal-btn ghost" data-user-modal-cancel>Cancel</button>
          </div>
        </div>
      </div>
    `;

    // wire close actions
    const overlay = host.querySelector("[data-user-modal-overlay]");
    const closeBtn = host.querySelector("[data-user-modal-close]");
    const cancelBtn = host.querySelector("[data-user-modal-cancel]");

    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
      });
    }
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    // ESC close
    const escHandler = (e) => {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", escHandler);
        closeModal();
      }
    };
    document.addEventListener("keydown", escHandler);
  };

  document.addEventListener(EVENT_NAME, () => {
    renderCreateUserModal();
  });
}

