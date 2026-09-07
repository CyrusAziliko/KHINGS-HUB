import { supabase } from "../supabaseClient.js";

// ─── Utility Helpers ──────────────────────────────

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

function shiftLabel(shiftType) {
  const s = safeText(shiftType).trim().toLowerCase();
  if (s.includes("day") || s === "day") return "Day";
  if (s.includes("evening") || s === "evening") return "Evening";
  if (s.includes("night") || s === "night") return "Night";
  return safeText(shiftType) || "—";
}

function shiftBadgeClass(shiftType) {
  const s = safeText(shiftType).trim().toLowerCase();
  if (s.includes("day") || s === "day") return "sched-badge sched-badge--day";
  if (s.includes("evening") || s === "evening") return "sched-badge sched-badge--evening";
  if (s.includes("night") || s === "night") return "sched-badge sched-badge--night";
  return "sched-badge";
}

function statusBadgeClass(status) {
  const s = safeText(status).trim().toLowerCase();
  if (s === "active" || s === "available") return "sched-status sched-status--active";
  if (s === "inactive" || s === "unavailable" || s === "off") return "sched-status sched-status--inactive";
  if (s === "on leave" || s === "leave") return "sched-status sched-status--leave";
  return "sched-status sched-status--active";
}

function statusLabel(status) {
  const s = safeText(status).trim().toLowerCase();
  if (s === "active" || s === "available") return "Active";
  if (s === "inactive" || s === "unavailable") return "Inactive";
  if (s === "on leave" || s === "leave") return "On Leave";
  return safeText(status) || "—";
}

function getSearchIndex(worker) {
  return [
    safeText(worker.full_name),
    safeText(worker.department),
    safeText(worker.position),
    safeText(worker.shift_type),
    safeText(worker.status),
  ].join(" ").toLowerCase();
}

/**
 * Normalize a row from any table (workers, profiles, workforce)
 * into a standard worker object used by the scheduling UI.
 */
function normalizeWorker(row, source) {
  const base = {
    id: row.id || row.profile_id || "",
    full_name: row.full_name || "",
    email: row.email || "",
    department: row.department || "",
    position: row.position || "",
    phone: row.phone || "",
    status: row.status || row.availability || "active",
    shift_type: row.shift_type || "Day",
    employee_number: row.employee_number || row.employee_id || "",
    employment_type: row.employment_type || "",
    created_at: row.created_at || "",
    availability: row.availability || row.status || "available",
    _source: source,
  };
  return base;
}

/**
 * Fetch workers from ALL backend tables (workers, profiles, workforce)
 * and merge them into a single deduplicated array.
 */
