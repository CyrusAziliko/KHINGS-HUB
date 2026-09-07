import { supabase } from "./supabaseClient.js";

/**
 * WORKLOAD HEATMAP — Real Backend-Driven Horizontal Bar Design
 * Fetches actual ticket, worker, and safety data grouped by department.
 */

export async function loadWorkforceHeatmap(workforcePanel) {
  const container = workforcePanel?.querySelector("#workforce-heatmap")
    || document.getElementById("wfc-heatmap-container");
  if (!container) return;

  // ── 1. Fetch ALL real backend data ──
  const [ticketsRes, workersRes, incidentsRes, profilesRes] = await Promise.allSettled([
    supabase.from("tickets").select("id, title, status, priority, department, created_at, worker_id"),
    supabase.from("workers").select("id, full_name, department, status, shift_type, position"),
    supabase.from("safety_incidents").select("id, title, status, severity, worker_id, created_at"),
    supabase.from("profiles").select("id, full_name, department, status, role"),
  ]);

  const tickets = (ticketsRes.status === "fulfilled" ? ticketsRes.value.data : []) || [];
  const workers = (workersRes.status === "fulfilled" ? workersRes.value.data : []) || [];
  const incidents = (incidentsRes.status === "fulfilled" ? incidentsRes.value.data : []) || [];
  const profiles = (profilesRes.status === "fulfilled" ? profilesRes.value.data : []) || [];

  // ── 2. Discover departments from the data ──
  const deptSet = new Set();

  // From tickets.department
  tickets.forEach(t => { if (t.department) deptSet.add(t.department); });

  // From workers.department
  workers.forEach(w => { if (w.department) deptSet.add(w.department); });

  // From profiles.department
  profiles.forEach(p => { if (p.department) deptSet.add(p.department); });

  // Fallback if no departments exist
  if (deptSet.size === 0) {
    ["Mining Operations", "Processing Plant", "Maintenance", "Safety", "Logistics", "Administration"].forEach(d => deptSet.add(d));
  }

  const departments = [...deptSet].sort();

  // ── 3. Compute per-department metrics ──
  const deptMetrics = departments.map((dept) => {
    const deptLower = dept.toLowerCase();

    // Tickets for this department
    const deptTickets = tickets.filter(t =>
      t.department && t.department.toLowerCase() === deptLower
    );
    const openTickets = deptTickets.filter(t =>
      !["resolved", "closed"].includes(String(t.status || "").toLowerCase())
    );
    const criticalTickets = deptTickets.filter(t =>
      ["critical", "high"].includes(String(t.priority || "").toLowerCase())
    );

    // Workers in this department
    const deptWorkers = workers.filter(w =>
      w.department && w.department.toLowerCase() === deptLower
    );
    const activeWorkers = deptWorkers.filter(w =>
      String(w.status || "").toLowerCase() === "active"
    );

    // Safety incidents for this department (matched via worker_id -> worker department)
    const deptIncidents = incidents.filter(i => {
      if (!i.worker_id) return false;
      const worker = workers.find(w => w.id === i.worker_id);
      return worker && worker.department && worker.department.toLowerCase() === deptLower;
    });
    const openIncidents = deptIncidents.filter(i =>
      String(i.status || "").toLowerCase() !== "resolved"
    );
    const criticalIncidents = deptIncidents.filter(i =>
      ["high", "critical"].includes(String(i.severity || "").toLowerCase())
    );

    // ── Compute workload score (0-100) ──
    const totalWorkers = deptWorkers.length || 1;
    const openCount = openTickets.length;
    const workerLoad = openCount / totalWorkers;
    const criticalWeight = criticalTickets.length * 12;
    const incidentWeight = openIncidents.length * 8 + criticalIncidents.length * 10;
    const baseScore = Math.round((workerLoad * 15) + criticalWeight + incidentWeight);
    const workloadScore = Math.min(100, Math.max(0, baseScore));

    // ── Daily trend: tickets created in last 7 days vs older ──
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentTickets = deptTickets.filter(t => {
      const d = new Date(t.created_at);
      return d >= sevenDaysAgo;
    }).length;
    const olderTickets = deptTickets.length - recentTickets;

    const trend = recentTickets > olderTickets ? "up" : recentTickets < olderTickets ? "down" : "stable";

    return {
      name: dept,
      icon: getDeptIcon(dept),
      totalWorkers: deptWorkers.length,
      activeWorkers: activeWorkers.length,
      totalTickets: deptTickets.length,
      openTickets: openCount,
      criticalTickets: criticalTickets.length,
      totalIncidents: deptIncidents.length,
      openIncidents: openIncidents.length,
      criticalIncidents: criticalIncidents.length,
      workloadScore,
      trend,
      recentTickets,
      olderTickets,
    };
  });

  // Sort by workload descending
  deptMetrics.sort((a, b) => b.workloadScore - a.workloadScore);

  // Global totals
  const totalWorkers = workers.length;
  const totalActive = workers.filter(w => String(w.status || "").toLowerCase() === "active").length;

  // ── 4. Render the heatmap ──
  container.innerHTML = `
    <div class="wh-gauge-container">
      <!-- Header with global stats -->
      <div class="wh-gauge-header">
        <div class="wh-gauge-header-left">
          <span class="wh-gauge-header-title">📊 Department Workload Overview</span>
          <span class="wh-gauge-header-sub">Real-time workload distribution across all departments</span>
        </div>
        <div class="wh-gauge-header-right">
          <span class="wh-gauge-pill wh-gauge-pill--workers">${totalActive}/${totalWorkers} active</span>
          <span class="wh-gauge-pill wh-gauge-pill--tickets">${tickets.length} tickets</span>
        </div>
      </div>

      <!-- Gauge items -->
      <div class="wh-gauge-list">
        ${deptMetrics.length === 0
          ? `<div class="wh-gauge-empty">No department data available yet.</div>`
          : deptMetrics.map((d, i) => renderDeptGauge(d, i)).join("")
        }
      </div>

      <!-- Legend footer -->
      <div class="wh-gauge-footer">
        <div class="wh-gauge-legend">
          <span class="wh-gauge-legend-item">
            <span class="wh-gauge-legend-swatch wh-gauge-legend-swatch--low"></span> Low (0-24)
          </span>
          <span class="wh-gauge-legend-item">
            <span class="wh-gauge-legend-swatch wh-gauge-legend-swatch--medium"></span> Medium (25-49)
          </span>
          <span class="wh-gauge-legend-item">
            <span class="wh-gauge-legend-swatch wh-gauge-legend-swatch--high"></span> High (50-74)
          </span>
          <span class="wh-gauge-legend-item">
            <span class="wh-gauge-legend-swatch wh-gauge-legend-swatch--critical"></span> Critical (75-100)
          </span>
        </div>
        <div class="wh-gauge-updated">
          <span class="wh-gauge-updated-dot"></span>
          Live
        </div>
      </div>
    </div>
  `;
}

