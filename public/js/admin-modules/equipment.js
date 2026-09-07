import { supabase } from "../supabaseClient.js";
import { createTicket } from "../services/ticketService.js";

// ─── Utility Helpers ──────────────────────────────

function safeText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function formatDate(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return safeText(value);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return "—";
  }
}

function statusTone(status) {
  const s = safeText(status).toLowerCase();
  if (!s) return "unknown";
  if (s.includes("active") || s.includes("available") || s.includes("running") || s.includes("in use")) return "good";
  if (s.includes("idle") || s.includes("standby") || s.includes("maintenance")) return "warn";
  if (s.includes("offline") || s.includes("down") || s.includes("fault") || s.includes("broken") || s.includes("decommissioned")) return "bad";
  return "unknown";
}

function computeHealthScore(item) {
  const tone = statusTone(item.status);
  let base = tone === "good" ? 100 : tone === "warn" ? 65 : tone === "bad" ? 30 : 50;

  const cond = safeText(item.condition).toLowerCase();
  if (cond.includes("new") || cond.includes("excellent")) base += 10;
  else if (cond.includes("fair") || cond.includes("used")) base -= 10;
  else if (cond.includes("poor") || cond.includes("damaged")) base -= 25;

  const now = Date.now();
  if (item.next_service_date) {
    const next = new Date(item.next_service_date).getTime();
    if (!Number.isNaN(next)) {
      const daysUntil = (next - now) / 86400000;
      if (daysUntil < 0) base -= 20;
      else if (daysUntil < 7) base -= 10;
      else if (daysUntil < 30) base -= 5;
    }
  }

  return Math.max(5, Math.min(100, Math.round(base)));
}

function healthLabel(score) {
  if (score >= 80) return "Good";
  if (score >= 55) return "Fair";
  if (score >= 30) return "At Risk";
  return "Critical";
}

function healthClass(score) {
  if (score >= 80) return "eqh-good";
  if (score >= 55) return "eqh-fair";
  if (score >= 30) return "eqh-risk";
  return "eqh-critical";
}

// ─── Banner HTML ──────────────────────────────────

function buildBannerHtml() {
  return `
    <div class="eq-banner">
      <div class="eq-banner-glow" aria-hidden="true"></div>
      <div class="eq-banner-left">
        <div class="eq-banner-icon" aria-hidden="true">🚜</div>
        <div class="eq-banner-text">
          <h2 class="eq-banner-title">Equipment Command Center</h2>
          <p class="eq-banner-sub">Monitor fleet health, track maintenance schedules, and manage operational readiness across all assets.</p>
        </div>
      </div>
      <div class="eq-banner-right">
        <span class="eq-banner-badge">
          <span class="eq-banner-dot" aria-hidden="true"></span>
          Live
        </span>
      </div>
    </div>
  `;
}

// ─── KPI Cards ────────────────────────────────────

