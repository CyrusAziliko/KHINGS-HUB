import { supabase } from "../supabaseClient.js";

// ──────────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────────

function safeText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return safeText(value);
  return d.toLocaleString();
}

// ──────────────────────────────────────────────
// Badge classes for severity / status
// ──────────────────────────────────────────────

function severityBadgeClass(severity) {
  const s = safeText(severity).trim().toLowerCase();
  if (!s) return "status";
  if (s.includes("critical")) return "status"; // red via default .status
  if (s.includes("high")) return "status";
  if (s.includes("medium")) return "status";
  if (s.includes("low")) return "status";
  return "status";
}

function severityBadgeStyle(severity) {
  const s = safeText(severity).trim().toLowerCase();
  if (s.includes("critical")) return "background:#b3261e; color:white;";
  if (s.includes("high")) return "background:#c28b1a; color:white;";
  if (s.includes("medium")) return "background:#b6a21e; color:white;";
  if (s.includes("low")) return "background:#1f8f4a; color:white;";
  return "";
}

function statusBadgeClass(status) {
  const s = safeText(status).trim().toLowerCase();
  if (!s) return "status";
  if (s === "open") return "status";
  if (s === "in progress") return "status";
  if (s === "resolved") return "status available";
  if (s === "closed") return "status offline";
  return "status";
}

function statusBadgeStyle(status) {
  const s = safeText(status).trim().toLowerCase();
  if (s === "open") return "background:#2563eb; color:white;";
  if (s === "in progress") return "background:#c28b1a; color:white;";
  if (s === "resolved") return "background:#1f8f4a; color:white;";
  if (s === "closed") return "background:#475569; color:white;";
  return "";
}

// ──────────────────────────────────────────────
// KPI card builder
// ──────────────────────────────────────────────

function safetyKpiCard(title, value, icon = "⚠") {
  return `
    <div class="kpi-card card glass" role="group" aria-label="${title}">
      <h3>${title}</h3>
      <strong class="kpi-value">${value}</strong>
    </div>
  `;
}

// ──────────────────────────────────────────────
// Dashboard HTML
// ──────────────────────────────────────────────

function buildDashboardHtml() {
  return `
    <div class="safety-shell">
      <div class="safety-hero card glass">
        <div class="safety-hero-content">
          <div class="safety-hero-icon">⚠️</div>
          <div>
            <span class="safety-eyebrow">Safety command center</span>
            <h2>Safety & Incident Management</h2>
            <p class="muted">Monitor hazards, resolve incidents, and protect crew wellbeing across all sites.</p>
          </div>
        </div>
        <div class="safety-hero-actions">
          <span class="safety-live-pill"><span class="safety-live-dot"></span> Live monitoring</span>
          <span class="safety-badge-pill">Enterprise coverage</span>
        </div>
      </div>

      <div class="kpi-row safety-kpi-row" id="safety-kpis"></div>

      <div class="card glass safety-board">
        <div class="safety-toolbar">
          <div class="safety-search-wrap">
            <input
              type="search"
              id="safety-search"
              class="user-search-input"
              placeholder="Search by title or description..."
            />
          </div>
          <div class="safety-filter-group">
            <div class="safety-filter-item">
              <label>Status</label>
              <select id="safety-status-filter" class="user-select">
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="in progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div class="safety-filter-item">
              <label>Severity</label>
              <select id="safety-severity-filter" class="user-select">
                <option value="">All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        <div class="safety-table-wrap">
          <table class="equipment-table safety-table" id="safety-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Reported By</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="safety-table-body"></tbody>
          </table>
        </div>
      </div>

      <div id="safety-details-host" class="safety-details-host"></div>
    </div>
  `;
}

// ──────────────────────────────────────────────
// Row builder
// ──────────────────────────────────────────────

