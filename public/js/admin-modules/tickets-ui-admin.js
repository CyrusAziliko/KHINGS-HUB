import { supabase } from "../supabaseClient.js";
import {
  loadTicketList,
  getAdmins,
  loadTicketDetails,
  assignTicket,
  changeStatus,
  sendMessage,
  loadConversation,
  normalizeStatusForDisplay,
} from "../services/ticketService-exports.js";

// ─── Helpers ─────────────────────────────────────

function safeText(v, fallback = "") {
  return String(v ?? fallback);
}

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return safeText(iso);
  return d.toLocaleString();
}

function priorityClass(prio) {
  const s = safeText(prio).trim().toLowerCase();
  if (s === "critical") return "tix-pri tix-pri--critical";
  if (s === "high") return "tix-pri tix-pri--high";
  if (s === "medium") return "tix-pri tix-pri--medium";
  return "tix-pri tix-pri--low";
}

function priorityLabel(prio) {
  return safeText(prio) || "—";
}

function statusClass(st) {
  const s = safeText(st).trim().toLowerCase();
  if (s === "open") return "tix-st tix-st--open";
  if (s === "in progress" || s === "in_progress" || s === "in-progress") return "tix-st tix-st--progress";
  if (s === "resolved") return "tix-st tix-st--resolved";
  if (s === "closed") return "tix-st tix-st--closed";
  return "tix-st tix-st--open";
}

function statusLabel(st) {
  return normalizeStatusForDisplay(st) || "Open";
}

// ─── Hero ─────────────────────────────────────────

function buildHero() {
  return `
    <div class="tix-hero">
      <div class="tix-hero-row">
        <div class="tix-hero-left">
          <span class="tix-hero-icon" aria-hidden="true">🎫</span>
          <div>
            <h2 class="tix-hero-title">Ticket Operations Center</h2>
            <p class="tix-hero-sub">Manage support tickets, assignments, and resolution tracking.</p>
          </div>
        </div>
        <div class="tix-hero-right">
          <span class="tix-hero-badge">
            <span class="tix-hero-dot" aria-hidden="true"></span>
            Live
          </span>
        </div>
      </div>
    </div>`;
}

// ─── Stats Bar ────────────────────────────────────

function buildStats(stats) {
  return `
    <div class="tix-stats">
      <div class="tix-stat-item">
        <span class="tix-stat-num">${stats.total}</span>
        <span class="tix-stat-lbl">Total Tickets</span>
      </div>
      <div class="tix-stat-div" aria-hidden="true"></div>
      <div class="tix-stat-item">
        <span class="tix-stat-num tix-stat-num--open">${stats.open}</span>
        <span class="tix-stat-lbl">Open</span>
      </div>
      <div class="tix-stat-div" aria-hidden="true"></div>
      <div class="tix-stat-item">
        <span class="tix-stat-num tix-stat-num--progress">${stats.inProgress}</span>
        <span class="tix-stat-lbl">In Progress</span>
      </div>
      <div class="tix-stat-div" aria-hidden="true"></div>
      <div class="tix-stat-item">
        <span class="tix-stat-num tix-stat-num--done">${stats.resolved}</span>
        <span class="tix-stat-lbl">Resolved</span>
      </div>
    </div>`;
}

// ─── Toolbar ──────────────────────────────────────

function buildToolbar() {
  return `
    <div class="tix-bar">
      <div class="tix-bar-left">
        <div class="tix-search-wrap">
          <span class="tix-search-ico" aria-hidden="true">🔍</span>
          <input type="search" id="tix-q" class="tix-search" placeholder="Search title, category, or number..." aria-label="Search tickets" />
        </div>
        <select id="tix-sf" class="tix-pick" aria-label="Filter status">
          <option value="">All Status</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>
        <select id="tix-pf" class="tix-pick" aria-label="Filter priority">
          <option value="">All Priority</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>
      </div>
      <div class="tix-bar-right">
        <button type="button" id="tix-refresh" class="tix-action" aria-label="Refresh">⟳ Refresh</button>
      </div>
    </div>`;
}

// ─── Ticket Card ──────────────────────────────────

