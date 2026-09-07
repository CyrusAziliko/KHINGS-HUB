import { supabase } from "./supabaseClient.js";
import { createActivityFeedTicketsSubscription } from "./realtime.js";
import { createTicket } from "./services/ticketService.js";

function byId(id) { return document.getElementById(id); }

/* ── Premium status badge generator ── */
function tixStatusBadge(status) {
  const s = String(status ?? "").toLowerCase().replace(/\s+/g, "");
  const clsMap = {
    open: "tix-st--open",
    inprogress: "tix-st--progress",
    assigned: "tix-st--progress",
    pending: "tix-st--progress",
    resolved: "tix-st--resolved",
    closed: "tix-st--closed",
  };
  const cls = clsMap[s] || "tix-st--open";
  const label = String(status ?? "Open");
  return `<span class="tix-st ${cls}">${label}</span>`;
}

/* ── Premium priority badge generator ── */
function tixPriorityBadge(priority) {
  const p = String(priority ?? "").toLowerCase();
  const clsMap = {
    critical: "tix-pri--critical",
    high: "tix-pri--high",
    medium: "tix-pri--medium",
    low: "tix-pri--low",
  };
  const cls = clsMap[p] || "tix-pri--medium";
  return `<span class="tix-pri ${cls}">${priority || "Medium"}</span>`;
}

/* ── Category pill ── */
function tixCategoryPill(category) {
  const cat = String(category ?? "Other");
  return `<span class="tix-card-pill">${cat}</span>`;
}

/* ── Time ago helper ── */
function timeAgo(dateStr) {
  if (!dateStr) return "Just now";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return "Just now";
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ── Update stats counters ── */
function updateTicketStats(tickets) {
  const data = tickets || [];
  const open = data.filter((t) => {
    const s = String(t.status || "").toLowerCase();
    return s === "open" || s === "assigned" || s === "pending";
  }).length;
  const progress = data.filter((t) => {
    const s = String(t.status || "").toLowerCase();
    return s === "in progress" || s === "in_progress";
  }).length;
  const done = data.filter((t) => {
    const s = String(t.status || "").toLowerCase();
    return s === "resolved" || s === "closed";
  }).length;

  const openEl = byId("tix-stat-open");
  const progEl = byId("tix-stat-progress");
  const doneEl = byId("tix-stat-done");
  const badgeEl = byId("tix-count-badge");

  if (openEl) openEl.textContent = open;
  if (progEl) progEl.textContent = progress;
  if (doneEl) doneEl.textContent = done;
  if (badgeEl) badgeEl.textContent = data.length;
}

async function getRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (error) return null;
  return data?.role || null;
}

/* ── Ticket HTML renderer (premium card) ── */
function renderTicketCard(t) {
  const isResolved = ["resolved", "closed"].includes(String(t.status || "").toLowerCase());
  return `
    <div class="tix-card" data-ticket-id="${t.id}">
      <div class="tix-card-top">
        <div class="tix-card-left">
          <div class="tix-card-num">#${t.ticket_number || "—"}</div>
          <div class="tix-card-title">${t.title}</div>
        </div>
        <div class="tix-card-right">
          ${tixPriorityBadge(t.priority)}
          ${tixStatusBadge(t.status)}
        </div>
      </div>
      <div class="tix-card-meta">
        <span>${tixCategoryPill(t.category)}</span>
        <span>📅 ${timeAgo(t.updated_at || t.created_at)}</span>
        ${!isResolved ? `<button class="tix-action resolve-btn" data-id="${t.id}" style="padding:4px 10px;font-size:10px;">✅ Resolve</button>` : `<span style="color:var(--success);font-weight:700;font-size:11px;">✔ Completed</span>`}
      </div>
    </div>
  `;
}

