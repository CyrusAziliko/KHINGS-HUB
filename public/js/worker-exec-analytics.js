import { supabase } from "./supabaseClient.js";

let refreshTimer;

function safeNumber(n) {
  return Number.isFinite(Number(n)) ? Number(n) : 0;
}

function labelOrUnknown(v, fallback = "Unknown") {
  const s = v == null ? "" : String(v);
  return s.trim() ? s : fallback;
}

function computeKPIs({ tickets, safetyIncidents, equipment }) {
  const openTickets = tickets.filter((t) => t.status !== "Resolved");
  const openTicketsCount = openTickets.length;

  const highPriorityTickets = tickets.filter(
    (t) => t.priority === "High" || t.priority === "Critical",
  );
  const highPriorityCount = highPriorityTickets.length;

  const activeIncidents = safetyIncidents.filter((i) => i.status !== "Resolved");
  const activeIncidentsCount = activeIncidents.length;

  const criticalIncidents = safetyIncidents.filter(
    (i) => i.severity === "High" || i.severity === "Critical",
  );
  const criticalIncidentsCount = criticalIncidents.length;

  const activeEquipmentIssues = equipment.filter((e) => e.status !== "Active");
  const equipmentIssuesCount = activeEquipmentIssues.length;

  // Safety score: 100 - weighted penalties (clamped)
  const penalty = criticalIncidentsCount * 8 + activeIncidentsCount * 2;
  const safetyScore = Math.max(0, Math.min(100, 100 - penalty));

  // For the charts page to build its own datasets
  const departments = openTickets.map((t) => labelOrUnknown(t.department));

  return {
    totalWorkers: safeNumber(new Set(tickets.map((t) => t.worker_id).filter(Boolean)).size || 0),
    openTickets: safeNumber(openTicketsCount),
    activeEquipment: safeNumber(Math.max(0, equipment.length - equipmentIssuesCount)),
    safetyScore: safeNumber(Math.round(safetyScore)),

    // extra info for charts
    highPriorityCount: safeNumber(highPriorityCount),
    criticalIncidentsCount: safeNumber(criticalIncidentsCount),
    departments,
  };
}

function generateAIInsights({ kpis, datasets }) {
  const { ticketsByDepartment, incidentsByMonth, equipmentStatus, productivityRanking } = datasets;

  const topDept = Object.entries(ticketsByDepartment)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  const mostRecentMonth = Object.keys(incidentsByMonth).slice(-1)[0];
  const latestIncidents = mostRecentMonth ? incidentsByMonth[mostRecentMonth] : 0;

  const downtimeDominantStatus = Object.entries(equipmentStatus)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  const topWorker = productivityRanking[0]?.worker;
  const bottomWorker = productivityRanking[productivityRanking.length - 1]?.worker;

  const insights = [];

  if (kpis.safetyScore <= 70) {
    insights.push(
      `Safety score is ${kpis.safetyScore}/100. Focus on incident root-cause reviews and targeted retraining for high-risk activities.`,
    );
  } else {
    insights.push(
      `Safety score is strong (${kpis.safetyScore}/100). Maintain current controls and continue proactive hazard reporting.`,
    );
  }

  if (topDept) {
    insights.push(
      `Highest ticket volume is in ${topDept}. Review staffing and common failure modes in this department to reduce open-ticket backlog.`,
    );
  }

  if (mostRecentMonth) {
    insights.push(
      `Incidents in ${mostRecentMonth} are ${latestIncidents}. If this is trending upward vs earlier months, prioritize safety checks and equipment inspections before shifts.`,
    );
  }

  if (downtimeDominantStatus) {
    insights.push(
      `Equipment downtime/status is dominated by “${downtimeDominantStatus}”. Schedule preventive maintenance and verify spare-part availability for recurring downtime causes.`,
    );
  }

  if (topWorker && bottomWorker && topWorker !== bottomWorker) {
    insights.push(
      `Productivity leader: ${topWorker}. Consider pairing ${bottomWorker} with a high-performing mentor to accelerate best-practice adoption.`,
    );
  }

  return insights;
}

function toMonthKey(d) {
  if (!d) return "Unknown";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "Unknown";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function destroyChartsIfPresent() {
  // charts are owned by reports page; nothing here.
}

function getCurrentWorkerId() {
  return window?.currentWorker?.id ?? null;
}

function getEmptyScopedDatasets() {
  return {
    tickets: [],
    safetyIncidents: [],
    equipment: [],
    workOrders: [],
    workerProfiles: [],
  };
}

async function fetchDatasets() {
  const workerId = getCurrentWorkerId();
  if (!workerId) return getEmptyScopedDatasets();

  const [ticketsRes, incidentsRes, equipmentRes, workOrdersRes] = await Promise.allSettled([
    supabase
      .from("tickets")
      .select("status, priority, department, created_at, assigned_to, worker_id")
      .eq("worker_id", workerId),
    supabase
      .from("safety_incidents")
      .select("status, severity, created_at, worker_id"),
    supabase
      .from("equipment")
      .select("status,assigned_to")
      .eq("assigned_to", workerId),
    supabase
      .from("work_orders")
      .select("status, assigned_to")
      .not("assigned_to", "is", null),
  ]);

  const tickets = ticketsRes.status === "fulfilled" ? ticketsRes.value?.data || [] : [];
  const incidentsAll = incidentsRes.status === "fulfilled" ? incidentsRes.value?.data || [] : [];
  const equipment = equipmentRes.status === "fulfilled" ? equipmentRes.value?.data || [] : [];
  const workOrders = workOrdersRes.status === "fulfilled" ? workOrdersRes.value?.data || [] : [];

  if (workOrdersRes.status === "rejected") {
    console.error("Worker productivity query failed for work_orders:", workOrdersRes.reason);
  } else if (workOrdersRes.value?.error) {
    console.error("Worker productivity query returned Supabase error:", workOrdersRes.value.error);
  }

  const assignedWorkerIds = [...new Set(
    workOrders
      .map((wo) => wo?.assigned_to)
      .filter(Boolean),
  )];
  let workerProfiles = [];
  if (assignedWorkerIds.length) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", assignedWorkerIds);
    if (error) {
      console.error("Worker productivity profile lookup failed:", error);
    } else {
      workerProfiles = data || [];
    }
  }

  const hasIncidentWorkerField = incidentsAll.some(
    (i) => i && Object.prototype.hasOwnProperty.call(i, "worker_id"),
  );
  const safetyIncidents = hasIncidentWorkerField
    ? incidentsAll.filter((i) => String(i.worker_id) === String(workerId))
    : [];

  return {
    tickets,
    safetyIncidents,
    equipment,
    workOrders,
    workerProfiles,
  };
}