function buildCard(t) {
  const id = safeText(t.id);
  const num = safeText(t.ticket_number, "#" + id.slice(0, 8));
  const title = safeText(t.title, "Untitled");
  const cat = safeText(t.category, "General");
  const prio = priorityLabel(t.priority);
  const prioC = priorityClass(t.priority);
  const stC = statusClass(t.status);
  const stL = statusLabel(t.status);
  const worker = safeText(t.worker_id, "—");
  const admin = safeText(t.assigned_admin, "Unassigned");
  const created = formatTime(t.created_at);

  return `
    <div class="tix-card" data-id="${id}">
      <div class="tix-card-top">
        <div class="tix-card-left">
          <span class="tix-card-num">${num}</span>
          <div class="tix-card-title">${title}</div>
        </div>
        <div class="tix-card-right">
          <span class="${stC}">${stL}</span>
          <span class="${prioC}">${prio}</span>
        </div>
      </div>
      <div class="tix-card-meta">
        <span>📂 ${cat}</span>
        <span>👤 Worker: ${worker}</span>
        <span>👑 Admin: ${admin}</span>
        <span>🕐 ${created}</span>
      </div>
    </div>`;
}

function buildCardList(tickets) {
  if (!tickets || tickets.length === 0) {
    return `
      <div class="tix-panel">
        <div class="tix-panel-head">
          <h3 class="tix-panel-title">Ticket Queue</h3>
          <span class="tix-chip">0</span>
        </div>
        <div class="tix-null">
          <div class="tix-null-ico" aria-hidden="true">🎫</div>
          <h3>No tickets found</h3>
          <p>Try different filter criteria.</p>
        </div>
      </div>`;
  }

  return `
    <div class="tix-panel">
      <div class="tix-panel-head">
        <h3 class="tix-panel-title">Ticket Queue</h3>
        <span class="tix-chip">${tickets.length}</span>
      </div>
      <div class="tix-list">
        ${tickets.map(buildCard).join("")}
      </div>
    </div>`;
}

// ─── Detail Modal ─────────────────────────────────

function buildDetailModalHTML() {
  return `
    <div id="tix-modal" class="tix-modal" style="display:none">
      <div class="tix-modal-bg" data-tix-close aria-hidden="true"></div>
      <div class="tix-modal-body">
        <div class="tix-modal-head">
          <h3 class="tix-modal-title">Ticket Details</h3>
          <button type="button" class="tix-modal-close" data-tix-close aria-label="Close">✕</button>
        </div>
        <div id="tix-modal-content" class="tix-modal-content"></div>
      </div>
    </div>`;
}

function buildDetailContent(ticket) {
  const num = safeText(ticket.ticket_number, "#" + safeText(ticket.id).slice(0, 8));
  const title = safeText(ticket.title, "Untitled");
  const desc = safeText(ticket.description, "No description.");
  const cat = safeText(ticket.category, "General");
  const prio = priorityLabel(ticket.priority);
  const prioC = priorityClass(ticket.priority);
  const stC = statusClass(ticket.status);
  const stL = statusLabel(ticket.status);
  const worker = safeText(ticket.worker_id, "—");
  const admin = safeText(ticket.assigned_admin, "Unassigned");
  const created = formatTime(ticket.created_at);
  const updated = formatTime(ticket.updated_at);

  return `
    <div class="tix-detail-layout">
      <div class="tix-detail-info">
        <div class="tix-detail-head">
          <span class="tix-detail-num">${num}</span>
          <div class="tix-detail-acts">
            <span class="${prioC}">${prio}</span>
            <span class="${stC}">${stL}</span>
          </div>
        </div>
        <h3 class="tix-detail-title">${title}</h3>
        <div class="tix-detail-desc">${desc}</div>
        <div class="tix-detail-grid">
          <div class="tix-detail-i"><span>Category</span><strong>${cat}</strong></div>
          <div class="tix-detail-i"><span>Worker</span><strong>${worker}</strong></div>
          <div class="tix-detail-i"><span>Assigned Admin</span><strong>${admin}</strong></div>
          <div class="tix-detail-i"><span>Created</span><strong>${created}</strong></div>
          <div class="tix-detail-i"><span>Updated</span><strong>${updated}</strong></div>
          <div class="tix-detail-i"><span>Ticket ID</span><strong>${safeText(ticket.id)}</strong></div>
        </div>
      </div>

      <div class="tix-detail-chat">
        <div class="tix-chat-head">💬 Conversation</div>
        <div id="tix-chat-box" class="tix-chat-box"></div>
        <div class="tix-chat-input-row">
          <div class="tix-chat-input-wrap">
            <textarea id="tix-msg-input" class="tix-chat-input" placeholder="Write a message..." rows="2"></textarea>
            <label class="tix-chat-file" aria-label="Attach file">
              📎
              <input type="file" id="tix-msg-file" hidden />
            </label>
          </div>
          <button type="button" id="tix-msg-send" class="tix-chat-send">Send</button>
        </div>
      </div>

      <div class="tix-detail-actions">
        <div class="tix-actions-head">⚙ Admin Actions</div>
        <div class="tix-actions-grid">
          <div class="tix-actions-group">
            <label class="tix-actions-label">Assign Admin</label>
            <select id="tix-assign-sel" class="tix-pick" style="width:100%"></select>
          </div>
          <div class="tix-actions-group">
            <label class="tix-actions-label">Change Status</label>
            <select id="tix-status-sel" class="tix-pick" style="width:100%">
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>
        <button type="button" id="tix-update-btn" class="tix-action tix-action--primary">Update Ticket</button>
        <div id="tix-action-feedback" class="tix-action-feedback"></div>
      </div>
    </div>`;
}

