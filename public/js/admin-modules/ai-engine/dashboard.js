/**
 * KHING AI - Admin AI Intelligence Dashboard
 * 
 * Renders the enterprise AI Operational Intelligence UI including:
 * - Operational Health Score gauge
 * - Risk prediction cards
 * - Metrics summary
 * - Recommendations panel
 * - Risk trend chart using Chart.js
 */

let riskChartInstance = null;

/**
 * Render the full AI Intelligence dashboard
 */
export function renderAIDashboard(metrics, predictions, risk, recommendations) {
  console.log("[AI Engine] Rendering AI dashboard...");
  
  const root = document.getElementById("ai-prediction-root");
  if (!root) {
    console.error("[AI Engine] AI prediction root container not found");
    return;
  }

  // Build the HTML structure
  root.innerHTML = `
    <div class="khh-ai-container">
      <!-- Health Score -->
      <div class="khh-ai-health-card" id="khh-ai-health-section">
        <div class="khh-ai-health-gauge">
          <div class="khh-ai-gauge-visual">
            <svg viewBox="0 0 120 120" class="khh-ai-gauge-svg">
              <circle cx="60" cy="60" r="54" fill="none" 
                stroke="rgba(255,255,255,0.08)" stroke-width="8"/>
              <circle cx="60" cy="60" r="54" fill="none" 
                stroke="${risk.color}" stroke-width="8" 
                stroke-linecap="round"
                stroke-dasharray="${2 * Math.PI * 54}" 
                stroke-dashoffset="${2 * Math.PI * 54 * (1 - risk.score / 100)}"
                transform="rotate(-90 60 60)"
                class="khh-ai-gauge-arc"/>
            </svg>
            <div class="khh-ai-gauge-text">
              <span class="khh-ai-gauge-score">${risk.score}</span>
              <span class="khh-ai-gauge-unit">/100</span>
            </div>
          </div>
          <div class="khh-ai-health-info">
            <h2 class="khh-ai-health-title">Operational Health Score</h2>
            <span class="khh-ai-health-level" style="color:${risk.color}">
              ${risk.level}
            </span>
            <span class="khh-ai-health-status">${risk.status}</span>
            <p class="khh-ai-health-desc muted">
              Weighted assessment based on safety (40%), work orders (30%), 
              equipment (20%), and workforce (10%).
            </p>
          </div>
        </div>
      </div>

      <!-- Risk Prediction Cards -->
      <div class="khh-ai-risk-grid" id="khh-ai-risk-cards">
        ${predictions.map(pred => renderRiskCard(pred)).join("")}
      </div>

      <!-- Metrics Summary + Recommendations Row -->
      <div class="khh-ai-row">
        <!-- Metrics Summary -->
        <div class="khh-ai-metrics-card" id="khh-ai-metrics-summary">
          <h3 class="khh-ai-section-title">📊 Metrics at a Glance</h3>
          <div class="khh-ai-metrics-grid">
            ${renderMetricsSummary(metrics)}
          </div>
        </div>

        <!-- Recommendations -->
        <div class="khh-ai-recommendations-card" id="khh-ai-recommendations">
          <h3 class="khh-ai-section-title">💡 Recommendations</h3>
          <div class="khh-ai-rec-list">
            ${renderRecommendations(recommendations)}
          </div>
        </div>
      </div>

      <!-- Risk Trend Chart -->
      <div class="khh-ai-chart-card" id="khh-ai-risk-chart">
        <h3 class="khh-ai-section-title">📈 Risk Trend</h3>
        <div class="khh-ai-chart-wrap">
          <canvas id="khh-ai-risk-trend-chart"></canvas>
        </div>
      </div>
    </div>
  `;

  // Initialize risk trend chart
  initRiskHistoryChart();
}

/**
 * Render a single risk prediction card
 */
function renderRiskCard(pred) {
  const bgColor = pred.level === "high" 
    ? "rgba(239,68,68,0.12)" 
    : pred.level === "medium" 
      ? "rgba(234,179,8,0.12)" 
      : "rgba(34,197,94,0.12)";
  
  const borderColor = pred.level === "high"
    ? "rgba(239,68,68,0.35)"
    : pred.level === "medium"
      ? "rgba(234,179,8,0.35)"
      : "rgba(34,197,94,0.35)";

  const labelColor = pred.level === "high"
    ? "#fca5a5"
    : pred.level === "medium"
      ? "#fde68a"
      : "#bbf7d0";

  return `
    <div class="khh-ai-risk-card" style="border-color:${borderColor}">
      <div class="khh-ai-risk-header">
        <span class="khh-ai-risk-icon">${pred.icon}</span>
        <span class="khh-ai-risk-title">${pred.title}</span>
      </div>
      <div class="khh-ai-risk-bar-container">
        <div class="khh-ai-risk-bar-bg">
          <div class="khh-ai-risk-bar-fill" 
               style="width:${pred.riskScore}%;background:${borderColor.replace(",0.35)", ",0.6)")}"></div>
        </div>
        <span class="khh-ai-risk-score" style="color:${labelColor}">${pred.label}</span>
      </div>
      <ul class="khh-ai-risk-factors">
        ${pred.factors.map(f => `<li>${f}</li>`).join("")}
      </ul>
    </div>
  `;
}