async function fetchAllWorkers() {
  const results = [];

  // 1. Fetch from the `workers` table
  try {
    const { data, error } = await supabase
      .from("workers")
      .select("*")
      .limit(500);
    if (!error && Array.isArray(data)) {
      data.forEach((w) => {
        if (w.full_name) results.push(normalizeWorker(w, "workers"));
      });
    }
  } catch (e) {
    console.warn("scheduling: workers table fetch failed", e);
  }

  // 2. Fetch from `profiles` where role = 'worker'
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, department, position, phone, status, employee_id, created_at")
      .eq("role", "worker")
      .limit(500);
    if (!error && Array.isArray(data)) {
      data.forEach((p) => {
        if (p.full_name) results.push(normalizeWorker(p, "profiles"));
      });
    }
  } catch (e) {
    console.warn("scheduling: profiles table fetch failed", e);
  }

  // 3. Fetch from `workforce` table (with profile join info)
  try {
    const { data, error } = await supabase
      .from("workforce")
      .select("*, profiles!inner(id, full_name, email, department, position, phone, status)")
      .limit(500);
    if (!error && Array.isArray(data)) {
      data.forEach((wf) => {
        if (wf.profiles && wf.profiles.full_name) {
          const merged = {
            ...wf.profiles,
            shift_type: wf.shift_type,
            availability: wf.availability,
            employment_type: wf.employment_type,
            employee_number: wf.employee_number,
            created_at: wf.created_at || wf.profiles.created_at,
          };
          results.push(normalizeWorker(merged, "workforce"));
        }
      });
    }
  } catch (e) {
    console.warn("scheduling: workforce table fetch failed", e);
  }

  // Deduplicate by id + full_name
  const seen = new Set();
  const deduped = [];
  for (const w of results) {
    const key = `${safeText(w.id)}|${safeText(w.full_name)}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(w);
    }
  }

  // Sort by full_name
  deduped.sort((a, b) => safeText(a.full_name).localeCompare(safeText(b.full_name)));

  return deduped;
}

// ─── Banner HTML ──────────────────────────────────

function buildBannerHtml() {
  return `
    <div class="sched-banner">
      <div class="sched-banner-glow" aria-hidden="true"></div>
      <div class="sched-banner-left">
        <div class="sched-banner-icon" aria-hidden="true">📅</div>
        <div class="sched-banner-text">
          <h2 class="sched-banner-title">Shift Scheduling</h2>
          <p class="sched-banner-sub">Manage workforce shifts, worker availability, and attendance tracking.</p>
        </div>
      </div>
      <div class="sched-banner-right">
        <span class="sched-banner-badge">
          <span class="sched-banner-dot" aria-hidden="true"></span>
          Live
        </span>
      </div>
    </div>
  `;
}

// ─── KPI Cards ────────────────────────────────────

function buildKpiCardsHtml(stats) {
  return `
    <div class="sched-kpi-row">
      <div class="sched-kpi-card sched-kpi-card--blue">
        <div class="sched-kpi-head">
          <div class="sched-kpi-icon" aria-hidden="true">👥</div>
          <span class="sched-kpi-trend neutral">● Live</span>
        </div>
        <div class="sched-kpi-value">${stats.totalWorkers}</div>
        <div class="sched-kpi-label">Total Workforce</div>
        <div class="sched-kpi-desc">Registered workers across all departments</div>
      </div>

      <div class="sched-kpi-card sched-kpi-card--green">
        <div class="sched-kpi-head">
          <div class="sched-kpi-icon" aria-hidden="true">🟢</div>
          <span class="sched-kpi-trend neutral">● On Shift</span>
        </div>
        <div class="sched-kpi-value">${stats.onShift}</div>
        <div class="sched-kpi-label">On Shift</div>
        <div class="sched-kpi-desc">Workers currently clocked in / assigned today</div>
      </div>

      <div class="sched-kpi-card sched-kpi-card--orange">
        <div class="sched-kpi-head">
          <div class="sched-kpi-icon" aria-hidden="true">🟠</div>
          <span class="sched-kpi-trend neutral">● Available</span>
        </div>
        <div class="sched-kpi-value">${stats.available}</div>
        <div class="sched-kpi-label">Available</div>
        <div class="sched-kpi-desc">Workers ready for assignment / not on shift</div>
      </div>

      <div class="sched-kpi-card sched-kpi-card--purple">
        <div class="sched-kpi-head">
          <div class="sched-kpi-icon" aria-hidden="true">📋</div>
          <span class="sched-kpi-trend neutral">● Today</span>
        </div>
        <div class="sched-kpi-value">${stats.todayShifts}</div>
        <div class="sched-kpi-label">Today's Shifts</div>
        <div class="sched-kpi-desc">Total shift assignments for today</div>
      </div>
    </div>
  `;
}

// ─── Toolbar ──────────────────────────────────────

function buildToolbarHtml() {
  return `
    <div class="sched-toolbar">
      <div class="sched-toolbar-left">
        <div class="sched-search-wrap">
          <span class="sched-search-icon" aria-hidden="true">🔍</span>
          <input
            type="search"
            id="sched-search-input"
            class="sched-search"
            placeholder="Search by name, department, or position..."
            aria-label="Search workers"
          />
        </div>
        <select id="sched-shift-filter" class="sched-select" aria-label="Filter by shift">
          <option value="">All Shifts</option>
          <option value="Day">Day</option>
          <option value="Evening">Evening</option>
          <option value="Night">Night</option>
        </select>
        <select id="sched-status-filter" class="sched-select" aria-label="Filter by status">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div class="sched-toolbar-right">
        <button type="button" id="sched-refresh-btn" class="sched-btn sched-btn--ghost" aria-label="Refresh schedule">
          ⟳ Refresh
        </button>
      </div>
    </div>
  `;
}

// ─── Schedule Table ───────────────────────────────

function buildScheduleTableHtml(workers) {
  if (!workers || workers.length === 0) {
    return `
      <div class="sched-card">
        <div class="sched-card-title-row">
          <h3 class="sched-card-title">Today's Schedule</h3>
          <span class="sched-card-pill">0 Workers</span>
        </div>
        <div class="sched-empty">
          <div class="sched-empty-icon" aria-hidden="true">📅</div>
          <h3>No schedule entries found</h3>
          <p>Try adjusting your search or filter criteria.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="sched-card">
      <div class="sched-card-title-row">
        <h3 class="sched-card-title">Today's Schedule</h3>
        <span class="sched-card-pill">${workers.length} Workers</span>
      </div>
      <div class="sched-table-wrap">
        <table class="sched-table">
          <thead>
            <tr>
              <th>Worker</th>
              <th>Department</th>
              <th>Position</th>
              <th>Shift</th>
              <th>Status</th>
              <th>Employee ID</th>
            </tr>
          </thead>
          <tbody id="sched-table-body">
            ${workers.map((w) => buildScheduleRow(w)).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function buildScheduleRow(worker) {
  const name = safeText(worker.full_name, "Unknown");
  const dept = safeText(worker.department, "—");
  const position = safeText(worker.position, "—");
  const shift = shiftLabel(worker.shift_type);
  const shiftClass = shiftBadgeClass(worker.shift_type);
  const statusCls = statusBadgeClass(worker.status || worker.availability);
  const status = statusLabel(worker.status || worker.availability);
  const empId = safeText(worker.employee_number || worker.employee_id, "—");
  const workerId = safeText(worker.id);
  const email = safeText(worker.email, "");

  return `
    <tr class="sched-row" data-worker-id="${workerId}">
      <td>
        <div class="sched-worker-cell">
          <div class="sched-worker-avatar" aria-hidden="true">${name.charAt(0).toUpperCase()}</div>
          <div class="sched-worker-info">
            <div class="sched-worker-name">${name}</div>
            <div class="sched-worker-email">${email || "—"}</div>
          </div>
        </div>
      </td>
      <td>${dept}</td>
      <td>${position}</td>
      <td><span class="${shiftClass}">${shift}</span></td>
      <td><span class="${statusCls}">${status}</span></td>
      <td><span class="sched-emp-id">${empId}</span></td>
    </tr>
  `;
}

// ─── Availability Section ─────────────────────────

function buildAvailabilityHtml(available, unavailable) {
  return `
    <div class="sched-split">
      <div class="sched-card">
        <div class="sched-card-title-row">
          <h3 class="sched-card-title">🟢 Available Workers</h3>
          <span class="sched-card-pill good">${available.length} Ready</span>
        </div>
        ${available.length === 0
          ? `<div class="sched-empty"><p>No available workers at this time.</p></div>`
          : `<div class="sched-avail-list">
              ${available.map((w) => `
                <div class="sched-avail-item">
                  <div class="sched-avail-avatar" aria-hidden="true">${safeText(w.full_name).charAt(0).toUpperCase()}</div>
                  <div class="sched-avail-info">
                    <strong>${safeText(w.full_name)}</strong>
                    <span>${safeText(w.department, "—")} · ${safeText(w.position, "—")}</span>
                  </div>
                  <span class="sched-badge sched-badge--day">${shiftLabel(w.shift_type)}</span>
                </div>
              `).join("")}
            </div>`
        }
      </div>

      <div class="sched-card">
        <div class="sched-card-title-row">
          <h3 class="sched-card-title">🔴 Unavailable / On Leave</h3>
          <span class="sched-card-pill warn">${unavailable.length} Away</span>
        </div>
        ${unavailable.length === 0
          ? `<div class="sched-empty"><p>All workers are currently available.</p></div>`
          : `<div class="sched-avail-list">
              ${unavailable.map((w) => `
                <div class="sched-avail-item">
                  <div class="sched-avail-avatar sched-avail-avatar--inactive" aria-hidden="true">${safeText(w.full_name).charAt(0).toUpperCase()}</div>
                  <div class="sched-avail-info">
                    <strong>${safeText(w.full_name)}</strong>
                    <span>${safeText(w.department, "—")} · ${statusLabel(w.status || w.availability)}</span>
                  </div>
                  <span class="sched-status sched-status--inactive">${statusLabel(w.status || w.availability)}</span>
                </div>
              `).join("")}
            </div>`
        }
      </div>
    </div>
  `;
}

// ─── Details Panel ────────────────────────────────

function buildDetailsPanel(worker) {
  if (!worker) {
    return `
      <div class="sched-card">
        <div class="sched-card-title-row">
          <h3 class="sched-card-title">Worker Details</h3>
        </div>
        <div class="sched-empty">
          <div class="sched-empty-icon" aria-hidden="true">👤</div>
          <h3>Select a Worker</h3>
          <p>Click on a row in the schedule table to view full worker details.</p>
        </div>
      </div>
    `;
  }

  const name = safeText(worker.full_name, "Unknown");
  const email = safeText(worker.email, "—");
  const dept = safeText(worker.department, "—");
  const position = safeText(worker.position, "—");
  const shift = shiftLabel(worker.shift_type);
  const shiftClass = shiftBadgeClass(worker.shift_type);
  const statusCls = statusBadgeClass(worker.status || worker.availability);
  const status = statusLabel(worker.status || worker.availability);
  const empId = safeText(worker.employee_number || worker.employee_id, "—");
  const phone = safeText(worker.phone, "—");
  const createdAt = formatDate(worker.created_at);

  return `
    <div class="sched-card">
      <div class="sched-card-title-row">
        <h3 class="sched-card-title">${name}</h3>
        <div style="display:flex;gap:8px;">
          <span class="${shiftClass}">${shift}</span>
          <span class="${statusCls}">${status}</span>
        </div>
      </div>

      <div class="sched-detail-grid">
        <div class="sched-detail-item">
          <span class="sched-detail-label">Employee ID</span>
          <strong class="sched-detail-value">${empId}</strong>
        </div>
        <div class="sched-detail-item">
          <span class="sched-detail-label">Email</span>
          <strong class="sched-detail-value">${email}</strong>
        </div>
        <div class="sched-detail-item">
          <span class="sched-detail-label">Phone</span>
          <strong class="sched-detail-value">${phone}</strong>
        </div>
        <div class="sched-detail-item">
          <span class="sched-detail-label">Department</span>
          <strong class="sched-detail-value">${dept}</strong>
        </div>
        <div class="sched-detail-item">
          <span class="sched-detail-label">Position</span>
          <strong class="sched-detail-value">${position}</strong>
        </div>
        <div class="sched-detail-item">
          <span class="sched-detail-label">Created</span>
          <strong class="sched-detail-value">${createdAt}</strong>
        </div>
      </div>
    </div>
  `;
}

// ─── Main Load ────────────────────────────────────

export async function loadScheduling() {
  console.log("Loading Scheduling module");

  const panel = document.getElementById("schedule-root");
  if (!panel) {
    console.warn("Scheduling container missing");
    return;
  }

  // ─── Render Shell ──────────────────────────────
  panel.innerHTML = `
    <div class="sched-wrap">
      ${buildBannerHtml()}
      <div id="sched-kpis"></div>
      ${buildToolbarHtml()}
      <div id="sched-table-root"></div>
      <div id="sched-availability-root"></div>
      <div id="sched-details-root"></div>
    </div>
  `;

  const kpiRoot = document.getElementById("sched-kpis");
  const tableRoot = document.getElementById("sched-table-root");
  const availRoot = document.getElementById("sched-availability-root");
  const detailsRoot = document.getElementById("sched-details-root");

  // ─── Show Loading ──────────────────────────────
  kpiRoot.innerHTML = `<div class="sched-loading">Loading schedules...</div>`;
  tableRoot.innerHTML = `<div class="sched-loading">Loading workforce data...</div>`;

  // ─── Fetch Data from ALL backend tables ────────
  let allWorkers = [];
  let loadError = null;

  try {
    allWorkers = await fetchAllWorkers();
  } catch (err) {
    console.error("Scheduling data load failed:", err);
    loadError = err;
  }

  if (loadError) {
    panel.innerHTML = `
      <div class="sched-wrap">
        ${buildBannerHtml()}
        <div class="sched-card" style="padding:48px;text-align:center;">
          <div style="font-size:42px;margin-bottom:12px;">⚠️</div>
          <h3 style="margin:0 0 8px;color:var(--text-primary);">Failed to Load Schedule Data</h3>
          <p style="color:var(--text-secondary);">Unable to connect to the database. Please try again.</p>
          <button type="button" onclick="location.reload()" class="sched-btn sched-btn--primary" style="margin-top:16px;">
            ⟳ Retry
          </button>
        </div>
      </div>
    `;
    return;
  }

  // ─── Compute Stats ─────────────────────────────
  const totalWorkers = allWorkers.length;
  const onShift = allWorkers.filter((w) => {
    const s = safeText(w.status || w.availability).trim().toLowerCase();
    return s === "active" || s === "available";
  }).length;
  const available = allWorkers.filter((w) => {
    const s = safeText(w.status || w.availability).trim().toLowerCase();
    return s === "available";
  }).length;
  const todayShifts = allWorkers.filter((w) => {
    const s = safeText(w.shift_type).trim().toLowerCase();
    return s && s !== "";
  }).length;

  const stats = { totalWorkers, onShift, available, todayShifts };

  // ─── Render KPI ────────────────────────────────
  kpiRoot.innerHTML = buildKpiCardsHtml(stats);

  // ─── Render Table ──────────────────────────────
  const renderTable = (filteredWorkers) => {
    tableRoot.innerHTML = buildScheduleTableHtml(filteredWorkers);
  };

  const renderAvailability = (allWorkers) => {
    const availWorkers = allWorkers.filter((w) => {
      const s = safeText(w.status || w.availability).trim().toLowerCase();
      return s === "available" || s === "active";
    });
    const unavailWorkers = allWorkers.filter((w) => {
      const s = safeText(w.status || w.availability).trim().toLowerCase();
      return s !== "available" && s !== "active" && s !== "";
    });
    availRoot.innerHTML = buildAvailabilityHtml(availWorkers, unavailWorkers);
  };

  // Initial render
  renderTable(allWorkers);
  renderAvailability(allWorkers);
  detailsRoot.innerHTML = buildDetailsPanel(null);

  // ─── Search & Filter Wiring ────────────────────
  const searchInput = document.getElementById("sched-search-input");
  const shiftFilter = document.getElementById("sched-shift-filter");
  const statusFilter = document.getElementById("sched-status-filter");
  const refreshBtn = document.getElementById("sched-refresh-btn");

  function applyFilters() {
    const searchTerm = searchInput ? safeText(searchInput.value).trim().toLowerCase() : "";
    const shiftVal = shiftFilter ? shiftFilter.value : "";
    const statusVal = statusFilter ? statusFilter.value : "";

    let filtered = allWorkers;

    if (searchTerm) {
      filtered = filtered.filter((w) => getSearchIndex(w).includes(searchTerm));
    }

    if (shiftVal) {
      filtered = filtered.filter((w) => shiftLabel(w.shift_type) === shiftVal);
    }

    if (statusVal) {
      filtered = filtered.filter((w) => {
        const s = safeText(w.status || w.availability).trim().toLowerCase();
        return s === statusVal;
      });
    }

    renderTable(filtered);
    renderAvailability(filtered);
  }

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (shiftFilter) shiftFilter.addEventListener("change", applyFilters);
  if (statusFilter) statusFilter.addEventListener("change", applyFilters);
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadScheduling();
    });
  }

  // ─── Row Click → Details ───────────────────────
  tableRoot.addEventListener("click", (e) => {
    const tr = e.target.closest(".sched-row");
    if (!tr) return;
    const workerId = tr.getAttribute("data-worker-id");
    const worker = allWorkers.find((w) => safeText(w.id) === workerId);
    if (worker) {
      detailsRoot.innerHTML = buildDetailsPanel(worker);
    }
  });

  console.log("Scheduling module loaded successfully —", allWorkers.length, "workers across all data sources");
}

