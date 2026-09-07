import { supabase } from "../supabaseClient.js";

// ── Chart references for cleanup ──
let chartInstances = {};

function destroyChart(key) {
  const chart = chartInstances[key];
  try {
    if (chart && typeof chart.destroy === "function") {
      chart.destroy();
    }
  } catch (_) {
    // ignore
  }
  delete chartInstances[key];
}

function destroyAllCharts() {
  Object.keys(chartInstances).forEach(destroyChart);
}

// ── Date helpers ──
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

// ── Fetch raw data ──
async function fetchAnalyticsData() {
  // Fetch tickets with creator profile for activity feed
  const { data: tickets, error } = await supabase
    .from("tickets")
    .select(`
      id,
      title,
      status,
      priority,
      category,
      created_at,
      created_by,
      profiles:created_by ( full_name )
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Failed to load ticket data: " + error.message);

  return tickets || [];
}

// ── Calculate metrics from raw data ──
function calculateMetrics(tickets) {
  const total = tickets.length;

  const statusCounts = {
    Open: 0,
    "In Progress": 0,
    Resolved: 0,
    Closed: 0,
  };

  const priorityCounts = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  };

  const categoryCounts = {};

  // Trend: count per day for last 7 days
  const last7 = getLast7Days();
  const trendCounts = {};
  last7.forEach((d) => (trendCounts[d] = 0));

  let criticalUrgent = 0;

  for (const t of tickets) {
    // Status
    const s = t.status || "Open";
    if (s in statusCounts) statusCounts[s] += 1;

    // Priority
    const p = t.priority || "Medium";
    if (p in priorityCounts) priorityCounts[p] += 1;
    if (p === "Critical") criticalUrgent += 1;

    // Category
    const cat = t.category || "Uncategorized";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

    // Trend
    if (t.created_at) {
      const day = t.created_at.split("T")[0];
      if (day in trendCounts) trendCounts[day] += 1;
    }
  }

  const openTickets = statusCounts["Open"] || 0;
  const inProgressTickets = statusCounts["In Progress"] || 0;
  const resolvedTickets = statusCounts["Resolved"] || 0;

  // Recent activity: top 10 tickets with creator info
  const recentActivity = tickets.slice(0, 10).map((t) => ({
    id: t.id,
    title: t.title || "Untitled Ticket",
    status: t.status || "Open",
    priority: t.priority || "Medium",
    created_at: t.created_at,
    creator_name:
      t.profiles && t.profiles.full_name
        ? t.profiles.full_name
        : t.created_by
        ? t.created_by.slice(0, 8)
        : "Unknown",
  }));

  return {
    total,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    criticalUrgent,
    statusCounts,
    priorityCounts,
    categoryCounts,
    trendCounts,
    last7Days: last7,
    recentActivity,
  };
}

// ── Render KPI row ──
function renderKPIs(metrics) {
  const root = document.getElementById("analytics-root");
  if (!root) return;

  const kpis = [
    { label: "Total Tickets", value: metrics.total, icon: "🎫" },
    { label: "Open", value: metrics.openTickets, icon: "📥" },
    { label: "In Progress", value: metrics.inProgressTickets, icon: "🔄" },
    { label: "Resolved", value: metrics.resolvedTickets, icon: "✅" },
    { label: "Critical", value: metrics.criticalUrgent, icon: "🚨" },
  ];

  const kpiHTML = kpis
    .map(
      (k) => `
    <div class="analytics-kpi-card">
      <span class="analytics-kpi-label">
        <span class="analytics-kpi-icon">${k.icon}</span>${k.label}
      </span>
      <span class="analytics-kpi-value">${k.value}</span>
    </div>`
    )
    .join("");

  // Insert or update KPI section
  let kpiSection = root.querySelector(".analytics-kpi-row");
  if (!kpiSection) {
    kpiSection = document.createElement("div");
    kpiSection.className = "analytics-kpi-row";
    root.insertBefore(kpiSection, root.firstChild);
  }
  kpiSection.innerHTML = kpiHTML;
}

// ── Render charts ──
function renderCharts(metrics) {
  destroyAllCharts();

  const root = document.getElementById("analytics-root");
  if (!root) return;

  // Ensure charts grid exists
  let chartsSection = root.querySelector(".analytics-charts-grid");
  if (!chartsSection) {
    chartsSection = document.createElement("div");
    chartsSection.className = "analytics-charts-grid";
    // Insert after KPI row
    const kpiRow = root.querySelector(".analytics-kpi-row");
    if (kpiRow && kpiRow.nextSibling) {
      root.insertBefore(chartsSection, kpiRow.nextSibling);
    } else {
      root.appendChild(chartsSection);
    }
  }

  chartsSection.innerHTML = `
    <div class="analytics-chart-card">
      <h3 class="analytics-chart-title">Status Distribution</h3>
      <div class="analytics-chart-wrap">
        <canvas id="analytics-chart-status"></canvas>
      </div>
    </div>
    <div class="analytics-chart-card">
      <h3 class="analytics-chart-title">Priority Analysis</h3>
      <div class="analytics-chart-wrap">
        <canvas id="analytics-chart-priority"></canvas>
      </div>
    </div>
    <div class="analytics-chart-card">
      <h3 class="analytics-chart-title">Ticket Trend (7 Days)</h3>
      <div class="analytics-chart-wrap">
        <canvas id="analytics-chart-trend"></canvas>
      </div>
    </div>
    <div class="analytics-chart-card">
      <h3 class="analytics-chart-title">Category Analysis</h3>
      <div class="analytics-chart-wrap">
        <canvas id="analytics-chart-category"></canvas>
      </div>
    </div>
  `;

  // ── Chart 1: Status Distribution (Doughnut) ──
  const statusCanvas = document.getElementById("analytics-chart-status");
  if (statusCanvas) {
    const statusLabels = ["Open", "In Progress", "Resolved", "Closed"];
    const statusValues = statusLabels.map((l) => metrics.statusCounts[l] || 0);
    chartInstances["status"] = new Chart(statusCanvas, {
      type: "doughnut",
      data: {
        labels: statusLabels,
        datasets: [
          {
            data: statusValues,
            backgroundColor: ["#60a5fa", "#fbbf24", "#34d399", "#94a3b8"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        cutout: "60%",
      },
    });
  }

  // ── Chart 2: Priority Analysis (Horizontal Bar) ──
  const priorityCanvas = document.getElementById("analytics-chart-priority");
  if (priorityCanvas) {
    const priorityLabels = ["Critical", "High", "Medium", "Low"];
    const priorityValues = priorityLabels.map(
      (l) => metrics.priorityCounts[l] || 0
    );
    chartInstances["priority"] = new Chart(priorityCanvas, {
      type: "bar",
      data: {
        labels: priorityLabels,
        datasets: [
          {
            label: "Tickets",
            data: priorityValues,
            backgroundColor: ["#ef4444", "#fb7185", "#fbbf24", "#60a5fa"],
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: "rgba(255,255,255,.06)" },
            ticks: { color: "#94a3b8" },
          },
          y: {
            grid: { display: false },
            ticks: { color: "#e2e8f0" },
          },
        },
      },
    });
  }

  // ── Chart 3: Ticket Trend (Line) ──
  const trendCanvas = document.getElementById("analytics-chart-trend");
  if (trendCanvas) {
    const trendLabels = metrics.last7Days.map((d) => formatDate(d));
    const trendValues = metrics.last7Days.map((d) => metrics.trendCounts[d] || 0);
    chartInstances["trend"] = new Chart(trendCanvas, {
      type: "line",
      data: {
        labels: trendLabels,
        datasets: [
          {
            label: "Tickets Created",
            data: trendValues,
            borderColor: "#8b5cf6",
            backgroundColor: "rgba(139,92,246,.12)",
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: "#8b5cf6",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,.06)" },
            ticks: { color: "#94a3b8" },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(255,255,255,.06)" },
            ticks: { color: "#94a3b8" },
          },
        },
      },
    });
  }

  // ── Chart 4: Category Analysis (Bar) ──
  const categoryCanvas = document.getElementById("analytics-chart-category");
  if (categoryCanvas) {
    const catLabels = Object.keys(metrics.categoryCounts);
    const catValues = Object.values(metrics.categoryCounts);
    const catColors = catLabels.map(
      (_, i) =>
        [
          "#8b5cf6",
          "#3b82f6",
          "#10b981",
          "#f59e0b",
          "#ef4444",
          "#ec4899",
          "#6366f1",
          "#14b8a6",
        ][i % 8]
    );
    chartInstances["category"] = new Chart(categoryCanvas, {
      type: "bar",
      data: {
        labels: catLabels,
        datasets: [
          {
            label: "Tickets",
            data: catValues,
            backgroundColor: catColors,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#e2e8f0", maxRotation: 20 },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(255,255,255,.06)" },
            ticks: { color: "#94a3b8" },
          },
        },
      },
    });
  }
}

// ── Render recent activity ──
function renderActivity(metrics) {
  const root = document.getElementById("analytics-root");
  if (!root) return;

  let activitySection = root.querySelector(".analytics-activity-card");
  if (!activitySection) {
    activitySection = document.createElement("div");
    activitySection.className = "analytics-activity-card";
    root.appendChild(activitySection);
  }

  const activity = metrics.recentActivity;

  if (!activity || activity.length === 0) {
    activitySection.innerHTML = `
      <h3 class="analytics-activity-title">📋 Recent Tickets</h3>
      <div class="analytics-activity-empty">No tickets yet.</div>
    `;
    return;
  }

  const badgeClass = (status) => {
    const map = {
      Open: "open",
      "In Progress": "in_progress",
      Resolved: "resolved",
      Closed: "closed",
    };
    return map[status] || "open";
  };

  const itemsHTML = activity
    .map(
      (t) => `
    <div class="analytics-activity-item">
      <div class="analytics-activity-icon">🎫</div>
      <div class="analytics-activity-info">
        <div class="analytics-activity-text">${t.title}</div>
        <div class="analytics-activity-meta">
          ${t.creator_name} · ${formatDateTime(t.created_at)}
        </div>
      </div>
      <span class="analytics-activity-badge ${badgeClass(t.status)}">
        ${t.status}
      </span>
    </div>`
    )
    .join("");

  activitySection.innerHTML = `
    <h3 class="analytics-activity-title">📋 Recent Tickets</h3>
    <div class="analytics-activity-list">${itemsHTML}</div>
  `;
}

// ── Load and render everything ──
export async function loadAnalyticsModule() {
  console.log("Loading Analytics module");

  const root = document.getElementById("analytics-root");
  if (!root) {
    console.error("Analytics root container (#analytics-root) not found");
    return;
  }

  // Show loading state
  root.innerHTML = `
    <div class="card glass analytics-loading">Loading enterprise analytics...</div>
  `;

  try {
    // Fetch and compute
    const tickets = await fetchAnalyticsData();
    const metrics = calculateMetrics(tickets);

    // Clear loading, build fresh structure
    root.innerHTML = "";

    // Render KPI row
    renderKPIs(metrics);

    // Render charts grid
    renderCharts(metrics);

    // Render activity
    renderActivity(metrics);

    console.log("Analytics module loaded successfully", {
      total: metrics.total,
      charts: Object.keys(chartInstances).length,
      recent: metrics.recentActivity.length,
    });
  } catch (err) {
    console.error("Analytics module error:", err);
    root.innerHTML = `
      <div class="card glass analytics-error">
        ⚠ Failed to load analytics: ${err.message}
      </div>
    `;
  }
}

