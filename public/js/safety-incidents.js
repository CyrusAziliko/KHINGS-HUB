import { supabase } from "./supabaseClient.js";

/* ── Helpers ── */
function byId(id) { return document.getElementById(id); }

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

/* ── Status Badge Generator ── */
function safStatusBadge(status) {
  const s = String(status ?? "").toLowerCase().replace(/\s+/g, "");
  const clsMap = {
    open: "saf-st--open",
    inprogress: "saf-st--progress",
    in_progress: "saf-st--progress",
    pending: "saf-st--progress",
    resolved: "saf-st--resolved",
    closed: "saf-st--closed",
  };
  const cls = clsMap[s] || "saf-st--open";
  const label = String(status ?? "Open");
  return `<span class="saf-st ${cls}">${label}</span>`;
}

/* ── Severity Badge Generator ── */
function safSeverityBadge(severity) {
  const s = String(severity ?? "").toLowerCase();
  const clsMap = {
    critical: "saf-sev--critical",
    high: "saf-sev--high",
    medium: "saf-sev--medium",
    low: "saf-sev--low",
  };
  const cls = clsMap[s] || "saf-sev--medium";
  return `<span class="saf-sev ${cls}">${severity || "Medium"}</span>`;
}

/* ── Update stats counters ── */
function updateSafetyStats(incidents) {
  const data = incidents || [];
  const open = data.filter((i) => {
    const s = String(i.status || "").toLowerCase();
    return s === "open" || s === "pending";
  }).length;
  const highCritical = data.filter((i) => {
    const sev = String(i.severity || "").toLowerCase();
    return sev === "high" || sev === "critical";
  }).length;
  const resolved = data.filter((i) => {
    const s = String(i.status || "").toLowerCase();
    return s === "resolved" || s === "closed";
  }).length;

  const openEl = byId("saf-stat-open");
  const highEl = byId("saf-stat-high");
  const doneEl = byId("saf-stat-done");
  const openSecondaryEl = byId("saf-stat-open-secondary");
  const highSecondaryEl = byId("saf-stat-high-secondary");
  const doneSecondaryEl = byId("saf-stat-done-secondary");
  const countEl = byId("saf-count-badge");

  if (openEl) openEl.textContent = open;
  if (highEl) highEl.textContent = highCritical;
  if (doneEl) doneEl.textContent = resolved;
  if (openSecondaryEl) openSecondaryEl.textContent = open;
  if (highSecondaryEl) highSecondaryEl.textContent = highCritical;
  if (doneSecondaryEl) doneSecondaryEl.textContent = resolved;
  if (countEl) countEl.textContent = data.length;
}

/* ── Incident Card Renderer (premium) ── */
function renderIncidentCard(i) {
  const isResolved = ["resolved", "closed"].includes(String(i.status || "").toLowerCase());
  return `
    <div class="saf-card" data-incident-id="${i.id}">
      <div class="saf-card-top">
        <div class="saf-card-left">
          <div class="saf-card-title">${i.title || "Untitled Incident"}</div>
          ${i.description ? `<div class="saf-card-desc">${i.description}</div>` : ""}
        </div>
        <div class="saf-card-right">
          ${safSeverityBadge(i.severity)}
          ${safStatusBadge(i.status)}
        </div>
      </div>
      <div class="saf-card-meta">
        <span>📍 ${i.location || "N/A"}</span>
        <span>📅 ${timeAgo(i.updated_at || i.created_at)}</span>
        <span>🔖 ${i.incident_type || "Incident"}</span>
        ${!isResolved
          ? `<button class="saf-resolve-btn" data-id="${i.id}" type="button">✅ Resolve</button>`
          : `<span class="saf-completed-label">✔ Completed</span>`
        }
      </div>
    </div>
  `;
}