export async function initTicketsModule() {
  const ticketsTable = byId("tickets-table");
  const createBtn = document.querySelector("button[data-create-ticket]");
  const fileInput = byId("ticket-attachment");
  const newBtn = byId("tix-btn-new");
  const createPanel = byId("tix-create-panel");
  const createClose = byId("tix-create-close");
  const createCancel = byId("tix-create-cancel");
  const searchInput = byId("tix-search-input");
  const filterStatus = byId("tix-filter-status");
  const filterPriority = byId("tix-filter-priority");

  let cachedTickets = [];
  let currentFilterStatus = "all";
  let currentFilterPriority = "all";
  let currentSearch = "";

  if (!ticketsTable) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const role = await getRole();

  /* ── Toggle create panel ── */
  function showCreatePanel(show) {
    if (!createPanel) return;
    createPanel.style.display = show ? "block" : "none";
  }

  newBtn?.addEventListener("click", () => showCreatePanel(true));
  createClose?.addEventListener("click", () => showCreatePanel(false));
  createCancel?.addEventListener("click", () => showCreatePanel(false));

  /* ── Mark resolved ── */
  async function markResolved(ticketId) {
    const { error } = await supabase
      .from("tickets")
      .update({
        status: "resolved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

    if (error) {
      console.error(error);
      alert("Failed to resolve ticket");
      return;
    }
    await loadTickets();
  }

  /* ── Filter + Search logic ── */
  function filterTickets(tickets) {
    return tickets.filter((t) => {
      // Status filter
      if (currentFilterStatus !== "all") {
        const tStatus = String(t.status || "").toLowerCase();
        const fStatus = currentFilterStatus.toLowerCase();
        if (tStatus !== fStatus && tStatus.replace("_", " ") !== fStatus) return false;
      }
      // Priority filter
      if (currentFilterPriority !== "all") {
        if (String(t.priority || "").toLowerCase() !== currentFilterPriority.toLowerCase()) return false;
      }
      // Search
      if (currentSearch) {
        const q = currentSearch.toLowerCase();
        const matchTitle = String(t.title || "").toLowerCase().includes(q);
        const matchCategory = String(t.category || "").toLowerCase().includes(q);
        const matchNum = String(t.ticket_number || "").includes(q);
        if (!matchTitle && !matchCategory && !matchNum) return false;
      }
      return true;
    });
  }

  /* ── Render filtered tickets ── */
  function renderFiltered(filtered) {
    if (!ticketsTable) return;

    if (!filtered.length) {
      ticketsTable.innerHTML = `
        <div class="tix-null">
          <div class="tix-null-ico">🔍</div>
          <h3>No tickets found</h3>
          <p>Try adjusting your search or filters, or create a new ticket.</p>
        </div>
      `;
      return;
    }

    ticketsTable.innerHTML = filtered.map(renderTicketCard).join("");

    // Bind resolve buttons
    ticketsTable.querySelectorAll(".resolve-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        if (!id) return;
        await markResolved(id);
      });
    });
  }

  /* ── Main load function ── */
  async function loadTickets() {
    let query = supabase
      .from("tickets")
      .select(
        "id,ticket_number,title,category,priority,status,worker_id,assigned_admin,created_at,updated_at"
      );

    if (role !== "admin") query = query.eq("worker_id", user.id);

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    cachedTickets = data || [];

    // Update stats
    updateTicketStats(cachedTickets);

    // Apply current filters/search
    const filtered = filterTickets(cachedTickets);
    renderFiltered(filtered);
  }

  /* ── Event listeners for filters ── */
  searchInput?.addEventListener("input", (e) => {
    currentSearch = e.target.value.trim();
    const filtered = filterTickets(cachedTickets);
    renderFiltered(filtered);
  });

  filterStatus?.addEventListener("change", (e) => {
    currentFilterStatus = e.target.value;
    const filtered = filterTickets(cachedTickets);
    renderFiltered(filtered);
  });

  filterPriority?.addEventListener("change", (e) => {
    currentFilterPriority = e.target.value;
    const filtered = filterTickets(cachedTickets);
    renderFiltered(filtered);
  });

  /* ── File input label update ── */
  fileInput?.addEventListener("change", () => {
    const label = fileInput.closest(".tix-file-wrap")?.querySelector(".tix-file-label");
    if (label) {
      if (fileInput.files?.length) {
        label.textContent = `📎 ${fileInput.files[0].name}`;
        fileInput.classList.add("has-file");
      } else {
        label.textContent = "Choose file";
        fileInput.classList.remove("has-file");
      }
    }
  });

  /* ── Initial load ── */
  await loadTickets();

  /* ── Real-time subscription ── */
  const unsubscribe = createActivityFeedTicketsSubscription({
    onAny: async () => {
      try {
        await loadTickets();
      } catch (e) { console.error(e); }
    },
  });

  /* ── Create ticket handler ── */
  createBtn?.addEventListener("click", async () => {
    const title = byId("ticket-title")?.value?.trim();
    const description = byId("ticket-description")?.value?.trim();
    const category = byId("ticket-category")?.value;
    const priority = byId("ticket-priority")?.value;

    if (!title || !description || !category || !priority) {
      alert("Please fill in all required fields: title, description, category, and priority.");
      return;
    }

    const file = fileInput?.files?.[0];

    try {
      await createTicket({
        title,
        description,
        category,
        priority,
        attachmentFile: file,
      });
    } catch (e) {
      alert(e?.message || "Failed to create ticket.");
      return;
    }

    // Reset form
    if (byId("ticket-title")) byId("ticket-title").value = "";
    if (byId("ticket-description")) byId("ticket-description").value = "";
    if (fileInput) {
      fileInput.value = "";
      const label = fileInput.closest(".tix-file-wrap")?.querySelector(".tix-file-label");
      if (label) label.textContent = "Choose file";
      fileInput.classList.remove("has-file");
    }

    // Hide create panel
    showCreatePanel(false);

    await loadTickets();
  });

  return () => unsubscribe?.();
}