/* ── Helper: Get icon for department ── */
function getDeptIcon(dept) {
  const lower = dept.toLowerCase();
  if (lower.includes("mine") || lower.includes("mining") || lower.includes("extraction")) return "⛏️";
  if (lower.includes("process") || lower.includes("plant") || lower.includes("mill")) return "🏭";
  if (lower.includes("maintenance") || lower.includes("repair") || lower.includes("mech")) return "🔧";
  if (lower.includes("safety") || lower.includes("hse") || lower.includes("environ")) return "🛡️";
  if (lower.includes("logistic") || lower.includes("transport") || lower.includes("dispatch")) return "🚛";
  if (lower.includes("admin") || lower.includes("hr") || lower.includes("finance")) return "📋";
  if (lower.includes("geology") || lower.includes("survey") || lower.includes("exploration")) return "🔬";
  if (lower.includes("electric") || lower.includes("electrical") || lower.includes("instrument")) return "⚡";
  return "📊";
}

function getWorkloadLevel(score) {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

function getLevelColor(level) {
  switch (level) {
    case "low": return { bar: "var(--accent-green)", bg: "var(--accent-green-light)", text: "var(--success)" };
    case "medium": return { bar: "var(--accent-gold)", bg: "var(--accent-gold-light)", text: "var(--warning)" };
    case "high": return { bar: "#f97316", bg: "rgba(249, 115, 22, 0.12)", text: "#fb923c" };
    case "critical": return { bar: "#ef4444", bg: "rgba(239, 68, 68, 0.12)", text: "#f87171" };
  }
}

function renderDeptGauge(d, index) {
  const level = getWorkloadLevel(d.workloadScore);
  const colors = getLevelColor(level);
  const statusIcon = level === "critical" ? "🔴" : level === "high" ? "🟠" : level === "medium" ? "🟡" : "🟢";

  const trendIcon = d.trend === "up" ? "📈" : d.trend === "down" ? "📉" : "➡️";
  const trendLabel = d.trend === "up" ? "Rising" : d.trend === "down" ? "Declining" : "Stable";

  return `
    <div class="wh-gauge-item" data-level="${level}" style="animation-delay:${index * 0.06}s">
      <div class="wh-gauge-item-head">
        <div class="wh-gauge-item-left">
          <span class="wh-gauge-item-icon" style="background:${colors.bg}; border-color:${colors.bar}40;">${d.icon}</span>
          <div class="wh-gauge-item-info">
            <span class="wh-gauge-item-name">${d.name}</span>
            <span class="wh-gauge-item-meta">${d.activeWorkers}/${d.totalWorkers} workers · ${d.openTickets} open · ${d.openIncidents} incidents</span>
          </div>
        </div>
        <div class="wh-gauge-item-right">
          <span class="wh-gauge-item-trend" title="${trendLabel} workload">${trendIcon}</span>
          <span class="wh-gauge-item-status" style="color:${colors.text}">${statusIcon} ${level.charAt(0).toUpperCase() + level.slice(1)}</span>
          <span class="wh-gauge-item-score">${d.workloadScore}%</span>
        </div>
      </div>
      <div class="wh-gauge-item-bar-track">
        <div class="wh-gauge-item-bar-fill" style="width:${d.workloadScore}%; background:${colors.bar}; box-shadow: 0 0 10px ${colors.bar}50;"></div>
      </div>
      <div class="wh-gauge-item-stats">
        <span class="wh-gauge-item-stat">
          <strong style="color:${colors.text}">${d.criticalTickets}</strong> Critical tickets
        </span>
        <span class="wh-gauge-item-stat">
          <strong>${d.totalTickets}</strong> Total tickets
        </span>
        <span class="wh-gauge-item-stat">
          <strong>${d.openIncidents}</strong> Open incidents
        </span>
        <span class="wh-gauge-item-stat">
          <strong>${d.recentTickets}</strong> Last 7 days
        </span>
      </div>
    </div>
  `;
}

