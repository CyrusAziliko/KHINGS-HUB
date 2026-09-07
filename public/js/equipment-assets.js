import { supabase } from "./supabaseClient.js";
import { createTicket } from "./services/ticketService.js";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function rootEl() {
  return document.querySelector("[data-equipment-assets-root]");
}

function formatDate(input) {
  if (!input) return "—";
  try {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return "—";
  }
}

function normalizeStr(v) {
  return (v ?? "").toString().trim();
}

function statusToTone(status) {
  const s = normalizeStr(status).toLowerCase();
  if (!s) return "unknown";
  if (s.includes("active") || s.includes("running") || s.includes("in use")) return "good";
  if (s.includes("idle") || s.includes("standby")) return "warn";
  if (s.includes("offline") || s.includes("down") || s.includes("fault") || s.includes("broken")) return "bad";
  if (s.includes("needs") || s.includes("service") || s.includes("maintenance")) return "warn";
  return "unknown";
}

function healthScore(item) {
  const tone = statusToTone(item.status);
  let base = tone === "good" ? 100 : tone === "warn" ? 65 : tone === "bad" ? 30 : 50;

  // Condition bonus/penalty
  const cond = normalizeStr(item.condition).toLowerCase();
  if (cond.includes("new") || cond.includes("excellent")) base += 10;
  else if (cond.includes("fair") || cond.includes("used")) base -= 10;
  else if (cond.includes("poor") || cond.includes("damaged")) base -= 25;

  // Service recency penalty
  const now = Date.now();
  if (item.next_service_date) {
    const next = new Date(item.next_service_date).getTime();
    if (!Number.isNaN(next)) {
      const daysUntil = (next - now) / 86400000;
      if (daysUntil < 0) base -= 20; // overdue
      else if (daysUntil < 7) base -= 10; // due soon
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

function renderMaintenanceAlerts(equipment) {
  const host = rootEl()?.querySelector("[data-eq-alerts]");
  if (!host) return;

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

  if (!alerts.length) {
    host.innerHTML = "";
    return;
  }

  host.innerHTML = alerts
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
          <span><strong>${normalizeStr(a.item.name) || "Asset"}</strong> — ${label}</span>
        </div>
      `;
    })
    .join("");
}

/* ------------------------------------------------------------------ */
/*  Modal                                                             */
/* ------------------------------------------------------------------ */

let modalEqId = null;
let modalCallback = null;

function openDetailModal(item) {
  modalEqId = item?.id || null;
  const overlay = document.getElementById("eq-detail-modal");
  if (!overlay) return;

  const body = overlay.querySelector("[data-eq-modal-body]");
  if (!body) return;

  const score = healthScore(item);
  const hClass = healthClass(score);
  const hLabel = healthLabel(score);

  body.innerHTML = `
    <div class="eq-modal-grid">
      <div class="eq-modal-section">
        <div class="eq-modal-field">
          <span class="eq-modal-label">Name</span>
          <span class="eq-modal-value eq-modal-name">${normalizeStr(item.name) || "—"}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Type</span>
          <span class="eq-modal-value">${normalizeStr(item.type) || "—"}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Serial Number</span>
          <span class="eq-modal-value eq-modal-serial">${normalizeStr(item.serial_number) || "—"}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Location</span>
          <span class="eq-modal-value">${normalizeStr(item.location) || "—"}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Status</span>
          <span class="equipment-pill equipment-pill-${statusToTone(item.status)}">${normalizeStr(item.status) || "Unknown"}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Condition</span>
          <span class="eq-modal-value">${normalizeStr(item.condition) || "—"}</span>
        </div>
      </div>

      <div class="eq-modal-section">
        <div class="eq-modal-field">
          <span class="eq-modal-label">Health</span>
          <span class="eq-modal-health-badge ${hClass}">${hLabel} (${score}%)</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Assigned To</span>
          <span class="eq-modal-value">${normalizeStr(item.assigned_to_name) || normalizeStr(item.assigned_to) || "—"}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Last Service</span>
          <span class="eq-modal-value ${item.last_service_date && new Date(item.last_service_date) < new Date(Date.now() - 365*86400000) ? 'eq-modal-overdue' : ''}">${formatDate(item.last_service_date)}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Next Service</span>
          <span class="eq-modal-value ${item.next_service_date && new Date(item.next_service_date) < new Date() ? 'eq-modal-overdue' : ''}">${formatDate(item.next_service_date)}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Purchase Date</span>
          <span class="eq-modal-value">${formatDate(item.purchase_date)}</span>
        </div>
        <div class="eq-modal-field">
          <span class="eq-modal-label">Created</span>
          <span class="eq-modal-value">${formatDate(item.created_at)}</span>
        </div>
      </div>
    </div>

    <div class="eq-modal-actions">
      <button class="btn primary" data-eq-report-issue type="button">⚠️ Report Issue</button>
      <button class="btn ghost" data-eq-request-maint type="button">🔧 Request Maintenance</button>
    </div>
  `;

  // Wire action buttons
  const reportBtn = body.querySelector("[data-eq-report-issue]");
  if (reportBtn) {
    reportBtn.addEventListener("click", async () => {
      await handleReportIssue(item);
      overlay.classList.remove("active");
    });
  }

  const maintBtn = body.querySelector("[data-eq-request-maint]");
  if (maintBtn) {
    maintBtn.addEventListener("click", async () => {
      await handleRequestMaintenance(item);
      overlay.classList.remove("active");
    });
  }

  overlay.classList.add("active");
}

function closeDetailModal() {
  const overlay = document.getElementById("eq-detail-modal");
  if (overlay) overlay.classList.remove("active");
  modalEqId = null;
}

async function handleReportIssue(item) {
  const user = window.currentUser;
  if (!user) return;

  const name = normalizeStr(item.name) || "Unknown Equipment";
  const serial = normalizeStr(item.serial_number) || "N/A";

  try {
    await createTicket({
      title: `Equipment Issue: ${name}`,
      description: `Reported issue with equipment "${name}" (Serial: ${serial}, ID: ${item.id}). Please inspect and take action.`,
      category: "Maintenance",
      priority: "Medium",
    });

    // Brief feedback
    const host = rootEl()?.querySelector("[data-eq-feedback]");
    if (host) {
      host.textContent = `✅ Issue reported for "${name}". Ticket created.`;
      host.style.color = "#22c55e";
      setTimeout(() => { if (host) host.textContent = ""; }, 4000);
    }
  } catch (err) {
    console.error("Failed to report equipment issue:", err);
    const host = rootEl()?.querySelector("[data-eq-feedback]");
    if (host) {
      host.textContent = `❌ Failed to report issue: ${err?.message || "Unknown error"}`;
      host.style.color = "#ef4444";
      setTimeout(() => { if (host) host.textContent = ""; }, 4000);
    }
  }
}

async function handleRequestMaintenance(item) {
  const user = window.currentUser;
  if (!user) return;

  const name = normalizeStr(item.name) || "Unknown Equipment";

  try {
    await createTicket({
      title: `Maintenance Request: ${name}`,
      description: `Maintenance requested for equipment "${name}" (ID: ${item.id}). Scheduled service may be due or asset requires inspection.`,
      category: "Maintenance",
      priority: "Medium",
    });

    const host = rootEl()?.querySelector("[data-eq-feedback]");
    if (host) {
      host.textContent = `🔧 Maintenance requested for "${name}".`;
      host.style.color = "#22c55e";
      setTimeout(() => { if (host) host.textContent = ""; }, 4000);
    }
  } catch (err) {
    console.error("Failed to request maintenance:", err);
    const host = rootEl()?.querySelector("[data-eq-feedback]");
    if (host) {
      host.textContent = `❌ Failed to request maintenance: ${err?.message || "Unknown error"}`;
      host.style.color = "#ef4444";
      setTimeout(() => { if (host) host.textContent = ""; }, 4000);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Modal DOM injection (one-time)                                    */
/* ------------------------------------------------------------------ */

function ensureModal() {
  if (document.getElementById("eq-detail-modal")) return;

  const div = document.createElement("div");
  div.id = "eq-detail-modal";
  div.className = "eq-modal-overlay";
  div.innerHTML = `
    <div class="eq-modal-content glass">
      <div class="eq-modal-header">
        <h3 class="eq-modal-title">🔍 Equipment Detail</h3>
        <button class="eq-modal-close" data-eq-close-modal type="button" aria-label="Close">✖</button>
      </div>
      <div data-eq-modal-body class="eq-modal-body"></div>
    </div>
  `;

  div.addEventListener("click", (e) => {
    if (e.target === div) closeDetailModal();
  });

  div.querySelector("[data-eq-close-modal]")?.addEventListener("click", closeDetailModal);

  document.body.appendChild(div);
}

/* ------------------------------------------------------------------ */
/*  Workers lookup cache                                               */
/* ------------------------------------------------------------------ */

let workerCache = null;

async function getWorkerMap() {
  if (workerCache) return workerCache;
  try {
    const { data, error } = await supabase.from("workers").select("id, full_name, email");
    if (error) throw error;
    const map = new Map();
    (data || []).forEach((w) => {
      if (w.id) map.set(w.id, w.full_name || w.email || w.id);
    });
    workerCache = map;
    return map;
  } catch {
    workerCache = new Map();
    return workerCache;
  }
}

/* ------------------------------------------------------------------ */
/*  Tab state                                                         */
/* ------------------------------------------------------------------ */

let currentTab = "all"; // "all" | "mine"
let allEquipment = [];
let workerRecordId = null;

function isWorkerAssigned(equipmentItem, workerId) {
  if (!workerId) return false;
  const assigned = normalizeStr(equipmentItem.assigned_to);
  return assigned === workerId;
}

/* ------------------------------------------------------------------ */
/*  Core render                                                        */
/* ------------------------------------------------------------------ */

function renderSkeleton(root) {
  root.innerHTML = `
    <div class="equipment-muted" style="margin-bottom:10px;font-size:13px;line-height:1.6">
      Loading equipment assets…
    </div>
    <div class="equipment-kpi-grid" aria-hidden="true">
      <div class="equipment-kpi-card shimmer"><div class="equipment-kpi-top"><div class="equipment-kpi-icon">⛭</div><div class="equipment-kpi-value">&nbsp;</div></div><div class="equipment-kpi-label">Total Equipment</div></div>
      <div class="equipment-kpi-card shimmer"><div class="equipment-kpi-top"><div class="equipment-kpi-icon">✓</div><div class="equipment-kpi-value">&nbsp;</div></div><div class="equipment-kpi-label">Active</div></div>
      <div class="equipment-kpi-card shimmer"><div class="equipment-kpi-top"><div class="equipment-kpi-icon">⏸</div><div class="equipment-kpi-value">&nbsp;</div></div><div class="equipment-kpi-label">Idle / Standby</div></div>
      <div class="equipment-kpi-card shimmer"><div class="equipment-kpi-top"><div class="equipment-kpi-icon">!</div><div class="equipment-kpi-value">&nbsp;</div></div><div class="equipment-kpi-label">Offline / Fault</div></div>
    </div>
    <div class="equipment-table-card" style="margin-top:14px"><div class="equipment-table-head"><div><div class="equipment-table-title">Asset Registry</div><div class="equipment-table-sub">Preparing table…</div></div></div></div>
  `;
}

function renderKPIs(root, stats) {
  const { total, active, idle, offline, unassigned } = stats;
  const grid = root.querySelector("[data-equipment-kpi-grid]");
  if (!grid) return;

  grid.innerHTML = `
    <div class="equipment-kpi-card">
      <div class="equipment-kpi-top">
        <div class="equipment-kpi-icon">⛭</div>
        <div class="equipment-kpi-value">${total}</div>
      </div>
      <div class="equipment-kpi-label">Total Equipment</div>
    </div>
    <div class="equipment-kpi-card">
      <div class="equipment-kpi-top">
        <div class="equipment-kpi-icon">✓</div>
        <div class="equipment-kpi-value">${active}</div>
      </div>
      <div class="equipment-kpi-label">Active</div>
    </div>
    <div class="equipment-kpi-card">
      <div class="equipment-kpi-top">
        <div class="equipment-kpi-icon">⏸</div>
        <div class="equipment-kpi-value">${idle}</div>
      </div>
      <div class="equipment-kpi-label">Idle / Standby</div>
    </div>
    <div class="equipment-kpi-card">
      <div class="equipment-kpi-top">
        <div class="equipment-kpi-icon">!</div>
        <div class="equipment-kpi-value">${offline}</div>
      </div>
      <div class="equipment-kpi-label">Offline / Fault</div>
    </div>
    <div class="equipment-kpi-card" style="grid-column: span 2;">
      <div class="equipment-kpi-top">
        <div class="equipment-kpi-icon">👤</div>
        <div class="equipment-kpi-value">${unassigned}</div>
      </div>
      <div class="equipment-kpi-label">Unassigned Assets</div>
    </div>
  `;
}

function computeStats(equipment) {
  let total = equipment.length;
  let active = 0, idle = 0, offline = 0, unassigned = 0;
  for (const e of equipment) {
    const tone = statusToTone(e.status);
    if (tone === "good") active++;
    else if (tone === "warn") idle++;
    else if (tone === "bad") offline++;
    if (!normalizeStr(e.assigned_to)) unassigned++;
  }
  return { total, active, idle, offline, unassigned };
}

function renderTableBody(root, equipment, workerMap) {
  const tbody = root.querySelector("[data-equipment-tbody]");
  if (!tbody) return;

  if (!equipment.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="equipment-empty">No equipment records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  for (const e of equipment) {
    const tone = statusToTone(e.status);
    const score = healthScore(e);
    const hClass = healthClass(score);
    const hLabel = healthLabel(score);
    const assignedName = workerMap?.get(e.assigned_to) || normalizeStr(e.assigned_to) || "—";

    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.dataset.eqId = e.id;
    tr.addEventListener("click", () => {
      const enriched = { ...e, assigned_to_name: assignedName };
      openDetailModal(enriched);
    });

    tr.innerHTML = `
      <td>
        <div class="equipment-asset-name">${normalizeStr(e.name) || "—"}</div>
        <div class="equipment-asset-sub">#${String(e.id).slice(0, 8)}</div>
      </td>
      <td>${normalizeStr(e.type) || "—"}</td>
      <td>${normalizeStr(e.serial_number) || "—"}</td>
      <td>
        <span class="equipment-pill equipment-pill-${tone}">${normalizeStr(e.status) || "Unknown"}</span>
      </td>
      <td><span class="eq-health-pill ${hClass}">${hLabel}</span></td>
      <td>${normalizeStr(e.location) || "—"}</td>
      <td>${assignedName}</td>
      <td>${normalizeStr(e.condition) || "—"}</td>
      <td>${formatDate(e.last_service_date)}</td>
      <td>${formatDate(e.next_service_date)}</td>
    `;

    tbody.appendChild(tr);
  }
}

function renderTabBar(root, hasWorkerMatch) {
  const host = root.querySelector("[data-eq-tabs]");
  if (!host) return;

  host.innerHTML = `
    <button class="eq-tab ${currentTab === "all" ? "eq-tab-active" : ""}" data-eq-tab="all" type="button">📋 All Equipment</button>
    ${hasWorkerMatch ? `<button class="eq-tab ${currentTab === "mine" ? "eq-tab-active" : ""}" data-eq-tab="mine" type="button">👤 My Equipment</button>` : ""}
  `;

  host.querySelectorAll("[data-eq-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.eqTab;
      if (tab === currentTab) return;
      currentTab = tab;
      refreshView();
    });
  });
}

function renderIntel(root, stats, equipment, workerMap) {
  const body = root.querySelector("[data-equipment-intel-body]");
  if (!body) return;

  const byLocation = new Map();
  for (const e of equipment) {
    const loc = normalizeStr(e.location) || "Unspecified";
    byLocation.set(loc, (byLocation.get(loc) ?? 0) + 1);
  }
  const topLocation = [...byLocation.entries()].sort((a, b) => b[1] - a[1])[0];
  const topLocationLabel = topLocation ? `${topLocation[0]} (${topLocation[1]})` : "—";

  const overdueCount = equipment.filter((e) => {
    if (!e.next_service_date) return false;
    return new Date(e.next_service_date) < new Date();
  }).length;

  const atRiskCount = equipment.filter((e) => healthScore(e) < 55).length;

  let posture = "Stable";
  if (stats.offline > 0 || overdueCount > 0) posture = "Needs attention";
  if (atRiskCount > 2 || stats.offline > 3) posture = "Action required";

  let nextAction = "Assets are in good standing—review maintenance cadence next.";
  if (overdueCount > 0) {
    nextAction = `${overdueCount} asset(s) past-due for service. Schedule maintenance immediately.`;
  } else if (atRiskCount > 0) {
    nextAction = `${atRiskCount} asset(s) with low health. Investigate condition and plan interventions.`;
  } else if (stats.unassigned > 0) {
    nextAction = `Assign owners to ${stats.unassigned} unassigned assets to improve accountability.`;
  }

  body.innerHTML = `
    <div class="equipment-intel-row">
      <div class="equipment-intel-stat">
        <div class="equipment-intel-stat-label">Highest concentration</div>
        <div class="equipment-intel-stat-value">${topLocationLabel}</div>
      </div>
      <div class="equipment-intel-stat">
        <div class="equipment-intel-stat-label">Operational posture</div>
        <div class="equipment-intel-stat-value">${posture}</div>
      </div>
      <div class="equipment-intel-stat">
        <div class="equipment-intel-stat-label">Overdue service</div>
        <div class="equipment-intel-stat-value">${overdueCount} asset(s)</div>
      </div>
      <div class="equipment-intel-stat">
        <div class="equipment-intel-stat-label">At-risk health</div>
        <div class="equipment-intel-stat-value">${atRiskCount} asset(s)</div>
      </div>
      <div class="equipment-intel-stat" style="grid-column: span 2;">
        <div class="equipment-intel-stat-label">Suggested next step</div>
        <div class="equipment-intel-stat-value">${nextAction}</div>
      </div>
    </div>
    <div class="equipment-intel-tips">
      <div class="equipment-intel-tip">• Click any row to view full equipment details and take action.</div>
      <div class="equipment-intel-tip">• Use "My Equipment" tab to focus on assets assigned to you.</div>
      <div class="equipment-intel-tip">• Health indicators factor in status, condition, and service recency.</div>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/*  Refresh view                                                       */
/* ------------------------------------------------------------------ */

async function refreshView() {
  const root = rootEl();
  if (!root) return;

  const workerMap = await getWorkerMap();

  // Filter by tab
  let filtered = allEquipment;
  if (currentTab === "mine" && workerRecordId) {
    filtered = allEquipment.filter((e) => isWorkerAssigned(e, workerRecordId));
  }

  const stats = computeStats(filtered);
  renderKPIs(root, stats);
  renderTableBody(root, filtered, workerMap);
  renderIntel(root, stats, filtered, workerMap);
  renderMaintenanceAlerts(filtered);
  updateStatusFilterOptions(root, filtered);
  applyFiltersFromUI(root, filtered, workerMap);
}

function updateStatusFilterOptions(root, equipment) {
  const sel = root.querySelector("[data-equipment-status-filter]");
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">All statuses</option>`;
  const set = new Set(equipment.map((e) => normalizeStr(e.status)).filter(Boolean));
  [...set].sort().forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });
  sel.value = current || "";
}

function applyFiltersFromUI(root, fullList, workerMap) {
  const searchInput = root.querySelector("[data-equipment-search]");
  const statusSelect = root.querySelector("[data-equipment-status-filter]");
  const q = normalizeStr(searchInput?.value).toLowerCase();
  const status = normalizeStr(statusSelect?.value);

  const filtered = fullList.filter((e) => {
    const hay = [e.name, e.type, e.serial_number, e.location, e.status, e.assigned_to, e.condition]
      .map((v) => normalizeStr(v).toLowerCase());
    const matchesQ = !q || hay.some((x) => x.includes(q));
    const matchesStatus = !status || normalizeStr(e.status) === status;
    return matchesQ && matchesStatus;
  });

  renderTableBody(root, filtered, workerMap);
}

/* ------------------------------------------------------------------ */
/*  Realtime subscription                                              */
/* ------------------------------------------------------------------ */

let eqRealtimeChannel = null;

function subscribeEquipmentRealtime() {
  if (eqRealtimeChannel) return;

  eqRealtimeChannel = supabase
    .channel("equipment-assets-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "equipment" }, async () => {
      await initEquipmentAssets(true);
    })
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.error("equipment-assets: realtime channel error");
      }
    });
}

