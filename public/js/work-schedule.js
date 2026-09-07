/* ============================================
   Worker Dashboard — Scheduling Module (Premium)
   Uses enterprise-redesign.css scheduling classes
   ============================================ */

import { supabase } from "./supabaseClient.js";

function rootEl() {
  return document.querySelector("[data-work-schedule-root]");
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value ?? "—");
}

/* ── Helper: Format time nicely ── */
function formatTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function formatRelative(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = now - d;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return formatDate(iso);
  } catch {
    return "";
  }
}

/* ── Shift Definitions ── */
const SHIFT_DEFS = [
  {
    id: "morning",
    label: "Morning",
    emoji: "🌅",
    time: "06:00 – 14:00",
    className: "sched-badge--day",
    iconClass: "wfc-badge--day",
  },
  {
    id: "evening",
    label: "Evening",
    emoji: "🌇",
    time: "14:00 – 22:00",
    className: "sched-badge--evening",
    iconClass: "wfc-badge--eve",
  },
  {
    id: "night",
    label: "Night",
    emoji: "🌙",
    time: "22:00 – 06:00",
    className: "sched-badge--night",
    iconClass: "wfc-badge--night",
  },
];

/* ── Renders the full premium scheduling interface ── */
function renderPremiumSchedule(profiles, tickets, incidents) {
  const root = rootEl();
  if (!root) return;

  const totalWorkers = Array.isArray(profiles) ? profiles.length : 0;
  const activeWorkers = Array.isArray(profiles)
    ? profiles.filter((p) => String(p.status || "active").toLowerCase() === "active").length
    : 0;

  const openTickets = Array.isArray(tickets)
    ? tickets.filter((t) => !["Resolved", "Closed"].includes(String(t.status || ""))).length
    : 0;

  const pendingIncidents = Array.isArray(incidents)
    ? incidents.filter((i) => String(i.status || "Pending").toLowerCase() !== "resolved").length
    : 0;

  /* ── Shift assignment distribution (simulated) ── */
  const morningWorkers = [];
  const eveningWorkers = [];
  const nightWorkers = [];
  const unavailableWorkers = [];

  if (Array.isArray(profiles)) {
    profiles.forEach((p, idx) => {
      const status = String(p.status || "active").toLowerCase();
      if (status !== "active") {
        unavailableWorkers.push(p);
        return;
      }
      const mod = idx % 3;
      if (mod === 0) morningWorkers.push(p);
      else if (mod === 1) eveningWorkers.push(p);
      else nightWorkers.push(p);
    });
  }

  const shiftAssignments = [
    { def: SHIFT_DEFS[0], workers: morningWorkers },
    { def: SHIFT_DEFS[1], workers: eveningWorkers },
    { def: SHIFT_DEFS[2], workers: nightWorkers },
  ];

  const totalAssigned = morningWorkers.length + eveningWorkers.length + nightWorkers.length;
  const coveragePct = totalWorkers > 0 ? Math.round((totalAssigned / totalWorkers) * 100) : 0;

  root.innerHTML = `
    <div class="sched-wrap">

      <!-- ── Premium Banner ── -->
      <div class="sched-banner">
        <div class="sched-banner-glow"></div>
        <div class="sched-banner-left">
          <div class="sched-banner-icon">📅</div>
          <div class="sched-banner-text">
            <h2 class="sched-banner-title">Work Schedule & Shifts</h2>
            <p class="sched-banner-sub">Shift assignments, daily roster, worker availability and attendance tracking</p>
          </div>
        </div>
        <div class="sched-banner-right">
          <span class="sched-banner-badge">
            <span class="sched-banner-dot"></span>
            Active — ${activeWorkers} online
          </span>
        </div>
      </div>

      <!-- ── KPI Row ── -->
      <div class="sched-kpi-row">
        <div class="sched-kpi-card sched-kpi-card--blue">
          <div class="sched-kpi-head">
            <div class="sched-kpi-icon">👷</div>
            <span class="sched-kpi-trend neutral">● ${totalWorkers} total</span>
          </div>
          <div class="sched-kpi-value" id="sched-kpi-workers">${totalAssigned}</div>
          <div class="sched-kpi-label">Workers on Shift</div>
          <div class="sched-kpi-desc">Currently assigned to today's shift roster</div>
        </div>
        <div class="sched-kpi-card sched-kpi-card--green">
          <div class="sched-kpi-head">
            <div class="sched-kpi-icon">📊</div>
            <span class="sched-kpi-trend neutral">● ${coveragePct}%</span>
          </div>
          <div class="sched-kpi-value">${totalWorkers}</div>
          <div class="sched-kpi-label">Total Workforce</div>
          <div class="sched-kpi-desc">Registered workers in the mine operations</div>
        </div>
        <div class="sched-kpi-card sched-kpi-card--orange">
          <div class="sched-kpi-head">
            <div class="sched-kpi-icon">📋</div>
            <span class="sched-kpi-trend neutral">● Open</span>
          </div>
          <div class="sched-kpi-value">${openTickets}</div>
          <div class="sched-kpi-label">Open Requests</div>
          <div class="sched-kpi-desc">Pending schedule change requests and shift swaps</div>
        </div>
        <div class="sched-kpi-card sched-kpi-card--purple">
          <div class="sched-kpi-head">
            <div class="sched-kpi-icon">🛡️</div>
            <span class="sched-kpi-trend neutral">● Active</span>
          </div>
          <div class="sched-kpi-value">${pendingIncidents}</div>
          <div class="sched-kpi-label">Safety Alerts</div>
          <div class="sched-kpi-desc">Active safety-related attendance flags</div>
        </div>
      </div>

      <!-- ── Toolbar ── -->
      <div class="sched-toolbar">
        <div class="sched-toolbar-left">
          <div class="sched-search-wrap">
            <span class="sched-search-icon">🔍</span>
            <input type="text" class="sched-search" id="sched-search-input" placeholder="Search workers, shifts, or departments..." aria-label="Search schedule" />
          </div>
          <select class="sched-select" id="sched-filter-shift">
            <option value="all">All Shifts</option>
            <option value="morning">🌅 Morning</option>
            <option value="evening">🌇 Evening</option>
            <option value="night">🌙 Night</option>
          </select>
          <select class="sched-select" id="sched-filter-status">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="leave">On Leave</option>
          </select>
        </div>
        <div class="sched-toolbar-right">
          <button class="sched-btn sched-btn--ghost" type="button" id="sched-btn-refresh">🔄 Refresh</button>
          <button class="sched-btn sched-btn--primary" type="button" id="sched-btn-roster">📋 Full Roster</button>
        </div>
      </div>

      <!-- ── Shift Schedule Table ── -->
      <div class="sched-card">
        <div class="sched-card-title-row">
          <h3 class="sched-card-title">Today's Shift Schedule</h3>
          <span class="sched-card-pill good">${formatDate(new Date().toISOString())}</span>
        </div>
        <div class="sched-table-wrap">
          <table class="sched-table">
            <thead>
              <tr>
                <th>Shift</th>
                <th>Time</th>
                <th>Workers Assigned</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${shiftAssignments
                .map(
                  (s) => `
                <tr class="sched-row">
                  <td>
                    <span class="sched-badge ${s.def.className}">${s.def.emoji} ${s.def.label}</span>
                  </td>
                  <td><span class="sched-emp-id">${s.def.time}</span></td>
                  <td>
                    <div class="sched-worker-cell">
                      <span style="font-weight:800;font-size:15px;color:var(--text-primary)">${s.workers.length}</span>
                      <span style="font-size:12px;color:var(--text-secondary)">worker${s.workers.length !== 1 ? "s" : ""}</span>
                    </div>
                  </td>
                  <td>
                    <span class="sched-status sched-status--active">● ${s.workers.length > 0 ? "Active" : "Unfilled"}</span>
                  </td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
        ${totalWorkers === 0 ? `<div class="sched-empty"><div class="sched-empty-icon">📅</div><h3>No workers loaded</h3><p>Worker profiles will appear here once synchronized.</p></div>` : ""}
      </div>

      <!-- ── Worker Availability (below shift table) ── -->
      <div class="sched-card">
        <div class="sched-card-title-row">
          <h3 class="sched-card-title">Worker Availability</h3>
          <span class="sched-card-pill">${unavailableWorkers.length} unavailable</span>
        </div>
        <div class="sched-avail-list">
          ${availableWorkersList(profiles)}
        </div>
      </div>

      <!-- ── Bottom Detail Grid ── -->
      <div class="sched-card">
        <div class="sched-card-title-row">
          <h3 class="sched-card-title">Shift Summary</h3>
          <span class="sched-card-pill good">Today</span>
        </div>
        <div class="sched-detail-grid">
          <div class="sched-detail-item">
            <span class="sched-detail-label">Total Workers</span>
            <strong class="sched-detail-value">${totalWorkers}</strong>
          </div>
          <div class="sched-detail-item">
            <span class="sched-detail-label">Active on Shift</span>
            <strong class="sched-detail-value">${totalAssigned}</strong>
          </div>
          <div class="sched-detail-item">
            <span class="sched-detail-label">Unavailable</span>
            <strong class="sched-detail-value">${unavailableWorkers.length}</strong>
          </div>
          <div class="sched-detail-item">
            <span class="sched-detail-label">Shift Coverage</span>
            <strong class="sched-detail-value">${coveragePct}%</strong>
          </div>
          <div class="sched-detail-item">
            <span class="sched-detail-label">Morning Shift</span>
            <strong class="sched-detail-value">${morningWorkers.length} workers</strong>
          </div>
          <div class="sched-detail-item">
            <span class="sched-detail-label">Evening Shift</span>
            <strong class="sched-detail-value">${eveningWorkers.length} workers</strong>
          </div>
          <div class="sched-detail-item">
            <span class="sched-detail-label">Night Shift</span>
            <strong class="sched-detail-value">${nightWorkers.length} workers</strong>
          </div>
          <div class="sched-detail-item">
            <span class="sched-detail-label">Open Requests</span>
            <strong class="sched-detail-value">${openTickets}</strong>
          </div>
          <div class="sched-detail-item">
            <span class="sched-detail-label">Pending Safety Flags</span>
            <strong class="sched-detail-value">${pendingIncidents}</strong>
          </div>
        </div>
      </div>

    </div>
  `;

  /* ── Bind toolbar events ── */
  const searchInput = document.getElementById("sched-search-input");
  const shiftFilter = document.getElementById("sched-filter-shift");
  const statusFilter = document.getElementById("sched-filter-status");
  const refreshBtn = document.getElementById("sched-btn-refresh");
  const rosterBtn = document.getElementById("sched-btn-roster");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      filterTable(e.target.value, shiftFilter?.value || "all", statusFilter?.value || "all");
    });
  }
  if (shiftFilter) {
    shiftFilter.addEventListener("change", () => {
      filterTable(searchInput?.value || "", shiftFilter.value, statusFilter?.value || "all");
    });
  }
  if (statusFilter) {
    statusFilter.addEventListener("change", () => {
      filterTable(searchInput?.value || "", shiftFilter?.value || "all", statusFilter.value);
    });
  }
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      initWorkSchedule();
    });
  }
  if (rosterBtn) {
    rosterBtn.addEventListener("click", () => {
      alert("Full roster view coming soon with detailed worker assignment management.");
    });
  }
}

/* ── Generate available workers list ── */
function availableWorkersList(profiles) {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return `<div class="sched-avail-item" style="justify-content:center;padding:24px;text-align:center;color:var(--text-secondary)">
      <span>No worker profiles loaded yet.</span>
    </div>`;
  }

  const available = profiles.filter((p) => String(p.status || "active").toLowerCase() === "active");
  const unavailable = profiles.filter((p) => String(p.status || "active").toLowerCase() !== "active");

  const items = [];

  // Show first 3 available (balanced with left table rows)
  available.slice(0, 3).forEach((p) => {
    const initials = getInitials(p.full_name || p.email || "W");
    items.push(`
      <div class="sched-avail-item">
        <div class="sched-avail-avatar">${initials}</div>
        <div class="sched-avail-info">
          <strong>${p.full_name || p.email || "Worker"}</strong>
          <span>${p.department || "Mining Operations"}</span>
        </div>
        <span class="sched-status sched-status--active">Available</span>
      </div>
    `);
  });

  // Show first 3 unavailable
  unavailable.slice(0, 3).forEach((p) => {
    const initials = getInitials(p.full_name || p.email || "W");
    const statusLabel = String(p.status || "inactive");
    items.push(`
      <div class="sched-avail-item">
        <div class="sched-avail-avatar sched-avail-avatar--inactive">${initials}</div>
        <div class="sched-avail-info">
          <strong>${p.full_name || p.email || "Worker"}</strong>
          <span>${p.department || "Mining Operations"} • ${statusLabel}</span>
        </div>
        <span class="sched-status sched-status--inactive">${statusLabel}</span>
      </div>
    `);
  });

  if (items.length === 0) {
    items.push(`
      <div class="sched-avail-item" style="justify-content:center;padding:24px;text-align:center;color:var(--text-secondary)">
        <span>No availability data available.</span>
      </div>
    `);
  }

  return items.join("");
}

/* ── Get initials from name ── */
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

/* ── Filter the table rows ── */
function filterTable(query, shiftFilter, statusFilter) {
  const rows = document.querySelectorAll(".sched-row");
  const q = (query || "").toLowerCase().trim();

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    let visible = true;

    if (q && !text.includes(q)) visible = false;

    // Shift filter is for display — we just check text content
    if (shiftFilter && shiftFilter !== "all") {
      const shiftName = SHIFT_DEFS.find((s) => s.id === shiftFilter)?.label.toLowerCase() || "";
      if (shiftName && !text.includes(shiftName)) visible = false;
    }

    row.style.display = visible ? "" : "none";
  });
}

/* ── Main initialization ── */
export async function initWorkSchedule() {
  const root = rootEl();
  if (!root) return;

  // Show loading state
  root.innerHTML = `<div class="sched-loading">📅 Loading schedule data...</div>`;

  try {
    // Fetch profiles (workers), tickets, and safety incidents for dashboard KPIs
    const [profilesRes, ticketsRes, incidentsRes] = await Promise.allSettled([
      supabase
        .from("profiles")
        .select("id, full_name, email, department, position, status, avatar_url")
        .in("role", ["worker", "employee"])
        .order("full_name", { ascending: true }),
      supabase
        .from("tickets")
        .select("status, worker_id, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("safety_incidents")
        .select("status, severity, worker_id, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const profiles = profilesRes.status === "fulfilled" ? profilesRes.value.data || [] : [];
    const tickets = ticketsRes.status === "fulfilled" ? ticketsRes.value.data || [] : [];
    const incidents = incidentsRes.status === "fulfilled" ? incidentsRes.value.data || [] : [];

    renderPremiumSchedule(profiles, tickets, incidents);
  } catch (err) {
    console.error("initWorkSchedule: error loading data", err);
    root.innerHTML = `
      <div class="sched-wrap">
        <div class="sched-card" style="padding:28px;text-align:center">
          <div class="sched-empty-icon">⚠️</div>
          <h3 style="margin:8px 0 4px;font-size:16px;font-weight:900;color:var(--text-primary)">Unable to Load Schedule</h3>
          <p style="margin:0;font-size:13px;color:var(--text-secondary)">${err.message || "Database connection error"}</p>
          <button class="sched-btn sched-btn--primary" type="button" style="margin-top:16px" onclick="location.reload()">Retry</button>
        </div>
      </div>
    `;
  }
}