// ─── Chat bubble render ──────────────────────────

function renderChat(messages) {
  const box = document.getElementById("tix-chat-box");
  if (!box) return;
  if (!messages || messages.length === 0) {
    box.innerHTML = '<div class="tix-chat-empty">No messages yet. Start the conversation above.</div>';
    return;
  }
  box.innerHTML = messages
    .map((m) => {
      const sender = safeText(m.sender_id || m.sender, "Unknown");
      const msg = safeText(m.message || m.content, "");
      const when = formatTime(m.created_at);
      const attach = m.attachment_url
        ? `<div class="tix-chat-attach"><a href="${m.attachment_url}" target="_blank" rel="noreferrer">📎 Attachment</a></div>`
        : "";
      return `
        <div class="tix-msg">
          <div class="tix-msg-head">
            <strong>${sender}</strong>
            <span>${when}</span>
          </div>
          <div class="tix-msg-text">${msg}</div>
          ${attach}
        </div>`;
    })
    .join("");
  box.scrollTop = box.scrollHeight;
}

// ─── Main init ────────────────────────────────────

export async function initTicketsAdminUI(root) {
  if (!root) return;

  root.innerHTML = `
    <div class="tix-wrap">
      ${buildHero()}
      <div id="tix-stats-root"></div>
      ${buildToolbar()}
      <div id="tix-list-root"></div>
      ${buildDetailModalHTML()}
    </div>`;

  const statsEl = document.getElementById("tix-stats-root");
  const listEl = document.getElementById("tix-list-root");

  statsEl.innerHTML = `<div class="tix-load">Loading stats...</div>`;
  listEl.innerHTML = `<div class="tix-load">Loading tickets...</div>`;

  // ─── Fetch & render ──────────────────────────

  async function loadAndRender() {
    try {
      const search = document.getElementById("tix-q")?.value || "";
      const status = document.getElementById("tix-sf")?.value || "";
      const priority = document.getElementById("tix-pf")?.value || "";

      const { data: { user } } = await supabase.auth.getUser();
      const tickets = await loadTicketList({
        role: "admin",
        userId: user?.id,
        adminView: true,
        filters: { status, priority, search, limit: 100 },
      });

      // Compute stats
      const total = (tickets || []).length;
      const open = (tickets || []).filter((t) => {
        const s = safeText(t.status).trim().toLowerCase();
        return s === "open";
      }).length;
      const inProgress = (tickets || []).filter((t) => {
        const s = safeText(t.status).trim().toLowerCase();
        return s === "in progress" || s === "in_progress" || s === "in-progress";
      }).length;
      const resolved = (tickets || []).filter((t) => {
        const s = safeText(t.status).trim().toLowerCase();
        return s === "resolved";
      }).length;

      statsEl.innerHTML = buildStats({ total, open, inProgress, resolved });
      listEl.innerHTML = buildCardList(tickets);

      // Wire card clicks
      listEl.querySelectorAll(".tix-card").forEach((card) => {
        card.addEventListener("click", async () => {
          const id = card.getAttribute("data-id");
          await openDetailModal(id);
        });
      });
    } catch (err) {
      console.error("Ticket load failed:", err);
      listEl.innerHTML = `
        <div class="tix-panel">
          <div class="tix-null">
            <div class="tix-null-ico" aria-hidden="true">⚠️</div>
            <h3>Failed to load tickets</h3>
            <p>${safeText(err.message)}</p>
          </div>
        </div>`;
    }
  }

  await loadAndRender();

  // ─── Filter wiring ───────────────────────────

  const applyFilters = () => loadAndRender();

  document.getElementById("tix-q")?.addEventListener("input", applyFilters);
  document.getElementById("tix-sf")?.addEventListener("change", applyFilters);
  document.getElementById("tix-pf")?.addEventListener("change", applyFilters);
  document.getElementById("tix-refresh")?.addEventListener("click", () => loadAndRender());

  // ─── Modal logic ─────────────────────────────

  async function openDetailModal(ticketId) {
    const modal = document.getElementById("tix-modal");
    const content = document.getElementById("tix-modal-content");
    if (!modal || !content) return;

    content.innerHTML = `<div class="tix-load" style="margin:0">Loading details...</div>`;
    modal.style.display = "flex";

    try {
      const ticket = await loadTicketDetails(ticketId);
      content.innerHTML = buildDetailContent(ticket);

      // Populate admin select
      const assignSel = document.getElementById("tix-assign-sel");
      if (assignSel) {
        const admins = await getAdmins();
        assignSel.innerHTML = `<option value="">Unassigned</option>`
          + (admins || []).map((a) => `<option value="${a.id}">${safeText(a.full_name)}</option>`).join("");
        assignSel.value = ticket.assigned_admin || "";
      }

      // Status select
      const statusSel = document.getElementById("tix-status-sel");
      if (statusSel) {
        statusSel.value = normalizeStatusForDisplay(ticket.status);
      }

      // Load conversation
      const messages = await loadConversation(ticket.id);
      renderChat(messages);

      // Send message
      document.getElementById("tix-msg-send")?.addEventListener("click", async () => {
        const input = document.getElementById("tix-msg-input");
        const fileInput = document.getElementById("tix-msg-file");
        const msg = input?.value?.trim();
        if (!msg) return;
        try {
          await sendMessage({
            ticketId: ticket.id,
            message: msg,
            attachmentFile: fileInput?.files?.[0] || null,
          });
          input.value = "";
          if (fileInput) fileInput.value = "";
          const updated = await loadConversation(ticket.id);
          renderChat(updated);
        } catch (e) {
          alert("Failed to send: " + e.message);
        }
      });

      // Update ticket
      document.getElementById("tix-update-btn")?.addEventListener("click", async () => {
        const aSel = document.getElementById("tix-assign-sel");
        const sSel = document.getElementById("tix-status-sel");
        const feedback = document.getElementById("tix-action-feedback");
        if (!feedback) return;

        feedback.textContent = "Updating...";
        feedback.className = "tix-action-feedback";
        try {
          await Promise.all([
            assignTicket({ ticketId: ticket.id, adminId: aSel?.value || null }),
            changeStatus({ ticketId: ticket.id, status: sSel?.value || "Open" }),
          ]);
          feedback.textContent = "✅ Ticket updated successfully";
          feedback.className = "tix-action-feedback tix-action-feedback--ok";

          // Refresh conversation
          const updated = await loadConversation(ticket.id);
          renderChat(updated);

          // Refresh list
          await loadAndRender();
        } catch (e) {
          feedback.textContent = "❌ " + e.message;
          feedback.className = "tix-action-feedback tix-action-feedback--err";
        }
      });

    } catch (err) {
      content.innerHTML = `
        <div class="tix-null" style="padding:32px">
          <div class="tix-null-ico">⚠️</div>
          <h3>Error loading ticket</h3>
          <p>${safeText(err.message)}</p>
        </div>`;
    }
  }

  // Close modal handlers
  const modal = document.getElementById("tix-modal");
  if (modal) {
    modal.querySelectorAll("[data-tix-close]").forEach((el) => {
      el.addEventListener("click", () => { modal.style.display = "none"; });
    });
  }

  console.log("Ticket Operations Center ready");
}

