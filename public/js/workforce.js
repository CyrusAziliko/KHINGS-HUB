import { supabase } from "./supabaseClient.js";
import { loadWorkforceHeatmap } from "./workforce-heatmap.js";
import { runWorkforceOptimizer } from "./workforce-ai-optimizer.js";

/**
 * WORKFORCE CREW HUB — Premium Industrial Theme
 * Renders into [data-workforce-root] using wfc-* CSS classes from enterprise-redesign.css
 * Aggregates staff profiles + tickets + heatmap + AI insights.
 */

export async function initWorkforce() {
  const root = document.querySelector("[data-workforce-root]");
  if (!root) return;

  // Prevent double render
  if (root.dataset.workforceRendered === "true") return;

  // ── 1. Fetch real data ──
  const [profilesRes, ticketsRes] = await Promise.allSettled([
    supabase.from("profiles").select("id, full_name, role, department, status, avatar_url"),
    supabase.from("tickets").select("id, title, status, priority, created_at, worker_id"),
  ]);

  const profiles = (profilesRes.status === "fulfilled" ? profilesRes.value.data : []) || [];
  const tickets = (ticketsRes.status === "fulfilled" ? ticketsRes.value.data : []) || [];

  // Compute stats
  const totalWorkers = profiles.length;
  const workersOnShift = profiles.filter(p => String(p.status || "").toLowerCase() === "active").length;
  const workersOnBreak = profiles.filter(p => {
    const s = String(p.status || "").toLowerCase();
    return s === "break" || s === "away" || s === "offline";
  }).length;
  const departments = [...new Set(profiles.map(p => p.department).filter(Boolean))];
  const totalTickets = tickets.length;

  // ── 2. Render Shell ──
  root.innerHTML = `
    <div class="wfc-ctl">

      <!-- ═══ HERO BANNER ═══ -->
      <div class="wfc-hero">
        <div class="wfc-hero-bg"></div>
        <div class="wfc-hero-row">
          <div class="wfc-hero-brand">
            <div class="wfc-hero-icon">👷</div>
            <div>
              <h2 class="wfc-hero-title">Crew Command Center</h2>
              <p class="wfc-hero-sub">Live workforce intelligence &amp; operational hub</p>
            </div>
          </div>
          <div class="wfc-hero-meta">
            <span class="wfc-hero-pulse"></span>
            <span class="wfc-hero-live">Live</span>
          </div>
        </div>
      </div>

      <!-- ═══ INLINE STATS BAR ═══ -->
      <div class="wfc-stats">
        <div class="wfc-stat-item">
          <span class="wfc-stat-num wfc-stat-num--ok">${totalWorkers}</span>
          <span class="wfc-stat-label">Total Crew</span>
        </div>
        <div class="wfc-stat-div"></div>
        <div class="wfc-stat-item">
          <span class="wfc-stat-num wfc-stat-num--info">${workersOnShift}</span>
          <span class="wfc-stat-label">Active Shift</span>
        </div>
        <div class="wfc-stat-div"></div>
        <div class="wfc-stat-item">
          <span class="wfc-stat-num wfc-stat-num--warn">${workersOnBreak}</span>
          <span class="wfc-stat-label">On Break</span>
        </div>
        <div class="wfc-stat-div"></div>
        <div class="wfc-stat-item">
          <span class="wfc-stat-num">${departments.length}</span>
          <span class="wfc-stat-label">Departments</span>
        </div>
        <div class="wfc-stat-div"></div>
        <div class="wfc-stat-item">
          <span class="wfc-stat-num wfc-stat-num--info">${totalTickets}</span>
          <span class="wfc-stat-label">Open Work Orders</span>
        </div>
      </div>

      <!-- ═══ TOOLBAR ═══ -->
      <div class="wfc-bar">
        <div class="wfc-bar-left">
          <div class="wfc-search-wrap">
            <span class="wfc-search-ico">🔍</span>
            <input type="text" class="wfc-search" id="wfc-search-input" placeholder="Search by name, role, department..." aria-label="Search workforce" />
          </div>
          <select class="wfc-pick" id="wfc-dept-filter" aria-label="Filter by department">
            <option value="">All Departments</option>
            ${departments.map(d => `<option value="${d}">${d}</option>`).join("")}
          </select>
          <div class="wfc-toggle" id="wfc-shift-toggle" role="group" aria-label="Shift filter">
            <button class="wfc-toggle-btn active" data-shift="all" type="button">All</button>
            <button class="wfc-toggle-btn" data-shift="active" type="button">Active</button>
            <button class="wfc-toggle-btn" data-shift="break" type="button">Break</button>
          </div>
        </div>
        <div class="wfc-bar-right">
          <span class="wfc-chip wfc-chip--ok">${totalWorkers} crew</span>
        </div>
      </div>

      <!-- ═══ CREW TABLE PANEL ═══ -->
      <div class="wfc-panel" id="wfc-crew-panel">
        <div class="wfc-panel-head">
          <h3 class="wfc-panel-title">👥 Crew Roster</h3>
          <div class="wfc-panel-head-acts">
            <span class="wfc-chip" id="wfc-crew-count">${totalWorkers}</span>
          </div>
        </div>
        <div class="wfc-scroll" id="wfc-crew-table-wrap">
          <table class="wfc-tbl" id="wfc-crew-table">
            <thead>
              <tr>
                <th style="width:32%">Worker</th>
                <th style="width:18%">Role</th>
                <th style="width:20%">Department</th>
                <th style="width:14%">Shift</th>
                <th style="width:16%">Status</th>
              </tr>
            </thead>
            <tbody id="wfc-crew-body">
              ${renderCrewRows(profiles)}
            </tbody>
          </table>
        </div>
      </div>

      <!-- ═══ WORKLOAD HEATMAP ═══ -->
      <div class="wfc-panel">
        <div class="wfc-panel-head">
          <h3 class="wfc-panel-title">📊 Workload Heatmap</h3>
          <span class="wfc-chip">Weekly view</span>
        </div>
        <div id="wfc-heatmap-container"></div>
      </div>

      <!-- ═══ AI INTELLIGENCE ═══ -->
      <div class="wfc-panel">
        <div class="wfc-panel-head">
          <h3 class="wfc-panel-title">🧠 AI Workload Intelligence</h3>
          <span class="wfc-chip">Live</span>
        </div>
        <div id="wfc-ai-container"></div>
      </div>

      <!-- ═══ DETAIL SECTION (hidden by default, shown on row click) ═══ -->
      <div class="wfc-panel" id="wfc-detail-panel" style="display:none">
        <div class="wfc-panel-head">
          <h3 class="wfc-panel-title" id="wfc-detail-name">Worker Details</h3>
          <button class="wfc-action" id="wfc-detail-close" type="button">✕ Close</button>
        </div>
        <div id="wfc-detail-body"></div>
      </div>

    </div>
  `;

  root.dataset.workforceRendered = "true";

  // ── 3. Mount sub-modules ──
  try {
    await loadWorkforceHeatmapModule();
  } catch (e) {
    console.warn("workforce heatmap load failed", e);
  }
  try {
    await loadWorkforceAiModule();
  } catch (e) {
    console.warn("workforce AI load failed", e);
  }

  // ── 4. Attach event listeners ──
  attachWorkforceListeners(profiles);

  // ── 5. Subscribe to realtime changes ──
  subscribeWorkforceRealtime();
}