/* ------------------------------------------------------------------ */
/*  Main init                                                         */
/* ------------------------------------------------------------------ */

export async function initEquipmentAssets(silentRefresh = false) {
  const root = rootEl();
  if (!root) return;

  ensureModal();

  if (!silentRefresh) {
    renderSkeleton(root);
  }

  // Resolve worker record ID (for "My Equipment" tab)
  const profile = window.currentWorker;
  const user = window.currentUser;

  if (!workerRecordId && user) {
    try {
      // Try to find a worker record that matches by email or profile
      const { data: workerData } = await supabase
        .from("workers")
        .select("id, email, full_name")
        .eq("email", user.email)
        .maybeSingle();

      if (workerData?.id) {
        workerRecordId = workerData.id;
      } else {
        // Fallback: try workforce table via profile_id
        const { data: wfData } = await supabase
          .from("workforce")
          .select("employee_number")
          .eq("profile_id", profile?.id)
          .maybeSingle();

        if (wfData?.employee_number) {
          const { data: wData } = await supabase
            .from("workers")
            .select("id")
            .eq("employee_number", wfData.employee_number)
            .maybeSingle();
          if (wData?.id) workerRecordId = wData.id;
        }
      }
    } catch {
      // Non-critical; "My Equipment" tab will be hidden
    }
  }

  // Fetch equipment
  try {
    const { data, error } = await supabase
      .from("equipment")
      .select("id, name, type, serial_number, status, location, assigned_to, condition, last_service_date, next_service_date, purchase_date, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    allEquipment = Array.isArray(data) ? data : [];
  } catch (err) {
    root.innerHTML = `
      <div class="card glass">
        <h2 class="h2">Failed to load equipment assets.</h2>
        <p class="muted">${String(err?.message || err)}</p>
      </div>
    `;
    return;
  }

  // Build full UI
  root.innerHTML = `
    <div class="eq-feedback" data-eq-feedback style="font-size:13px;font-weight:700;min-height:22px;margin-bottom:6px;"></div>

    <section class="equipment-hero">
      <div class="equipment-hero-head">
        <div class="equipment-hero-icon">🏗️</div>
        <div>
          <div class="equipment-hero-title">Enterprise Equipment Command Center</div>
          <div class="equipment-hero-sub">Real-time asset registry with health monitoring and service scheduling.</div>
        </div>
      </div>
    </section>

    <div data-eq-alerts class="eq-alerts-bar" style="margin-top:10px;"></div>

    <section data-equipment-kpi-grid class="equipment-kpi-grid" style="margin-top:12px;"></section>

    <div data-eq-tabs class="eq-tab-bar" style="margin-top:14px;"></div>

    <section class="equipment-table-card" style="margin-top:8px;">
      <div class="equipment-table-head">
        <div>
          <div class="equipment-table-title">Asset Registry</div>
          <div class="equipment-table-sub">${currentTab === "mine" ? "Assets assigned to you" : "All registered equipment"} — click a row for details.</div>
        </div>
        <div class="equipment-toolbar" role="search">
          <input data-equipment-search class="equipment-search" type="search" placeholder="Search name/type/serial/location…" />
          <select data-equipment-status-filter class="equipment-select">
            <option value="">All statuses</option>
          </select>
        </div>
      </div>
      <div class="equipment-table-wrap">
        <table class="equipment-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Serial #</th>
              <th>Status</th>
              <th>Health</th>
              <th>Location</th>
              <th>Assigned To</th>
              <th>Condition</th>
              <th>Last Service</th>
              <th>Next Service</th>
            </tr>
          </thead>
          <tbody data-equipment-tbody></tbody>
        </table>
      </div>
    </section>

    <section class="equipment-intel" style="margin-top:14px;">
      <div class="equipment-intel-head">
        <div>
          <div class="equipment-intel-title">Intelligence Summary</div>
          <div class="equipment-intel-sub">Operational signals derived from equipment health and service data.</div>
        </div>
      </div>
      <div data-equipment-intel-body></div>
    </section>
  `;

  const workerMap = await getWorkerMap();

  // Render tabs
  renderTabBar(root, !!workerRecordId);

  // Render
  let displayList = allEquipment;
  if (currentTab === "mine" && workerRecordId) {
    displayList = allEquipment.filter((e) => isWorkerAssigned(e, workerRecordId));
  }

  const stats = computeStats(displayList);
  renderKPIs(root, stats);
  renderTableBody(root, displayList, workerMap);
  renderMaintenanceAlerts(displayList);
  renderIntel(root, stats, displayList, workerMap);

  // Status filter options (based on full list for consistency)
  updateStatusFilterOptions(root, allEquipment);

  // Wire filters
  const searchInput = root.querySelector("[data-equipment-search]");
  const statusSelect = root.querySelector("[data-equipment-status-filter]");

  function doFilter() {
    let base = allEquipment;
    if (currentTab === "mine" && workerRecordId) {
      base = allEquipment.filter((e) => isWorkerAssigned(e, workerRecordId));
    }
    applyFiltersFromUI(root, base, workerMap);
  }

  searchInput?.addEventListener("input", doFilter);
  statusSelect?.addEventListener("change", doFilter);

  // Realtime
  if (!silentRefresh) {
    subscribeEquipmentRealtime();
  }
}