/**
 * Render metrics summary grid items
 */
function renderMetricsSummary(metrics) {
  const items = [];

  // Workers
  items.push({
    icon: "👷",
    label: "Workers",
    value: `${metrics.workers.active}/${metrics.workers.total}`,
    subtitle: `Active`,
  });

  // Work Orders
  items.push({
    icon: "📋",
    label: "Work Orders",
    value: `${metrics.workOrders.open}`,
    subtitle: `Open (${metrics.workOrders.total} total)`,
  });

  // Safety
  items.push({
    icon: "⚠️",
    label: "Safety Incidents",
    value: `${metrics.safety.open}`,
    subtitle: `Open (${metrics.safety.total} total)`,
  });

  // Equipment
  items.push({
    icon: "🚜",
    label: "Equipment",
    value: `${metrics.equipment.operational}`,
    subtitle: `Operational (${metrics.equipment.total} total)`,
  });

  // Tickets
  items.push({
    icon: "🎫",
    label: "Tickets",
    value: `${metrics.tickets.pending}`,
    subtitle: `Pending (${metrics.tickets.total} total)`,
  });

  // Notifications
  items.push({
    icon: "🔔",
    label: "Notifications",
    value: `${metrics.notifications.unread}`,
    subtitle: `Unread (${metrics.notifications.total} total)`,
  });

  return items.map(item => `
    <div class="khh-ai-metric-item">
      <span class="khh-ai-metric-icon">${item.icon}</span>
      <div class="khh-ai-metric-info">
        <strong class="khh-ai-metric-value">${item.value}</strong>
        <span class="khh-ai-metric-label">${item.label}</span>
        <span class="khh-ai-metric-sub muted">${item.subtitle}</span>
      </div>
    </div>
  `).join("");
}

/**
 * Render recommendations list
 */
function renderRecommendations(recommendations) {
  if (!recommendations || recommendations.length === 0) {
    return `<div class="khh-ai-rec-empty muted">No recommendations at this time.</div>`;
  }

  const priorityColors = {
    critical: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#22c55e",
  };

  return recommendations.map(rec => `
    <div class="khh-ai-rec-item">
      <div class="khh-ai-rec-header">
        <span class="khh-ai-rec-priority" 
              style="background:${priorityColors[rec.priority] || "#94a3b8"}">
          ${rec.priority}
        </span>
        <span class="khh-ai-rec-domain">${rec.domain}</span>
      </div>
      <strong class="khh-ai-rec-title">${rec.title}</strong>
      <p class="khh-ai-rec-desc muted">${rec.description}</p>
    </div>
  `).join("");
}

/**
 * Initialize risk history chart using Chart.js
 */
async function initRiskHistoryChart() {
  const ctx = document.getElementById("khh-ai-risk-trend-chart");
  if (!ctx) return;

  // Fetch risk history from Supabase
  const { supabase } = await import("../../supabaseClient.js");
  const { data: history } = await supabase
    .from("risk_history")
    .select("risk_score, risk_level, created_at")
    .order("created_at", { ascending: true })
    .limit(20);

  if (!history || history.length === 0) {
    ctx.parentElement.innerHTML = `
      <div class="muted" style="text-align:center;padding:20px">
        No risk history data available yet. Data will populate as the 
        AI Daily Report generates entries.
      </div>
    `;
    return;
  }

  // Destroy existing chart if it exists
  if (riskChartInstance) {
    riskChartInstance.destroy();
    riskChartInstance = null;
  }

  const labels = history.map(h => 
    h.created_at ? new Date(h.created_at).toLocaleDateString() : ""
  );
  const values = history.map(h => h.risk_score || 0);

  // Color based on latest score
  const latestScore = values[values.length - 1] || 0;
  const lineColor = latestScore > 60 ? "#ef4444" : latestScore > 30 ? "#eab308" : "#22c55e";

  riskChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Risk Score",
        data: values,
        borderColor: lineColor,
        backgroundColor: lineColor.replace(")", ",0.15)").replace("rgb", "rgba"),
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: lineColor,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#94a3b8", font: { weight: "bold" } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `Risk Score: ${ctx.parsed.y}/100`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.06)" },
          ticks: { color: "#94a3b8", maxTicksLimit: 10 },
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: "rgba(255,255,255,0.06)" },
          ticks: { color: "#94a3b8" },
        },
      },
    },
  });
}

/**
 * Clean up chart instance on page unload
 */
export function cleanupAIEngine() {
  if (riskChartInstance) {
    riskChartInstance.destroy();
    riskChartInstance = null;
  }
}