/* ── Render Premium UI ── */
function renderUI() {
  const root = document.querySelector("[data-safety-incidents-root]");
  if (!root) return;

  root.innerHTML = `
    <div class="saf-wrap">

      <!-- ── Premium Hero Banner ── -->
      <div class="saf-hero">
        <div class="saf-hero-row">
          <div class="saf-hero-left">
            <div class="saf-hero-icon">🛡️</div>
            <div>
              <h2 class="saf-hero-title">Safety Command Center</h2>
              <p class="saf-hero-sub">Report hazards, track incidents, and manage safety reports in real-time</p>
            </div>
          </div>
          <div class="saf-hero-right">
            <div class="saf-hero-badge">
              <span class="saf-hero-dot"></span>
              <span data-saf-total-badge>Active Incidents</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Quick Summary Cards ── -->
      <div class="saf-overview">
        <div class="saf-summary-card saf-summary-card--alert">
          <div class="saf-summary-icon">🚨</div>
          <div class="saf-summary-copy">
            <span class="saf-summary-label">Open incidents</span>
            <strong id="saf-stat-open">—</strong>
          </div>
        </div>
        <div class="saf-summary-card saf-summary-card--risk">
          <div class="saf-summary-icon">⚠️</div>
          <div class="saf-summary-copy">
            <span class="saf-summary-label">High risk</span>
            <strong id="saf-stat-high">—</strong>
          </div>
        </div>
        <div class="saf-summary-card saf-summary-card--resolved">
          <div class="saf-summary-icon">✅</div>
          <div class="saf-summary-copy">
            <span class="saf-summary-label">Resolved</span>
            <strong id="saf-stat-done">—</strong>
          </div>
        </div>
      </div>

      <!-- ── Quick Stats Bar ── -->
      <div class="saf-stats" id="saf-stats-bar">
        <div class="saf-stat-item">
          <span class="saf-stat-num saf-stat-num--open" id="saf-stat-open-secondary">—</span>
          <span class="saf-stat-lbl">Active</span>
        </div>
        <div class="saf-stat-div"></div>
        <div class="saf-stat-item">
          <span class="saf-stat-num saf-stat-num--high" id="saf-stat-high-secondary">—</span>
          <span class="saf-stat-lbl">High / Critical</span>
        </div>
        <div class="saf-stat-div"></div>
        <div class="saf-stat-item">
          <span class="saf-stat-num saf-stat-num--done" id="saf-stat-done-secondary">—</span>
          <span class="saf-stat-lbl">Resolved</span>
        </div>
      </div>

      <!-- ── Toolbar ── -->
      <div class="saf-bar">
        <div class="saf-bar-left">
          <div class="saf-search-wrap">
            <span class="saf-search-ico">🔍</span>
            <input type="text" class="saf-search" id="saf-search-input" placeholder="Search incidents by title..." aria-label="Search incidents" />
          </div>
          <select class="saf-pick" id="saf-filter-severity">
            <option value="all">All Severity</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select class="saf-pick" id="saf-filter-status">
            <option value="all">All Status</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
        <div class="saf-bar-right">
          <button class="saf-action saf-action--primary" type="button" id="saf-btn-new">➕ Report Incident</button>
        </div>
      </div>

      <!-- ── Create Incident Panel (hidden by default) ── -->
      <div class="saf-panel" id="saf-create-panel" style="display:none;">
        <div class="saf-panel-head">
          <h3 class="saf-panel-title">📝 Report New Incident</h3>
          <button class="saf-panel-close" type="button" id="saf-create-close">✕</button>
        </div>
        <div class="saf-create-body">
          <div class="saf-create-grid">
            <div class="saf-create-field saf-create-field--full">
              <label class="saf-create-label">Incident Title</label>
              <input id="saf-incident-title" type="text" class="saf-create-input" placeholder="e.g., Slip hazard in Shaft A3" />
            </div>
            <div class="saf-create-field saf-create-field--full">
              <label class="saf-create-label">Description</label>
              <textarea id="saf-incident-description" class="saf-create-textarea" placeholder="Describe what happened, location details, and any immediate actions taken..."></textarea>
            </div>
            <div class="saf-create-field">
              <label class="saf-create-label">Incident Type</label>
              <select id="saf-incident-type" class="saf-create-select">
                <option value="Accident">Accident</option>
                <option value="Hazard">Hazard</option>
                <option value="Near Miss">Near Miss</option>
                <option value="Equipment Failure">Equipment Failure</option>
                <option value="Environmental Issue">Environmental Issue</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="saf-create-field">
              <label class="saf-create-label">Severity</label>
              <select id="saf-incident-severity" class="saf-create-select">
                <option value="Low">Low</option>
                <option value="Medium" selected>Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div class="saf-create-field">
              <label class="saf-create-label">Location</label>
              <input id="saf-incident-location" type="text" class="saf-create-input" placeholder="e.g., Shaft A3, Level 2" />
            </div>
          </div>
          <div class="saf-create-actions">
            <button class="saf-action saf-action--primary" type="button" data-create-incident>🚨 Submit Report</button>
            <button class="saf-action" type="button" id="saf-create-cancel">Cancel</button>
          </div>
        </div>
      </div>

      <!-- ── Incidents List ── -->
      <div class="saf-panel">
        <div class="saf-panel-head">
          <h3 class="saf-panel-title">⚠️ Incident Reports</h3>
          <span class="saf-chip saf-chip--danger" id="saf-count-badge">0</span>
        </div>
        <div class="saf-list" id="saf-incidents-list">
          <div class="saf-load">Loading incidents...</div>
        </div>
      </div>

    </div>
  `;
}