/* ═══════════════════════════════════════════
   RENDER HELPERS
   ═══════════════════════════════════════════ */

function renderCrewRows(profiles) {
  if (!profiles || profiles.length === 0) {
    return `<tr><td colspan="5"><div class="wfc-null"><div class="wfc-null-ico">👷</div><h3>No crew members found</h3><p>No worker profiles are available yet.</p></div></td></tr>`;
  }

  return profiles.map(p => {
    const name = p.full_name || "Unknown Worker";
    const initial = name.trim().charAt(0).toUpperCase() || "U";
    const role = p.role || "—";
    const dept = p.department || "Unassigned";
    const status = String(p.status || "inactive").toLowerCase();
    const shiftBadge = getShiftBadge(status);
    const statusBadge = getStatusBadge(status);

    return `
      <tr class="wfc-row" data-worker-id="${p.id}" data-worker-dept="${dept}" data-worker-status="${status}" data-worker-name="${name.toLowerCase()}">
        <td>
          <div class="wfc-wcell">
            <div class="wfc-av">${initial}</div>
            <div class="wfc-win">
              <div class="wfc-wname">${name}</div>
              <span class="wfc-wemail">${p.role ? p.role.toLowerCase().replace(/_/g, " ") : "team member"}</span>
            </div>
          </div>
        </td>
        <td><span class="wfc-eid">${role}</span></td>
        <td>${dept}</td>
        <td>${shiftBadge}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join("");
}

function getShiftBadge(status) {
  if (status === "active") return `<span class="wfc-badge wfc-badge--day">Day</span>`;
  if (status === "break" || status === "away") return `<span class="wfc-badge wfc-badge--eve">Break</span>`;
  return `<span class="wfc-badge wfc-badge--night">Off</span>`;
}

function getStatusBadge(status) {
  if (status === "active") return `<span class="wfc-st wfc-st--on">On Shift</span>`;
  if (status === "break" || status === "away") return `<span class="wfc-st wfc-st--away">Break</span>`;
  return `<span class="wfc-st wfc-st--off">Offline</span>`;
}

function renderWorkerDetail(worker) {
  if (!worker) return `<div class="wfc-null"><p>No data available</p></div>`;

  const name = worker.full_name || "Unknown";
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  const status = String(worker.status || "inactive").toLowerCase();
  const statusBadge = getStatusBadge(status);
  const shiftBadge = getShiftBadge(status);

  return `
    <div class="wfc-avail-bar-wrap">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
        <div class="wfc-av" style="width:48px;height:48px;font-size:20px;border-radius:12px;">${initial}</div>
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--text-primary)">${name}</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-top:2px">${worker.role || "Team Member"} • ${worker.department || "Unassigned"}</div>
        </div>
      </div>
      <div class="wfc-detail">
        <div class="wfc-detail-i">
          <span>Status</span>
          <strong>${statusBadge}</strong>
        </div>
        <div class="wfc-detail-i">
          <span>Shift</span>
          <strong>${shiftBadge}</strong>
        </div>
        <div class="wfc-detail-i">
          <span>Role</span>
          <strong>${worker.role || "—"}</strong>
        </div>
        <div class="wfc-detail-i">
          <span>Department</span>
          <strong>${worker.department || "Unassigned"}</strong>
        </div>
        <div class="wfc-detail-i">
          <span>Worker ID</span>
          <strong style="font-family:monospace;font-size:12px;">${worker.id ? worker.id.slice(0, 12) + "..." : "—"}</strong>
        </div>
        <div class="wfc-detail-i">
          <span>Assigned Tickets</span>
          <strong>—</strong>
        </div>
      </div>
    </div>
  `;
}

/* ═══════════════════════════════════════════
   EVENT LISTENERS
   ═══════════════════════════════════════════ */

function attachWorkforceListeners(profiles) {
  // ── Search ──
  const searchInput = document.getElementById("wfc-search-input");
  searchInput?.addEventListener("input", () => {
    filterCrewTable(profiles);
  });

  // ── Department filter ──
  const deptFilter = document.getElementById("wfc-dept-filter");
  deptFilter?.addEventListener("change", () => {
    filterCrewTable(profiles);
  });

  // ── Shift toggle ──
  const toggleBtns = document.querySelectorAll("#wfc-shift-toggle .wfc-toggle-btn");
  toggleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      toggleBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filterCrewTable(profiles);
    });
  });

  // ── Row click → detail ──
  const tbody = document.getElementById("wfc-crew-body");
  tbody?.addEventListener("click", (e) => {
    const row = e.target.closest(".wfc-row");
    if (!row) return;
    const workerId = row.dataset.workerId;
    const worker = profiles.find(p => p.id === workerId);
    if (!worker) return;

    const detailPanel = document.getElementById("wfc-detail-panel");
    const detailBody = document.getElementById("wfc-detail-body");
    const detailName = document.getElementById("wfc-detail-name");
    if (detailPanel && detailBody && detailName) {
      detailName.textContent = `👤 ${worker.full_name || "Worker"}`;
      detailBody.innerHTML = renderWorkerDetail(worker);
      detailPanel.style.display = "block";
      detailPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  // ── Detail close ──
  const closeBtn = document.getElementById("wfc-detail-close");
  closeBtn?.addEventListener("click", () => {
    const detailPanel = document.getElementById("wfc-detail-panel");
    if (detailPanel) detailPanel.style.display = "none";
  });
}

function filterCrewTable(allProfiles) {
  const searchTerm = (document.getElementById("wfc-search-input")?.value || "").toLowerCase().trim();
  const deptValue = document.getElementById("wfc-dept-filter")?.value || "";
  const activeShift = document.querySelector("#wfc-shift-toggle .wfc-toggle-btn.active")?.dataset.shift || "all";

  let filtered = allProfiles;

  // Search filter
  if (searchTerm) {
    filtered = filtered.filter(p => {
      const name = (p.full_name || "").toLowerCase();
      const role = (p.role || "").toLowerCase();
      const dept = (p.department || "").toLowerCase();
      return name.includes(searchTerm) || role.includes(searchTerm) || dept.includes(searchTerm);
    });
  }

  // Department filter
  if (deptValue) {
    filtered = filtered.filter(p => p.department === deptValue);
  }

  // Shift filter
  if (activeShift === "active") {
    filtered = filtered.filter(p => String(p.status || "").toLowerCase() === "active");
  } else if (activeShift === "break") {
    filtered = filtered.filter(p => {
      const s = String(p.status || "").toLowerCase();
      return s === "break" || s === "away";
    });
  }

  const tbody = document.getElementById("wfc-crew-body");
  const countBadge = document.getElementById("wfc-crew-count");
  if (tbody) {
    tbody.innerHTML = renderCrewRows(filtered);
  }
  if (countBadge) {
    countBadge.textContent = filtered.length;
  }
}

/* ═══════════════════════════════════════════
   SUB-MODULE MOUNTS
   ═══════════════════════════════════════════ */

async function loadWorkforceHeatmapModule() {
  const container = document.getElementById("wfc-heatmap-container");
  if (!container) return;

  // Create a mock panel object that the heatmap module expects
  const mockPanel = {
    querySelector: (sel) => {
      if (sel === "#workforce-heatmap") return container;
      return null;
    }
  };

  await loadWorkforceHeatmap(mockPanel);
}

async function loadWorkforceAiModule() {
  const container = document.getElementById("wfc-ai-container");
  if (!container) return;

  // Create a mock panel object that the AI optimizer expects
  const mockPanel = {
    querySelector: (sel) => {
      if (sel === "#workforce-ai") return container;
      return null;
    }
  };

  await runWorkforceOptimizer(mockPanel);

  // Enhance the AI output with premium styling
  const aiContent = container.innerHTML;
  if (aiContent) {
    container.innerHTML = `
      <div style="padding:12px 18px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          <span style="font-size:24px;">🧠</span>
          <div>
            <div style="font-size:14px;font-weight:800;color:var(--text-primary);">System Intelligence</div>
            <div style="font-size:11px;color:var(--text-secondary);font-weight:600;">Real-time workload analysis</div>
          </div>
        </div>
        <div style="background:var(--border-light);border-radius:8px;padding:14px;border:1px solid var(--border-color);font-size:13px;line-height:1.6;color:var(--text-secondary);">
          ${aiContent}
        </div>
      </div>
    `;
  }
}

/* ═══════════════════════════════════════════
   REALTIME SUBSCRIPTION
   ═══════════════════════════════════════════ */

function subscribeWorkforceRealtime() {
  const channel = supabase
    .channel("workforce-crew-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, async () => {
      // Re-fetch and re-render on profile changes
      const [profilesRes] = await Promise.allSettled([
        supabase.from("profiles").select("id, full_name, role, department, status, avatar_url")
      ]);
      const profiles = (profilesRes.status === "fulfilled" ? profilesRes.value.data : []) || [];
      const tbody = document.getElementById("wfc-crew-body");
      const countBadge = document.getElementById("wfc-crew-count");
      if (tbody) tbody.innerHTML = renderCrewRows(profiles);
      if (countBadge) countBadge.textContent = profiles.length;
    })
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.warn("workforce realtime channel error");
      }
    });
}