function buildKpiCardsHtml(stats) {
  return `
    <div class="eq-kpi-row">
      <div class="eq-kpi-card eq-kpi-card--blue">
        <div class="eq-kpi-head">
          <div class="eq-kpi-icon" aria-hidden="true">⛭</div>
          <span class="eq-kpi-trend neutral">● Total</span>
        </div>
        <div class="eq-kpi-value">${stats.totalAssets}</div>
        <div class="eq-kpi-label">Total Assets</div>
        <div class="eq-kpi-desc">All registered equipment across locations</div>
      </div>

      <div class="eq-kpi-card eq-kpi-card--green">
        <div class="eq-kpi-head">
          <div class="eq-kpi-icon" aria-hidden="true">✅</div>
          <span class="eq-kpi-trend neutral">● Available</span>
        </div>
        <div class="eq-kpi-value">${stats.available}</div>
        <div class="eq-kpi-label">Available</div>
        <div class="eq-kpi-desc">Equipment ready for immediate use</div>
      </div>

      <div class="eq-kpi-card eq-kpi-card--orange">
        <div class="eq-kpi-head">
          <div class="eq-kpi-icon" aria-hidden="true">🔧</div>
          <span class="eq-kpi-trend neutral">● Maintenance</span>
        </div>
        <div class="eq-kpi-value">${stats.maintenance}</div>
        <div class="eq-kpi-label">In Maintenance</div>
        <div class="eq-kpi-desc">Assets currently under service or repair</div>
      </div>

      <div class="eq-kpi-card eq-kpi-card--red">
        <div class="eq-kpi-head">
          <div class="eq-kpi-icon" aria-hidden="true">⚠️</div>
          <span class="eq-kpi-trend neutral">● Offline</span>
        </div>
        <div class="eq-kpi-value">${stats.offline}</div>
        <div class="eq-kpi-label">Offline / Fault</div>
        <div class="eq-kpi-desc">Assets not operational or reporting errors</div>
      </div>

      <div class="eq-kpi-card eq-kpi-card--purple">
        <div class="eq-kpi-head">
          <div class="eq-kpi-icon" aria-hidden="true">📊</div>
          <span class="eq-kpi-trend neutral">● Health</span>
        </div>
        <div class="eq-kpi-value">${stats.fleetHealth}%</div>
        <div class="eq-kpi-label">Fleet Health</div>
        <div class="eq-kpi-desc">Weighted average of all asset health scores</div>
      </div>
    </div>
  `;
}

// ─── Toolbar ──────────────────────────────────────

function buildToolbarHtml() {
  return `
    <div class="eq-toolbar">
      <div class="eq-toolbar-left">
        <div class="eq-search-wrap">
          <span class="eq-search-icon" aria-hidden="true">🔍</span>
          <input
            type="search"
            id="eq-search-input"
            class="eq-search"
            placeholder="Search name, type, serial, or location..."
            aria-label="Search equipment"
          />
        </div>
        <select id="eq-status-filter" class="eq-select" aria-label="Filter by status">
          <option value="">All Status</option>
          <option value="Available">Available</option>
          <option value="Active">Active</option>
          <option value="In Use">In Use</option>
          <option value="Idle">Idle</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Offline">Offline</option>
        </select>
        <select id="eq-condition-filter" class="eq-select" aria-label="Filter by condition">
          <option value="">All Conditions</option>
          <option value="New">New</option>
          <option value="Excellent">Excellent</option>
          <option value="Good">Good</option>
          <option value="Fair">Fair</option>
          <option value="Poor">Poor</option>
          <option value="Damaged">Damaged</option>
        </select>
      </div>
      <div class="eq-toolbar-right">
        <button type="button" id="eq-refresh-btn" class="eq-btn eq-btn--ghost" aria-label="Refresh equipment">
          ⟳ Refresh
        </button>
      </div>
    </div>
  `;
}

// ─── Maintenance Alerts Bar ───────────────────────