/* ── Bind Handlers ── */
function bindHandlers() {
  const createBtn = document.querySelector("button[data-create-incident]");
  const newBtn = byId("saf-btn-new");
  const createPanel = byId("saf-create-panel");
  const createClose = byId("saf-create-close");
  const createCancel = byId("saf-create-cancel");
  const searchInput = byId("saf-search-input");
  const filterSeverity = byId("saf-filter-severity");
  const filterStatus = byId("saf-filter-status");

  /* ── Toggle create panel ── */
  function showCreatePanel(show) {
    if (!createPanel) return;
    createPanel.style.display = show ? "block" : "none";
  }

  newBtn?.addEventListener("click", () => showCreatePanel(true));
  createClose?.addEventListener("click", () => showCreatePanel(false));
  createCancel?.addEventListener("click", () => showCreatePanel(false));

  /* ── Submit Incident ── */
  createBtn?.addEventListener("click", async () => {
    const title = byId("saf-incident-title")?.value?.trim();
    const description = byId("saf-incident-description")?.value?.trim();
    const severity = byId("saf-incident-severity")?.value;
    const location = byId("saf-incident-location")?.value?.trim();
    const incidentType = byId("saf-incident-type")?.value;

    if (!title || !description) {
      alert("Please provide incident title and description.");
      return;
    }

    createBtn.disabled = true;
    createBtn.textContent = "Submitting...";

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("safety_incidents")
        .insert({
          title,
          description,
          severity: severity || "Medium",
          location: location || null,
          incident_type: incidentType || "Incident",
          status: "Open",
          worker_id: user?.id || null,
        });

      if (error) throw error;

      // Reset form
      if (byId("saf-incident-title")) byId("saf-incident-title").value = "";
      if (byId("saf-incident-description")) byId("saf-incident-description").value = "";
      if (byId("saf-incident-location")) byId("saf-incident-location").value = "";
      if (byId("saf-incident-type")) byId("saf-incident-type").value = "Accident";
      if (byId("saf-incident-severity")) byId("saf-incident-severity").value = "Medium";

      showCreatePanel(false);
      await loadIncidents();
    } catch (err) {
      console.error("Incident submission failed:", err);
      alert("Failed to submit incident.");
    } finally {
      createBtn.disabled = false;
      createBtn.textContent = "🚨 Submit Report";
    }
  });

  /* ── Search + Filter ── */
  searchInput?.addEventListener("input", () => applyFilters());
  filterSeverity?.addEventListener("change", () => applyFilters());
  filterStatus?.addEventListener("change", () => applyFilters());
}

/* ── Filter + Search Logic ── */
let cachedIncidents = [];
let currentFilterSeverity = "all";
let currentFilterStatus = "all";
let currentSearch = "";

function applyFilters() {
  currentSearch = (byId("saf-search-input")?.value || "").trim().toLowerCase();
  currentFilterSeverity = byId("saf-filter-severity")?.value || "all";
  currentFilterStatus = byId("saf-filter-status")?.value || "all";

  const filtered = cachedIncidents.filter((i) => {
    if (currentFilterSeverity !== "all") {
      if (String(i.severity || "").toLowerCase() !== currentFilterSeverity.toLowerCase()) return false;
    }
    if (currentFilterStatus !== "all") {
      const iStatus = String(i.status || "").toLowerCase();
      const fStatus = currentFilterStatus.toLowerCase();
      if (iStatus !== fStatus && iStatus.replace("_", " ") !== fStatus) return false;
    }
    if (currentSearch) {
      const q = currentSearch;
      const matchTitle = String(i.title || "").toLowerCase().includes(q);
      const matchDesc = String(i.description || "").toLowerCase().includes(q);
      const matchLocation = String(i.location || "").toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchLocation) return false;
    }
    return true;
  });

  renderFiltered(filtered);
}

function renderFiltered(filtered) {
  const list = byId("saf-incidents-list");
  if (!list) return;

  if (!filtered.length) {
    list.innerHTML = `
      <div class="saf-null">
        <div class="saf-null-ico">🔍</div>
        <h3>No incidents found</h3>
        <p>Try adjusting your search or filters, or report a new incident.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map(renderIncidentCard).join("");

  // Bind resolve buttons
  list.querySelectorAll(".saf-resolve-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      if (!id) return;
      await markResolved(id);
    });
  });
}

/* ── Mark Resolved ── */
async function markResolved(incidentId) {
  const { error } = await supabase
    .from("safety_incidents")
    .update({
      status: "Resolved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", incidentId);

  if (error) {
    console.error(error);
    alert("Failed to resolve incident");
    return;
  }
  await loadIncidents();
}

/* ── Load Incidents ── */
async function loadIncidents() {
  const list = byId("saf-incidents-list");
  if (!list) return;

  const { data, error } = await supabase
    .from("safety_incidents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    list.innerHTML = `<div class="saf-load">Unable to load incidents.</div>`;
    return;
  }

  cachedIncidents = data || [];

  // Update stats
  updateSafetyStats(cachedIncidents);

  // Render with current filters
  applyFilters();
}

/* ── Initialize ── */
export function initSafetyIncidents() {
  renderUI();
  bindHandlers();
  loadIncidents();
}