function buildDatasets({ tickets, safetyIncidents, equipment, workOrders, workerProfiles }) {
  const ticketsByDepartment = tickets.reduce((acc, t) => {
    const dept = labelOrUnknown(t.department);
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {});

  const incidentsByMonth = safetyIncidents.reduce((acc, i) => {
    const key = toMonthKey(i.created_at);
    // Count unresolved incidents only
    if (i.status !== "Resolved") {
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {});

  // Sort month keys ascending
  const incidentsByMonthSorted = Object.keys(incidentsByMonth)
    .sort()
    .reduce((acc, k) => {
      acc[k] = incidentsByMonth[k];
      return acc;
    }, {});

  const equipmentStatus = equipment.reduce((acc, e) => {
    const st = labelOrUnknown(e.status);
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});

  const workerNameById = (workerProfiles || []).reduce((acc, p) => {
    const id = p?.id == null ? "" : String(p.id);
    if (!id) return acc;
    acc[id] = labelOrUnknown(p.full_name, id);
    return acc;
  }, {});

  // Productivity ranking: completed work orders grouped by assigned worker
  const productivityCounts = (workOrders || []).reduce((acc, wo) => {
    const completed = String(wo?.status || "").trim().toLowerCase() === "completed";
    if (!completed) return acc;

    const assignedId = wo?.assigned_to == null ? "" : String(wo.assigned_to);
    if (!assignedId) return acc;
    const worker = workerNameById[assignedId] || labelOrUnknown(assignedId, "Worker");
    acc[worker] = (acc[worker] || 0) + 1;
    return acc;
  }, {});

  const productivityRanking = Object.entries(productivityCounts)
    .map(([worker, count]) => ({ worker, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    ticketsByDepartment,
    incidentsByMonth: incidentsByMonthSorted,
    equipmentStatus,
    productivityRanking,
  };
}

export async function refreshWorkerExecAnalytics() {
  const workerId = getCurrentWorkerId();

  let kpis;
  let chartDatasets;
  let aiInsights;

  if (!workerId) {
    kpis = {
      totalWorkers: 0,
      openTickets: 0,
      activeEquipment: 0,
      safetyScore: 0,
      highPriorityCount: 0,
      criticalIncidentsCount: 0,
      departments: [],
    };

    chartDatasets = {
      ticketsByDepartment: {},
      incidentsByMonth: {},
      equipmentStatus: {},
      productivityRanking: [],
    };

    aiInsights = ["Worker context unavailable. Unable to load scoped analytics."];
  } else {
    const datasets = await fetchDatasets();
    kpis = computeKPIs(datasets);
    chartDatasets = buildDatasets(datasets);
    aiInsights = generateAIInsights({ kpis, datasets: chartDatasets });
  }

  window.__WORKER_EXEC_ANALYTICS__ = {
    kpis,
    datasets: chartDatasets,
    aiInsights,
  };

  // Render KPIs + AI Insights into DOM if elements exist
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };

  setText("kpi-total-workers", kpis.totalWorkers);
  setText("kpi-open-tickets", kpis.openTickets);
  setText("kpi-active-equipment", kpis.activeEquipment);
  setText("kpi-safety-score", kpis.safetyScore);

  const aiEl = document.getElementById("ai-insights") || document.getElementById("ai-insights-panel");
  if (aiEl) {
    aiEl.innerHTML = "";
    const ul = document.createElement("ul");
    ul.style.margin = "0";
    ul.style.paddingLeft = "18px";
    ul.style.listStyle = "disc";

    if (aiInsights.length === 0) {
      const p = document.createElement("div");
      p.textContent = "No insights available yet.";
      aiEl.appendChild(p);
    } else {
      aiInsights.forEach((s) => {
        const li = document.createElement("li");
        li.textContent = s;
        li.style.marginBottom = "8px";
        ul.appendChild(li);
      });
      aiEl.appendChild(ul);
    }
  }

  return window.__WORKER_EXEC_ANALYTICS__;
}

export function startWorkerExecAnalyticsAutoRefresh({ intervalMs = 30000 } = {}) {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    refreshWorkerExecAnalytics().catch((e) => console.warn("exec analytics refresh failed", e));
  }, intervalMs);
}

export async function initWorkerExecAnalytics() {
  await refreshWorkerExecAnalytics();
  startWorkerExecAnalyticsAutoRefresh({ intervalMs: 30000 });
}

// Back-compat for any older imports
export default {
  initWorkerExecAnalytics,
  refreshWorkerExecAnalytics,
};