function buildAlertsHtml(equipment) {
  const now = Date.now();
  const alerts = [];

  for (const e of equipment) {
    if (!e.next_service_date) continue;
    const next = new Date(e.next_service_date).getTime();
    if (Number.isNaN(next)) continue;

    const days = Math.ceil((next - now) / 86400000);
    if (days < 0) {
      alerts.push({ type: "overdue", days: Math.abs(days), item: e });
    } else if (days <= 7) {
      alerts.push({ type: "due-soon", days, item: e });
    } else if (days <= 30) {
      alerts.push({ type: "upcoming", days, item: e });
    }
  }

  if (!alerts.length) return "";

  return `
    <div class="eq-alerts-wrap">
      ${alerts
        .sort((a, b) => a.days - b.days)
        .slice(0, 8)
        .map((a) => {
          const tone =
            a.type === "overdue" ? "eq-alert-critical" :
            a.type === "due-soon" ? "eq-alert-warn" :
            "eq-alert-info";
          const label =
            a.type === "overdue" ? `${a.days}d overdue` :
            a.type === "due-soon" ? `${a.days}d remaining` :
            `${a.days}d until service`;
          return `
            <div class="eq-alert-chip ${tone}">
              <span class="eq-alert-icon">${a.type === "overdue" ? "🔴" : a.type === "due-soon" ? "🟡" : "🟢"}</span>
              <span><strong>${safeText(a.item.name) || "Asset"}</strong> — ${label}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

// ─── Tab Bar ──────────────────────────────────────

function buildTabBarHtml(activeTab) {
  const tabs = [
    { id: "all", label: "📋 All Equipment" },
    { id: "available", label: "✅ Available" },
    { id: "maintenance", label: "🔧 Maintenance" },
    { id: "offline", label: "⚠️ Offline" },
  ];

  return `
    <div class="eq-tab-bar" id="eq-tab-bar">
      ${tabs.map((t) => `
        <button class="eq-tab ${activeTab === t.id ? "eq-tab-active" : ""}" data-eq-tab="${t.id}" type="button">
          ${t.label}
        </button>
      `).join("")}
    </div>
  `;
}

// ─── Equipment Table ──────────────────────────────

function buildTableHtml(equipment, workerMap) {
  if (!equipment || equipment.length === 0) {
    return `
      <div class="eq-card">
        <div class="eq-card-title-row">
          <h3 class="eq-card-title">Asset Registry</h3>
          <span class="eq-card-pill">0 Assets</span>
        </div>
        <div class="eq-empty">
          <div class="eq-empty-icon" aria-hidden="true">🚜</div>
          <h3>No equipment found</h3>
          <p>Try adjusting your search or filter criteria.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="eq-card">
      <div class="eq-card-title-row">
        <h3 class="eq-card-title">Asset Registry</h3>
        <span class="eq-card-pill">${equipment.length} Assets</span>
      </div>
      <div class="eq-table-wrap">
        <table class="eq-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Type</th>
              <th>Serial #</th>
              <th>Status</th>
              <th>Health</th>
              <th>Location</th>
              <th>Condition</th>
              <th>Last Service</th>
              <th>Next Service</th>
            </tr>
          </thead>
          <tbody id="eq-table-body">
            ${equipment.map((e) => buildEquipmentRow(e, workerMap)).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function buildEquipmentRow(item, workerMap) {
  const name = safeText(item.name, "Unknown");
  const type = safeText(item.type, "—");
  const serial = safeText(item.serial_number, "—");
  const status = safeText(item.status, "Unknown");
  const tone = statusTone(item.status);
  const score = computeHealthScore(item);
  const hClass = healthClass(score);
  const hLabel = healthLabel(score);
  const location = safeText(item.location, "—");
  const condition = safeText(item.condition, "—");
  const lastService = formatDate(item.last_service_date);
  const nextService = formatDate(item.next_service_date);

  return `
    <tr class="eq-row" data-eq-id="${item.id}">
      <td>
        <div class="eq-asset-cell">
          <div class="eq-asset-icon">${type === "—" ? "🚜" : "⚙️"}</div>
          <div class="eq-asset-info">
            <div class="eq-asset-name">${name}</div>
            <div class="eq-asset-sub">#${String(item.id).slice(0, 8)}</div>
          </div>
        </div>
      </td>
      <td>${type}</td>
      <td><span class="eq-serial">${serial}</span></td>
      <td><span class="eq-pill eq-pill--${tone}">${status}</span></td>
      <td><span class="eq-health-pill ${hClass}">${hLabel} (${score}%)</span></td>
      <td>${location}</td>
      <td>${condition}</td>
      <td>${lastService}</td>
      <td class="${item.next_service_date && new Date(item.next_service_date) < new Date() ? 'eq-overdue-text' : ''}">${nextService}</td>
    </tr>
  `;
}

// ─── Detail Modal ─────────────────────────────────

function buildDetailModalHtml(item) {
  const name = safeText(item.name, "Unknown");
  const type = safeText(item.type, "—");
  const serial = safeText(item.serial_number, "—");
  const status = safeText(item.status, "Unknown");
  const tone = statusTone(item.status);
  const location = safeText(item.location, "—");
  const condition = safeText(item.condition, "—");
  const score = computeHealthScore(item);
  const hClass = healthClass(score);
  const hLabel = healthLabel(score);
  const assignedTo = safeText(item.assigned_to_name || item.assigned_to, "—");
  const lastService = formatDate(item.last_service_date);
  const nextService = formatDate(item.next_service_date);
  const purchaseDate = formatDate(item.purchase_date);
  const createdAt = formatDate(item.created_at);
  const isNextOverdue = item.next_service_date && new Date(item.next_service_date) < new Date();
  const isLastOverdue = item.last_service_date && new Date(item.last_service_date) < new Date(Date.now() - 365 * 86400000);

  return `
    <div class="eq-modal-grid">
      <div class="eq-modal-section">
        <div class="eq-modal-field">
          <span class="eq-modal-label">Asset Name</span>
          <span class="eq-modal-value eq-modal-name">${name}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Type</span>
          <span class="eq-modal-value">${type}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Serial Number</span>
          <span class="eq-modal-value eq-modal-serial">${serial}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Location</span>
          <span class="eq-modal-value">${location}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Status</span>
          <span class="eq-pill eq-pill--${tone}" style="display:inline-flex;">${status}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Condition</span>
          <span class="eq-modal-value">${condition}</span>
        </div>
      </div>

      <div class="eq-modal-section">
        <div class="eq-modal-field">
          <span class="eq-modal-label">Health</span>
          <span class="eq-modal-health-badge ${hClass}">${hLabel} (${score}%)</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Assigned To</span>
          <span class="eq-modal-value">${assignedTo}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Last Service</span>
          <span class="eq-modal-value ${isLastOverdue ? 'eq-modal-overdue' : ''}">${lastService}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Next Service</span>
          <span class="eq-modal-value ${isNextOverdue ? 'eq-modal-overdue' : ''}">${nextService}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Purchase Date</span>
          <span class="eq-modal-value">${purchaseDate}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Created</span>
          <span class="eq-modal-value">${createdAt}</span>
        </div>
      </div>
    </div>

    <div class="eq-modal-actions">
      <button class="btn primary" data-eq-report-issue type="button">⚠️ Report Issue</button>
      <button class="btn ghost" data-eq-request-maint type="button">🔧 Request Maintenance</button>
    </div>
  `;
}

function openDetailModal(item) {
  const overlay = document.getElementById("eq-detail-modal");
  if (!overlay) return;

  const titleEl = overlay.querySelector("[data-eq-modal-title]");
  const bodyEl = overlay.querySelector("[data-eq-modal-body]");

  if (titleEl) titleEl.textContent = `🔍 ${safeText(item.name)}`;
  if (bodyEl) bodyEl.innerHTML = buildDetailModalHtml(item);

  overlay.classList.add("active");
}

function closeDetailModal() {
  const overlay = document.getElementById("eq-detail-modal");
  if (overlay) overlay.classList.remove("active");
}

function ensureModal() {
  if (document.getElementById("eq-detail-modal")) return;

  const overlay = document.createElement("div");
  overlay.id = "eq-detail-modal";
  overlay.className = "eq-modal-overlay";
  overlay.innerHTML = `
    <div class="eq-modal-content glass">
      <div class="eq-modal-header">
        <h3 class="eq-modal-title" data-eq-modal-title>🔍 Equipment Detail</h3>
        <button class="eq-modal-close" data-eq-close-modal type="button" aria-label="Close">✖</button>
      </div>
      <div data-eq-modal-body class="eq-modal-body"></div>
    </div>
  `;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeDetailModal();
  });

  overlay.querySelector("[data-eq-close-modal]")?.addEventListener("click", closeDetailModal);

  document.body.appendChild(overlay);
}

// ─── Main Load ────────────────────────────────────

export async function loadEquipment() {
  console.log("Loading Equipment module");

  const container = document.getElementById("equipment-root");
  if (!container) {
    console.warn("Equipment container missing");
    return;
  }

  // Ensure modal exists in DOM
  ensureModal();

  // ─── Render Shell ──────────────────────────────
  container.innerHTML = `
    <div class="eq-wrap">
      ${buildBannerHtml()}
      <div id="eq-kpis"></div>
      ${buildToolbarHtml()}
      <div id="eq-alerts-root"></div>
      <div id="eq-tabs-root"></div>
      <div id="eq-table-root"></div>
    </div>
  `;

  const kpiRoot = document.getElementById("eq-kpis");
  const alertsRoot = document.getElementById("eq-alerts-root");
  const tabsRoot = document.getElementById("eq-tabs-root");
  const tableRoot = document.getElementById("eq-table-root");

  // ─── Show Loading ──────────────────────────────
  kpiRoot.innerHTML = `<div class="eq-loading">Loading equipment statistics...</div>`;
  tableRoot.innerHTML = `<div class="eq-loading">Loading asset registry...</div>`;

  // ─── Fetch Data ────────────────────────────────
  let equipment = [];
  let loadError = null;

  try {
    const { data, error } = await supabase
      .from("equipment")
      .select("id, name, type, serial_number, status, location, assigned_to, condition, last_service_date, next_service_date, purchase_date, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    equipment = data || [];
  } catch (err) {
    console.error("Equipment data load failed:", err);
    loadError = err;
  }

  if (loadError) {
    container.innerHTML = `
      <div class="eq-wrap">
        ${buildBannerHtml()}
        <div class="eq-card" style="padding:48px;text-align:center;">
          <div style="font-size:42px;margin-bottom:12px;">⚠️</div>
          <h3 style="margin:0 0 8px;color:var(--text-primary);">Failed to Load Equipment Data</h3>
          <p style="color:var(--text-secondary);">Unable to connect to the database. Please try again.</p>
          <button type="button" onclick="location.reload()" class="eq-btn eq-btn--primary" style="margin-top:16px;">
            ⟳ Retry
          </button>
        </div>
      </div>
    `;
    return;
  }

  // ─── Active Tab State ──────────────────────────
  let activeTab = "all";

  // ─── Compute Stats ─────────────────────────────
  function computeStats(list) {
    const totalAssets = list.length;
    const available = list.filter((e) => {
      const s = safeText(e.status).toLowerCase();
      return s === "available" || s === "active" || s === "in use";
    }).length;
    const maintenance = list.filter((e) => {
      const s = safeText(e.status).toLowerCase();
      return s.includes("maintenance") || s === "idle";
    }).length;
    const offline = list.filter((e) => {
      const s = safeText(e.status).toLowerCase();
      return s === "offline" || s === "down" || s === "fault" || s === "broken" || s === "decommissioned";
    }).length;

    let totalHealth = 0;
    if (totalAssets > 0) {
      totalHealth = Math.round(
        list.reduce((sum, e) => sum + computeHealthScore(e), 0) / totalAssets
      );
    }

    return { totalAssets, available, maintenance, offline, fleetHealth: totalHealth };
  }

  // ─── Filter Logic ──────────────────────────────
  function getFilteredList() {
    const searchTerm = safeText(document.getElementById("eq-search-input")?.value).trim().toLowerCase();
    const statusVal = document.getElementById("eq-status-filter")?.value || "";
    const conditionVal = document.getElementById("eq-condition-filter")?.value || "";

    let filtered = equipment;

    // Tab filter
    if (activeTab === "available") {
      filtered = filtered.filter((e) => {
        const s = safeText(e.status).toLowerCase();
        return s === "available" || s === "active" || s === "in use";
      });
    } else if (activeTab === "maintenance") {
      filtered = filtered.filter((e) => {
        const s = safeText(e.status).toLowerCase();
        return s.includes("maintenance") || s === "idle";
      });
    } else if (activeTab === "offline") {
      filtered = filtered.filter((e) => {
        const s = safeText(e.status).toLowerCase();
        return s === "offline" || s === "down" || s === "fault" || s === "broken" || s === "decommissioned";
      });
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((e) => {
        const haystack = [
          safeText(e.name),
          safeText(e.type),
          safeText(e.serial_number),
          safeText(e.location),
          safeText(e.status),
          safeText(e.condition),
        ].map((v) => v.toLowerCase());
        return haystack.some((h) => h.includes(searchTerm));
      });
    }

    // Status filter
    if (statusVal) {
      filtered = filtered.filter((e) => safeText(e.status).toLowerCase() === statusVal.toLowerCase());
    }

    // Condition filter
    if (conditionVal) {
      filtered = filtered.filter((e) => safeText(e.condition).toLowerCase() === conditionVal.toLowerCase());
    }

    return filtered;
  }

  function renderAll() {
    const filtered = getFilteredList();
    const stats = computeStats(filtered);

    kpiRoot.innerHTML = buildKpiCardsHtml(stats);
    alertsRoot.innerHTML = buildAlertsHtml(filtered);
    tabsRoot.innerHTML = buildTabBarHtml(activeTab);
    tableRoot.innerHTML = buildTableHtml(filtered);
  }

  // Initial render
  renderAll();

  // ─── Wire Tab Clicks ───────────────────────────
  tabsRoot.addEventListener("click", (e) => {
    const tabBtn = e.target.closest("[data-eq-tab]");
    if (!tabBtn) return;
    const tabId = tabBtn.dataset.eqTab;
    if (tabId === activeTab) return;
    activeTab = tabId;
    renderAll();
  });

  // ─── Wire Search & Filters ─────────────────────
  const searchInput = document.getElementById("eq-search-input");
  const statusFilter = document.getElementById("eq-status-filter");
  const conditionFilter = document.getElementById("eq-condition-filter");
  const refreshBtn = document.getElementById("eq-refresh-btn");

  if (searchInput) searchInput.addEventListener("input", renderAll);
  if (statusFilter) statusFilter.addEventListener("change", renderAll);
  if (conditionFilter) conditionFilter.addEventListener("change", renderAll);
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => loadEquipment());
  }

  // ─── Wire Row Click → Detail Modal ─────────────
  tableRoot.addEventListener("click", (e) => {
    const tr = e.target.closest(".eq-row");
    if (!tr) return;
    const eqId = tr.getAttribute("data-eq-id");
    const item = equipment.find((e) => safeText(e.id) === eqId);
    if (item) {
      openDetailModal(item);
    }
  });

  // ─── Wire Modal Action Buttons ─────────────────
  document.addEventListener("click", async (e) => {
    const reportBtn = e.target.closest("[data-eq-report-issue]");
    const maintBtn = e.target.closest("[data-eq-request-maint]");
    if (!reportBtn && !maintBtn) return;

    const overlay = document.getElementById("eq-detail-modal");
    if (!overlay || !overlay.classList.contains("active")) return;

    const titleEl = overlay.querySelector("[data-eq-modal-title]");
    const assetName = titleEl ? titleEl.textContent.replace("🔍 ", "") : "Unknown";

    const user = await supabase.auth.getUser();
    const userId = user?.data?.user?.id;

    if (reportBtn) {
      try {
        await createTicket({
          title: `Equipment Issue: ${assetName}`,
          description: `Reported issue with equipment "${assetName}". Please inspect and take action.`,
          category: "Maintenance",
          priority: "Medium",
        });
      } catch (err) {
        console.error("Failed to report issue:", err);
      }
      closeDetailModal();
    }

    if (maintBtn) {
      try {
        await createTicket({
          title: `Maintenance Request: ${assetName}`,
          description: `Maintenance requested for equipment "${assetName}". Scheduled service may be due.`,
          category: "Maintenance",
          priority: "Medium",
        });
      } catch (err) {
        console.error("Failed to request maintenance:", err);
      }
      closeDetailModal();
    }
  });

  console.log("Equipment module loaded successfully —", equipment.length, "assets");
}