function buildIncidentRow(incident) {
  const id = safeText(incident.id).slice(0, 8);
  const title = safeText(incident.title, "Untitled Incident");
  const severity = safeText(incident.severity, "—");
  const status = safeText(incident.status, "—");
  const reporterName = safeText(incident.reporter_name, "—");
  const createdAt = formatDate(incident.created_at);

  const sevStyle = severityBadgeStyle(incident.severity);
  const statStyle = statusBadgeStyle(incident.status);

  return `
    <tr class="user-table-row" data-incident-id="${safeText(incident.id)}" style="cursor:pointer;">
      <td style="font-family:monospace; font-size:12px;">${id}…</td>
      <td><strong>${title}</strong></td>
      <td><span class="status" style="${sevStyle}">${severity}</span></td>
      <td><span class="status" style="${statStyle}">${status}</span></td>
      <td>${reporterName}</td>
      <td style="font-size:12px;">${createdAt}</td>
      <td>
        <button type="button" class="user-action-view" data-view-incident="${safeText(incident.id)}" style="padding:6px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.12); background:rgba(15,23,42,.45); color:#e2e8f0; cursor:pointer; font-weight:900; font-size:12px;">
          👁 View
        </button>
      </td>
    </tr>
  `;
}

// ──────────────────────────────────────────────
// Details panel builder
// ──────────────────────────────────────────────

