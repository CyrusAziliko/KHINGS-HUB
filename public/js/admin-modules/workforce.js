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
  if (s.includes("day") || s === "day") return "wfc-badge wfc-badge--day";
  if (s.includes("evening") || s === "evening") return "wfc-badge wfc-badge--eve";
  if (s.includes("night") || s === "night") return "wfc-badge wfc-badge--night";
  return "wfc-badge";
}

function statusClass(status) {
  const s = safeText(status).trim().toLowerCase();
  if (s === "active" || s === "available") return "wfc-st wfc-st--on";
  if (s === "inactive" || s === "unavailable" || s === "off") return "wfc-st wfc-st--off";
  if (s === "on leave" || s === "leave") return "wfc-st wfc-st--away";
  return "wfc-st wfc-st--on";
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

function normalizeWorker(row, source) {
  return {
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
    hire_date: row.hire_date || "",
    location: row.location || "",
    availability: row.availability || row.status || "available",
    _source: source,
  };
}

async function fetchAllWorkers() {
  const results = [];

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
    console.warn("workforce: workers fetch failed", e);
  }

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
    console.warn("workforce: profiles fetch failed", e);
  }

  try {
    const { data, error } = await supabase
      .from("workforce")
      .select("*, profiles!inner(id, full_name, email, department, position, phone, status)")
      .limit(500);
    if (!error && Array.isArray(data)) {
      data.forEach((wf) => {
        if (wf.profiles && wf.profiles.full_name) {
          results.push(
            normalizeWorker(
              {
                ...wf.profiles,
                shift_type: wf.shift_type,
                availability: wf.availability,
                employment_type: wf.employment_type,
                employee_number: wf.employee_number,
                location: wf.location,
                created_at: wf.created_at || wf.profiles.created_at,
              },
              "workforce"
            )
          );
        }
      });
    }
  } catch (e) {
    console.warn("workforce: workforce fetch failed", e);
  }

  const seen = new Set();
  const deduped = [];
  for (const w of results) {
    const key = `${safeText(w.id)}|${safeText(w.full_name)}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(w);
    }
  }
  deduped.sort((a, b) => safeText(a.full_name).localeCompare(safeText(b.full_name)));
  return deduped;
}

// ─── Banner / Hero ────────────────────────────────

function buildHero() {
  return `
    <div class="wfc-hero">
      <div class="wfc-hero-bg" aria-hidden="true"></div>
      <div class="wfc-hero-row">
        <div class="wfc-hero-brand">
          <span class="wfc-hero-icon" aria-hidden="true">⛏️</span>
          <div>
            <h2 class="wfc-hero-title">Crew Hub</h2>
            <p class="wfc-hero-sub">Workforce operations &amp; personnel overview</p>
          </div>
        </div>
        <div class="wfc-hero-meta">
          <span class="wfc-hero-pulse" aria-hidden="true"></span>
          <span class="wfc-hero-live">Live Feed</span>
        </div>
      </div>
    </div>
  `;
}

// ─── Inline Stats Bar (compact alternative to KPI cards) ───

function buildStats(stats) {
  return `
    <div class="wfc-stats">
      <div class="wfc-stat-item">
        <span class="wfc-stat-num">${stats.totalWorkers}</span>
        <span class="wfc-stat-label">Total Personnel</span>
      </div>
      <div class="wfc-stat-div" aria-hidden="true"></div>
      <div class="wfc-stat-item">
        <span class="wfc-stat-num wfc-stat-num--ok">${stats.activeWorkers}</span>
        <span class="wfc-stat-label">Active</span>
      </div>
      <div class="wfc-stat-div" aria-hidden="true"></div>
      <div class="wfc-stat-item">
        <span class="wfc-stat-num wfc-stat-num--info">${stats.onShift}</span>
        <span class="wfc-stat-label">On Shift</span>
      </div>
      <div class="wfc-stat-div" aria-hidden="true"></div>
      <div class="wfc-stat-item">
        <span class="wfc-stat-num wfc-stat-num--warn">${stats.departments}</span>
        <span class="wfc-stat-label">Departments</span>
      </div>
    </div>
  `;
}

// ─── Toolbar ──────────────────────────────────────

function buildToolbar() {
  return `
    <div class="wfc-bar">
      <div class="wfc-bar-left">
        <div class="wfc-search-wrap">
          <span class="wfc-search-ico" aria-hidden="true">🔍</span>
          <input type="search" id="wfc-q" class="wfc-search" placeholder="Search personnel..." aria-label="Search workers" />
        </div>
        <select id="wfc-s" class="wfc-pick" aria-label="Filter status">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="leave">On Leave</option>
        </select>
        <div class="wfc-toggle" role="group" aria-label="Shift filter">
          <button type="button" class="wfc-toggle-btn active" data-shift="">All</button>
          <button type="button" class="wfc-toggle-btn" data-shift="Day">☀️ Day</button>
          <button type="button" class="wfc-toggle-btn" data-shift="Evening">🌆 Eve</button>
          <button type="button" class="wfc-toggle-btn" data-shift="Night">🌙 Night</button>
        </div>
      </div>
      <div class="wfc-bar-right">
        <button type="button" id="wfc-refresh" class="wfc-action" aria-label="Refresh">⟳ Refresh</button>
      </div>
    </div>
  `;
}

// ─── Directory ────────────────────────────────────

function buildTable(workers) {
  if (!workers || workers.length === 0) {
    return `
      <div class="wfc-panel">
        <div class="wfc-panel-head">
          <h3 class="wfc-panel-title">Personnel Directory</h3>
          <span class="wfc-chip">0</span>
        </div>
        <div class="wfc-null">
          <div class="wfc-null-ico" aria-hidden="true">👷</div>
          <h3>No personnel found</h3>
          <p>Try different search or filter criteria.</p>
        </div>
      </div>`;
  }

  return `
    <div class="wfc-panel">
      <div class="wfc-panel-head">
        <h3 class="wfc-panel-title">Personnel Directory</h3>
        <span class="wfc-chip">${workers.length}</span>
      </div>
      <div class="wfc-scroll">
        <table class="wfc-tbl">
          <thead>
            <tr><th>Worker</th><th>Dept</th><th>Position</th><th>Shift</th><th>Status</th><th>ID</th></tr>
          </thead>
          <tbody>
            ${workers.map((w) => buildRow(w)).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

function buildRow(w) {
  const name = safeText(w.full_name, "Unknown");
  const dept = safeText(w.department, "—");
  const pos = safeText(w.position, "—");
  const shift = shiftLabel(w.shift_type);
  const sClass = shiftBadgeClass(w.shift_type);
  const stCls = statusClass(w.status || w.availability);
  const stLbl = statusLabel(w.status || w.availability);
  const eid = safeText(w.employee_number || w.employee_id, "—");
  const email = safeText(w.email, "");

  return `
    <tr class="wfc-row" data-id="${safeText(w.id)}">
      <td>
        <div class="wfc-wcell">
          <span class="wfc-av">${name.charAt(0).toUpperCase()}</span>
          <div class="wfc-win">
            <span class="wfc-wname">${name}</span>
            <span class="wfc-wemail">${email || "—"}</span>
          </div>
        </div>
      </td>
      <td>${dept}</td>
      <td>${pos}</td>
      <td><span class="${sClass}">${shift}</span></td>
      <td><span class="${stCls}">${stLbl}</span></td>
      <td><code class="wfc-eid">${eid}</code></td>
    </tr>`;
}

// ─── Availability Dashboard ───────────────────────

function buildAvail(workers) {
  const avail = workers.filter((w) => {
    const s = safeText(w.status || w.availability).trim().toLowerCase();
    return s === "available" || s === "active";
  });
  const unavail = workers.filter((w) => {
    const s = safeText(w.status || w.availability).trim().toLowerCase();
    return s !== "available" && s !== "active" && s !== "";
  });
  const total = workers.length || 1;
  const pct = Math.round((avail.length / total) * 100);

  return `
    <div class="wfc-panel">
      <div class="wfc-panel-head">
        <h3 class="wfc-panel-title">Crew Availability</h3>
        <span class="wfc-chip wfc-chip--ok">${pct}% Online</span>
      </div>
      <div class="wfc-avail-bar-wrap">
        <div class="wfc-avail-bar">
          <div class="wfc-avail-fill" style="width:${pct}%" aria-label="${pct}% available"></div>
        </div>
        <div class="wfc-avail-legend">
          <span>🟢 ${avail.length} Available</span>
          <span>🔴 ${unavail.length} Unavailable</span>
        </div>
      </div>
      <div class="wfc-avail-grid">
        <div class="wfc-avail-col">
          <div class="wfc-avail-col-head">🟢 On Duty (${avail.length})</div>
          ${avail.length === 0
            ? '<div class="wfc-null" style="padding:16px;"><p>None</p></div>'
            : avail.slice(0, 6).map((w) => `
                <div class="wfc-avail-person">
                  <span class="wfc-avail-dot" aria-hidden="true"></span>
                  <strong>${safeText(w.full_name)}</strong>
                  <span>${safeText(w.department, "—")}</span>
                  <span class="wfc-badge wfc-badge--day">${shiftLabel(w.shift_type)}</span>
                </div>`).join("")}
          ${avail.length > 6 ? `<div class="wfc-avail-more">+${avail.length - 6} more</div>` : ""}
        </div>
        <div class="wfc-avail-col">
          <div class="wfc-avail-col-head">🔴 Off Duty (${unavail.length})</div>
          ${unavail.length === 0
            ? '<div class="wfc-null" style="padding:16px;"><p>None</p></div>'
            : unavail.slice(0, 6).map((w) => `
                <div class="wfc-avail-person wfc-avail-person--off">
                  <span class="wfc-avail-dot wfc-avail-dot--red" aria-hidden="true"></span>
                  <strong>${safeText(w.full_name)}</strong>
                  <span>${safeText(w.department, "—")}</span>
                  <span class="wfc-st wfc-st--off">${statusLabel(w.status || w.availability)}</span>
                </div>`).join("")}
          ${unavail.length > 6 ? `<div class="wfc-avail-more">+${unavail.length - 6} more</div>` : ""}
        </div>
      </div>
    </div>`;
}

// ─── Detail Panel ─────────────────────────────────

function buildDetail(worker) {
  if (!worker) {
    return `
      <div class="wfc-panel">
        <div class="wfc-panel-head">
          <h3 class="wfc-panel-title">Personnel Record</h3>
        </div>
        <div class="wfc-null">
          <div class="wfc-null-ico" aria-hidden="true">👤</div>
          <h3>Select a Worker</h3>
          <p>Click a row in the directory to view details.</p>
        </div>
      </div>`;
  }

  const name = safeText(worker.full_name, "Unknown");
  const email = safeText(worker.email, "—");
  const dept = safeText(worker.department, "—");
  const pos = safeText(worker.position, "—");
  const shift = shiftLabel(worker.shift_type);
  const sClass = shiftBadgeClass(worker.shift_type);
  const stCls = statusClass(worker.status || worker.availability);
  const stLbl = statusLabel(worker.status || worker.availability);
  const eid = safeText(worker.employee_number || worker.employee_id, "—");
  const phone = safeText(worker.phone, "—");
  const empType = safeText(worker.employment_type, "—");
  const loc = safeText(worker.location, "—");
  const hire = worker.hire_date ? formatDate(worker.hire_date) : "—";
  const created = formatDate(worker.created_at);

  return `
    <div class="wfc-panel">
      <div class="wfc-panel-head">
        <h3 class="wfc-panel-title">${name}</h3>
        <div class="wfc-panel-head-acts">
          <span class="${sClass}">${shift}</span>
          <span class="${stCls}">${stLbl}</span>
        </div>
      </div>
      <div class="wfc-detail">
        <div class="wfc-detail-i"><span>Employee ID</span><strong>${eid}</strong></div>
        <div class="wfc-detail-i"><span>Email</span><strong>${email}</strong></div>
        <div class="wfc-detail-i"><span>Phone</span><strong>${phone}</strong></div>
        <div class="wfc-detail-i"><span>Department</span><strong>${dept}</strong></div>
        <div class="wfc-detail-i"><span>Position</span><strong>${pos}</strong></div>
        <div class="wfc-detail-i"><span>Employment Type</span><strong>${empType}</strong></div>
        <div class="wfc-detail-i"><span>Location</span><strong>${loc}</strong></div>
        <div class="wfc-detail-i"><span>Hire Date</span><strong>${hire}</strong></div>
        <div class="wfc-detail-i"><span>Created</span><strong>${created}</strong></div>
      </div>
    </div>`;
}

// ─── Main Load ────────────────────────────────────

export async function loadWorkforce() {
  console.log("Loading Crew Hub");
  const root = document.getElementById("workforce-root");
  if (!root) return;

  root.innerHTML = `
    <div class="wfc-ctl">
      ${buildHero()}
      <div id="wfc-stats"></div>
      ${buildToolbar()}
      <div id="wfc-dir"></div>
      <div id="wfc-avail"></div>
      <div id="wfc-rec"></div>
    </div>`;

  const statsEl = document.getElementById("wfc-stats");
  const dirEl = document.getElementById("wfc-dir");
  const availEl = document.getElementById("wfc-avail");
  const recEl = document.getElementById("wfc-rec");

  statsEl.innerHTML = `<div class="wfc-load">Loading stats...</div>`;
  dirEl.innerHTML = `<div class="wfc-load">Loading directory...</div>`;

  let workers = [];
  try {
    workers = await fetchAllWorkers();
  } catch (err) {
    console.error("Crew Hub load failed:", err);
    root.innerHTML = `
      <div class="wfc-ctl">
        ${buildHero()}
        <div class="wfc-panel" style="padding:40px;text-align:center;">
          <div style="font-size:38px;">⚠️</div>
          <h3 style="margin:8px 0;color:var(--text-primary);">Connection Error</h3>
          <p style="color:var(--text-secondary);">Could not load workforce data.</p>
          <button onclick="location.reload()" class="wfc-action" style="margin-top:12px;">⟳ Retry</button>
        </div>
      </div>`;
    return;
  }

  const total = workers.length;
  const active = workers.filter((w) => {
    const s = safeText(w.status || w.availability).trim().toLowerCase();
    return s === "active" || s === "available";
  }).length;
  const onShift = workers.filter((w) => {
    const s = safeText(w.shift_type).trim().toLowerCase();
    return s && s !== "";
  }).length;
  const depts = new Set(workers.map((w) => safeText(w.department).trim().toLowerCase()).filter(Boolean)).size;

  statsEl.innerHTML = buildStats({ totalWorkers: total, activeWorkers: active, onShift, departments: depts });

  const renderDir = (list) => { dirEl.innerHTML = buildTable(list); };
  const renderAvail = (list) => { availEl.innerHTML = buildAvail(list); };

  renderDir(workers);
  renderAvail(workers);
  recEl.innerHTML = buildDetail(null);

  // ─── Filtering ──────────────────────────────────
  const qInput = document.getElementById("wfc-q");
  const sSelect = document.getElementById("wfc-s");
  const shiftBtns = document.querySelectorAll(".wfc-toggle-btn");
  let shiftVal = "";

  function filter() {
    const q = qInput ? safeText(qInput.value).trim().toLowerCase() : "";
    const s = sSelect ? sSelect.value : "";

    let f = workers;
    if (q) f = f.filter((w) => getSearchIndex(w).includes(q));
    if (s) {
      f = f.filter((w) => {
        const st = safeText(w.status || w.availability).trim().toLowerCase();
        if (s === "leave") return st === "on leave" || st === "leave";
        return st === s;
      });
    }
    if (shiftVal) f = f.filter((w) => shiftLabel(w.shift_type) === shiftVal);

    renderDir(f);
    renderAvail(f);
  }

  if (qInput) qInput.addEventListener("input", filter);
  if (sSelect) sSelect.addEventListener("change", filter);

  shiftBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      shiftBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      shiftVal = btn.getAttribute("data-shift") || "";
      filter();
    });
  });

  document.getElementById("wfc-refresh")?.addEventListener("click", () => loadWorkforce());

  // ─── Row click → detail ─────────────────────────
  dirEl.addEventListener("click", (e) => {
    const tr = e.target.closest(".wfc-row");
    if (!tr) return;
    const id = tr.getAttribute("data-id");
    const w = workers.find((x) => safeText(x.id) === id);
    if (w) recEl.innerHTML = buildDetail(w);
  });

  console.log(`Crew Hub ready — ${workers.length} workers`);
}