function buildDetailsPanel(incident) {
  if (!incident) {
    return `
      <div class="card glass">
        <div style="text-align:left; padding:8px 0;">
          <h3>Incident Details</h3>
          <p class="muted">Select an incident from the table to view full details.</p>
        </div>
      </div>
    `;
  }

  const title = safeText(incident.title, "Untitled Incident");
  const description = safeText(incident.description, "No description provided.");
  const severity = safeText(incident.severity, "—");
  const status = safeText(incident.status, "—");
  const reporterName = safeText(incident.reporter_name, "Unknown");
  const createdAt = formatDate(incident.created_at);
  const fullId = safeText(incident.id);

  const sevStyle = severityBadgeStyle(incident.severity);
  const statStyle = statusBadgeStyle(incident.status);

  return `
    <div class="card glass safety-details-panel" data-incident-details>
      <div class="safety-details-header">
        <div>
          <span class="safety-details-kicker">Incident overview</span>
          <h3>${title}</h3>
          <p class="safety-details-id">ID: ${fullId}</p>
        </div>
        <div class="safety-details-badges">
          <span class="status" style="${sevStyle}">${severity}</span>
          <span class="status" style="${statStyle}">${status}</span>
        </div>
      </div>

      <div class="safety-details-description">
        <p>${description}</p>
      </div>

      <div class="user-details-grid safety-details-grid">
        <div class="safety-detail-item">
          <span>Severity</span>
          <strong>${severity}</strong>
        </div>
        <div class="safety-detail-item">
          <span>Status</span>
          <strong>${status}</strong>
        </div>
        <div class="safety-detail-item">
          <span>Reported By</span>
          <strong>${reporterName}</strong>
        </div>
        <div class="safety-detail-item">
          <span>Date Created</span>
          <strong>${createdAt}</strong>
        </div>
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────
// Empty / Error state builders
// ──────────────────────────────────────────────

function buildEmptyState() {
  return `
    <tr>
      <td colspan="7" style="padding:32px; text-align:center;">
        <div style="width:52px; height:52px; border-radius:18px; display:flex; align-items:center; justify-content:center; background:rgba(124,58,237,.18); border:1px solid rgba(124,58,237,.35); font-size:24px; margin:0 auto 12px;">⚠</div>
        <h3 style="margin:0 0 6px; color:#e2e8f0;">No incidents found</h3>
        <p class="muted" style="margin:0;">Try changing your filters or search criteria.</p>
      </td>
    </tr>
  `;
}

function buildLoadingState() {
  return `
    <tr>
      <td colspan="7" style="padding:32px; text-align:center;">
        <p class="muted" style="margin:0;">Loading incidents...</p>
      </td>
    </tr>
  `;
}

// ──────────────────────────────────────────────
// Client-side filtering
// ──────────────────────────────────────────────

function getSearchIndex(incident) {
  return [
    safeText(incident.title),
    safeText(incident.description),
  ].join(" ").toLowerCase();
}

function getFilteredIncidents(incidents, searchTerm, statusFilter, severityFilter) {
  let filtered = incidents;

  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    filtered = filtered.filter((inc) => getSearchIndex(inc).includes(q));
  }

  if (statusFilter) {
    filtered = filtered.filter(
      (inc) => safeText(inc.status).trim().toLowerCase() === statusFilter
    );
  }

  if (severityFilter) {
    filtered = filtered.filter(
      (inc) => safeText(inc.severity).trim().toLowerCase() === severityFilter
    );
  }

  return filtered;
}

// ──────────────────────────────────────────────
// Compute KPI values
// ──────────────────────────────────────────────

function computeKpis(incidents) {
  const total = incidents.length;
  const open = incidents.filter(
    (i) => safeText(i.status).trim().toLowerCase() === "open"
  ).length;
  const inProgress = incidents.filter(
    (i) => safeText(i.status).trim().toLowerCase() === "in progress"
  ).length;
  const resolved = incidents.filter(
    (i) => safeText(i.status).trim().toLowerCase() === "resolved"
  ).length;
  const critical = incidents.filter(
    (i) => safeText(i.severity).trim().toLowerCase() === "critical"
  ).length;

  return { total, open, inProgress, resolved, critical };
}

// ──────────────────────────────────────────────
// Render KPIs
// ──────────────────────────────────────────────

function renderKpis(incidents) {
  const kpiContainer = document.getElementById("safety-kpis");
  if (!kpiContainer) return;

  const { total, open, inProgress, resolved, critical } = computeKpis(incidents);

  kpiContainer.innerHTML = [
    safetyKpiCard("Total Incidents", total, "⚠"),
    safetyKpiCard("Open", open, "📋"),
    safetyKpiCard("In Progress", inProgress, "🔄"),
    safetyKpiCard("Resolved", resolved, "✅"),
    safetyKpiCard("Critical", critical, "🚨"),
  ].join("");
}

// ──────────────────────────────────────────────
// Render table rows
// ──────────────────────────────────────────────

function renderTable(incidents) {
  const tbody = document.getElementById("safety-table-body");
  if (!tbody) return;

  if (!incidents || incidents.length === 0) {
    tbody.innerHTML = buildEmptyState();
    return;
  }

  tbody.innerHTML = incidents.map(buildIncidentRow).join("");
}

// ──────────────────────────────────────────────
// Render details panel
// ──────────────────────────────────────────────

function renderDetails(incident) {
  const host = document.getElementById("safety-details-host");
  if (!host) return;
  host.innerHTML = buildDetailsPanel(incident);
}

// ──────────────────────────────────────────────
// Select incident handler
// ──────────────────────────────────────────────

function attachRowClickHandler(incidents) {
  const tbody = document.getElementById("safety-table-body");
  if (!tbody) return;

  tbody.addEventListener("click", (e) => {
    // Ignore clicks on action buttons
    const actionBtn = e.target.closest("[data-view-incident]");
    if (actionBtn) {
      const incidentId = actionBtn.getAttribute("data-view-incident");
      const incident = incidents.find((i) => safeText(i.id) === incidentId);
      if (incident) {
        renderDetails(incident);
      }
      return;
    }

    // Row click
    const tr = e.target.closest("tr.user-table-row");
    if (!tr) return;
    const incidentId = tr.getAttribute("data-incident-id");
    const incident = incidents.find((i) => safeText(i.id) === incidentId);
    if (incident) {
      renderDetails(incident);
    }
  });
}

// ──────────────────────────────────────────────
// Resolve reporter names from profiles
// ──────────────────────────────────────────────

async function resolveReporterNames(incidents) {
  // Collect unique worker_ids
  const workerIds = [
    ...new Set(
      incidents
        .map((i) => i.worker_id)
        .filter(Boolean)
    ),
  ];

  if (workerIds.length === 0) return incidents;

  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", workerIds);

    if (error) {
      console.warn("Could not fetch reporter profiles:", error);
      return incidents;
    }

    const profileMap = {};
    if (Array.isArray(profiles)) {
      profiles.forEach((p) => {
        profileMap[p.id] = p.full_name || p.email || "Unknown";
      });
    }

    return incidents.map((inc) => ({
      ...inc,
      reporter_name: profileMap[inc.worker_id] || null,
    }));
  } catch (err) {
    console.warn("Reporter name resolution failed:", err);
    return incidents;
  }
}

// ──────────────────────────────────────────────
// Main data loading & rendering
// ──────────────────────────────────────────────

export async function loadSafety() {
  console.log("Loading Safety module");

  const container = document.getElementById("safety-root");
  if (!container) {
    console.warn("Safety container missing");
    return;
  }

  // Render dashboard shell
  container.innerHTML = buildDashboardHtml();

  // Show loading state
  const tbody = document.getElementById("safety-table-body");
  if (tbody) tbody.innerHTML = buildLoadingState();

  renderDetails(null);

  // ─── Load data ──────────────────────────────
  let incidents = [];
  let loadError = null;

  try {
    const { data, error } = await supabase
      .from("safety_incidents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    incidents = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Safety loading failed:", err);
    loadError = err;
  }

  // ─── Error state ────────────────────────────
  if (loadError) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding:32px; text-align:center;">
            <div style="width:52px; height:52px; border-radius:18px; display:flex; align-items:center; justify-content:center; background:rgba(239,68,68,.18); border:1px solid rgba(239,68,68,.35); font-size:24px; margin:0 auto 12px;">⚠</div>
            <h3 style="margin:0 0 6px; color:#e2e8f0;">Failed to Load Incidents</h3>
            <p style="margin:0 0 12px; color:#94a3b8;">The database query encountered an error. Please try again.</p>
            <button type="button" onclick="document.querySelector('[data-view-panel=\\'safety\\']')?.querySelector('#safety-root')?.__safetyRetry?.()" style="padding:8px 20px; border-radius:12px; border:1px solid rgba(255,255,255,.12); background:rgba(124,58,237,.25); color:#e2e8f0; cursor:pointer; font-weight:800; font-size:13px;">↻ Retry</button>
          </td>
        </tr>
      `;
    }
    renderKpis([]);
    return;
  }

  // ─── Resolve reporter names ─────────────────
  incidents = await resolveReporterNames(incidents);

  // ─── Render initial KPIs & table ────────────
  const allIncidents = incidents;
  renderKpis(allIncidents);
  renderTable(allIncidents);
  attachRowClickHandler(allIncidents);

  // ─── Search & filter wiring ─────────────────
  const searchInput = document.getElementById("safety-search");
  const statusFilter = document.getElementById("safety-status-filter");
  const severityFilter = document.getElementById("safety-severity-filter");

  function applyFilters() {
    const searchTerm = searchInput ? searchInput.value : "";
    const statusVal = statusFilter ? statusFilter.value : "";
    const severityVal = severityFilter ? severityFilter.value : "";

    const filtered = getFilteredIncidents(allIncidents, searchTerm, statusVal, severityVal);
    renderTable(filtered);
    renderKpis(filtered);

    // Re-attach click handlers since rows were replaced
    attachRowClickHandler(filtered);
  }

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (statusFilter) statusFilter.addEventListener("change", applyFilters);
  if (severityFilter) severityFilter.addEventListener("change", applyFilters);

  // Expose retry on the container for error state button
  container.__safetyRetry = loadSafety;

  console.log("Safety module loaded successfully");
}

