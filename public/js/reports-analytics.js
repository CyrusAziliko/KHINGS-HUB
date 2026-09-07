import { initWorkerExecAnalytics, refreshWorkerExecAnalytics } from "./worker-exec-analytics.js";
import { initAIPredictionEngine } from "./ai-prediction-engine.js";

let charts = {};

function destroyChart(id) {
  if (charts[id]) {
    try {
      charts[id].destroy();
    } catch {}
  }
  charts[id] = null;
}

function canvasEl(id) {
  return document.getElementById(id);
}

function getAnalyticsState() {
  return window.__WORKER_EXEC_ANALYTICS__;
}

function hasWorkerContext() {
  return Boolean(window?.currentWorker?.id);
}

function ensureButtonsWire() {
  const pdfBtn = document.getElementById("export-pdf");
  const xlsBtn = document.getElementById("export-excel");
  const printBtn = document.getElementById("print-report");

  pdfBtn?.addEventListener("click", () => exportToPDF());
  xlsBtn?.addEventListener("click", () => exportToExcel());
  printBtn?.addEventListener("click", () => window.print());
}

function exportToPDF() {
  if (!window.jspdf?.jsPDF) {
    console.warn("jsPDF missing");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const state = getAnalyticsState();
  const kpis = state?.kpis || {};

  doc.setFontSize(16);
  doc.text("VaultDesk — Executive Analytics", 10, 10);

  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 10, 18);

  doc.setFontSize(12);
  const y0 = 28;
  doc.text(`Total Workers: ${kpis.totalWorkers ?? 0}`, 10, y0);
  doc.text(`Open Tickets: ${kpis.openTickets ?? 0}`, 10, y0 + 7);
  doc.text(`Active Equipment: ${kpis.activeEquipment ?? 0}`, 10, y0 + 14);
  doc.text(`Safety Score: ${kpis.safetyScore ?? 0}/100`, 10, y0 + 21);

  const chartIds = [
    { id: "chart-dept", label: "Tickets by Department" },
    { id: "chart-incidents", label: "Safety Incidents by Month" },
    { id: "chart-equipment", label: "Equipment Downtime Status" },
    { id: "chart-productivity", label: "Worker Productivity Ranking" },
  ];

  let y = 50;
  for (const c of chartIds) {
    const el = document.getElementById(c.id);
    if (!el) continue;

    // `el` is canvas
    const imgData = el.toDataURL("image/png", 1.0);

    doc.setFontSize(11);
    doc.text(c.label, 10, y);
    y += 6;

    const pageWidth = doc.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 20;
    const imgHeight = (imgWidth * el.height) / el.width;

    if (y + imgHeight > 285) {
      doc.addPage();
      y = 10;
    }

    doc.addImage(imgData, "PNG", 10, y, imgWidth, imgHeight);
    y += imgHeight + 10;
  }

  doc.save(`executive-analytics-${Date.now()}.pdf`);
}

function exportToExcel() {
  if (!window.XLSX) {
    console.warn("SheetJS XLSX missing");
    return;
  }

  const state = getAnalyticsState();
  const kpis = state?.kpis || {};
  const datasets = state?.datasets || {};

  const wbData = [];

  wbData.push([
    ["KPI", "Value"],
    ["Total Workers", kpis.totalWorkers ?? 0],
    ["Open Tickets", kpis.openTickets ?? 0],
    ["Active Equipment", kpis.activeEquipment ?? 0],
    ["Safety Score", `${kpis.safetyScore ?? 0}/100`],
  ]);

  const dept = datasets.ticketsByDepartment || {};
  wbData.push([
    ["Department", "Tickets"],
    ...Object.entries(dept).map(([department, count]) => [department, count]),
  ]);

  const inc = datasets.incidentsByMonth || {};
  wbData.push([
    ["Month", "Unresolved Incidents"],
    ...Object.entries(inc).map(([month, count]) => [month, count]),
  ]);

  const eq = datasets.equipmentStatus || {};
  wbData.push([
    ["Equipment Status", "Count"],
    ...Object.entries(eq).map(([status, count]) => [status, count]),
  ]);

  const prod = datasets.productivityRanking || [];
  wbData.push([
    ["Worker", "Completed Work Orders"],
    ...prod.map((p) => [p.worker, p.count]),
  ]);

  const sheetNames = [
    "KPIs",
    "TicketsByDepartment",
    "IncidentsByMonth",
    "EquipmentStatus",
    "ProductivityRanking",
  ];

  const sheets = wbData.map((rows, idx) => {
    const ws = window.XLSX.utils.aoa_to_sheet(rows);
    return { name: sheetNames[idx], ws };
  });

  const wb = window.XLSX.utils.book_new();
  sheets.forEach(({ name, ws }) => window.XLSX.utils.book_append_sheet(wb, ws, name));
  window.XLSX.writeFile(wb, `executive-analytics-${Date.now()}.xlsx`);
}

function renderChartsFromState() {
  const state = getAnalyticsState();
  const datasets = state?.datasets;
  if (!datasets || !window.Chart) return;

  const deptMap = datasets.ticketsByDepartment || {};
  const incidentMap = datasets.incidentsByMonth || {};
  const eqMap = datasets.equipmentStatus || {};
  const prod = Array.isArray(datasets.productivityRanking) ? datasets.productivityRanking : [];

  // 1) Tickets by Department (Bar)
  destroyChart("dept");
  const deptCanvas = canvasEl("chart-dept");
  if (deptCanvas) {
    const sortedDepartments = Object.entries(deptMap)
      .sort((a, b) => b[1] - a[1]);
    const deptLabels = sortedDepartments.map(([department]) => department);
    const deptValues = sortedDepartments.map(([, count]) => Number(count) || 0);

    charts.dept = new Chart(deptCanvas, {
      type: "bar",
      data: {
        labels: deptLabels,
        datasets: [
          {
            label: "Tickets",
            data: deptValues,
            backgroundColor: "rgba(99, 102, 241, 0.55)",
            borderColor: "rgba(99, 102, 241, 1)",
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false,
            barThickness: 24,
            maxBarThickness: 30,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 800, easing: "easeOutQuart" },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `Tickets: ${ctx.raw}`,
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: "rgba(148, 163, 184, 0.18)" },
            ticks: { color: "#94a3b8", precision: 0 },
          },
          y: {
            grid: { display: false },
            ticks: { color: "#94a3b8", autoSkip: false },
          },
        },
      },
    });
  }

  // 2) Safety incidents by Month (Line)
  destroyChart("incidents");
  const incCanvas = canvasEl("chart-incidents");
  if (incCanvas) {
    const rawMonths = Object.keys(incidentMap);
    const safeMonths = rawMonths.length ? rawMonths : ["No Data"];
    const safeValues = rawMonths.length ? rawMonths.map((m) => Number(incidentMap[m]) || 0) : [0];

    const ctx = incCanvas.getContext("2d");
    const gradient = ctx
      ? (() => {
          const g = ctx.createLinearGradient(0, 0, 0, 260);
          g.addColorStop(0, "rgba(34, 197, 94, 0.45)");
          g.addColorStop(0.55, "rgba(56, 189, 248, 0.22)");
          g.addColorStop(1, "rgba(15, 23, 42, 0.05)");
          return g;
        })()
      : "rgba(34, 197, 94, 0.2)";

    charts.incidents = new Chart(incCanvas, {
      type: "line",
      data: {
        labels: safeMonths,
        datasets: [
          {
            label: "Unresolved Incidents",
            data: safeValues,
            borderColor: "rgba(34, 197, 94, 0.95)",
            backgroundColor: gradient,
            pointBackgroundColor: "rgba(56, 189, 248, 1)",
            pointBorderColor: "#0f172a",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.38,
            borderWidth: 2.6,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1000, easing: "easeOutQuart" },
        plugins: {
          legend: {
            labels: {
              color: "#e5e7eb",
              usePointStyle: true,
              pointStyle: "circle",
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `Unresolved Incidents: ${ctx.raw}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: "rgba(148, 163, 184, 0.18)" },
            ticks: { color: "#94a3b8", precision: 0 },
          },
          x: {
            grid: { color: "rgba(148, 163, 184, 0.08)" },
            ticks: { color: "#94a3b8" },
          },
        },
      },
    });
  }

  // 3) Equipment downtime status (Doughnut)
  destroyChart("equipment");
  const eqCanvas = canvasEl("chart-equipment");
  if (eqCanvas) {
    const eqEntries = Object.entries(eqMap).filter(([, v]) => Number(v) > 0);
    const eqWrap = eqCanvas.closest('.analytics-chart-canvas-wrap') || eqCanvas.parentElement;

    // If there is no equipment data, show an empty state instead of a placeholder doughnut
    if (!eqEntries.length) {
      // Avoid duplicating the empty-state node
      let existingEmpty = eqWrap.querySelector('.analytics-empty-chart');
      if (!existingEmpty) {
        const msg = document.createElement('div');
        msg.className = 'analytics-empty-chart';
        msg.textContent = 'No equipment downtime data available';
        msg.style.display = 'flex';
        msg.style.alignItems = 'center';
        msg.style.justifyContent = 'center';
        msg.style.height = '100%';
        msg.style.padding = '12px';
        msg.style.color = '#94a3b8';
        msg.style.fontSize = '14px';
        msg.style.textAlign = 'center';
        msg.style.pointerEvents = 'none';
        eqWrap.appendChild(msg);
      }
      eqCanvas.style.display = 'none';
      // ensure no chart instance remains
      charts.equipment = null;
    } else {
      // Remove any previous empty-state and render the chart normally
      const existingEmpty = eqWrap.querySelector('.analytics-empty-chart');
      if (existingEmpty) existingEmpty.remove();
      eqCanvas.style.display = '';

      const safeEqEntries = eqEntries;

      const colorMap = {
        Active: "rgba(34, 197, 94, 0.78)",
        Maintenance: "rgba(56, 189, 248, 0.78)",
        Faulty: "rgba(239, 68, 68, 0.78)",
        Unknown: "rgba(148, 163, 184, 0.78)",
        "No Data": "rgba(100, 116, 139, 0.55)",
      };

      charts.equipment = new Chart(eqCanvas, {
        type: "doughnut",
        data: {
          labels: safeEqEntries.map(([k]) => k),
          datasets: [
            {
              data: safeEqEntries.map(([, v]) => Number(v) || 0),
              backgroundColor: safeEqEntries.map(([k]) => colorMap[k] || "rgba(148, 163, 184, 0.7)"),
              borderColor: "rgba(15,23,42,0.9)",
              borderWidth: 2,
              hoverOffset: 10,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 1000, easing: "easeOutQuart" },
          cutout: "62%",
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: "#cbd5e1",
                boxWidth: 12,
                usePointStyle: true,
                pointStyle: "circle",
              },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ${ctx.raw}`,
              },
            },
          },
        },
      });
    }
  }

  // 4) Worker productivity ranking (Horizontal bar)
  destroyChart("productivity");
  const prodCanvas = canvasEl("chart-productivity");
  if (prodCanvas) {
    const safeProdArr = prod.length ? prod : [];
    const prodWrap = prodCanvas.closest('.analytics-chart-canvas-wrap') || prodCanvas.parentElement;

    if (!safeProdArr.length) {
      // No productivity data — show centered empty state and hide the canvas
      let existingEmpty = prodWrap.querySelector('.analytics-empty-chart');
      if (!existingEmpty) {
        const msg = document.createElement('div');
        msg.className = 'analytics-empty-chart';
        msg.textContent = 'No worker productivity data available';
        msg.style.display = 'flex';
        msg.style.alignItems = 'center';
        msg.style.justifyContent = 'center';
        msg.style.height = '100%';
        msg.style.padding = '12px';
        msg.style.color = '#94a3b8';
        msg.style.fontSize = '14px';
        msg.style.textAlign = 'center';
        msg.style.pointerEvents = 'none';
        prodWrap.appendChild(msg);
      }
      prodCanvas.style.display = 'none';
      charts.productivity = null;
    } else {
      // Remove empty state if present, show canvas and render chart
      const existingEmpty = prodWrap.querySelector('.analytics-empty-chart');
      if (existingEmpty) existingEmpty.remove();
      prodCanvas.style.display = '';

      const safeProd = safeProdArr;

      charts.productivity = new Chart(prodCanvas, {
        type: "bar",
        data: {
          labels: safeProd.map((p) => p.worker),
          datasets: [
            {
              label: "Completed Work Orders",
              data: safeProd.map((p) => Number(p.count) || 0),
              backgroundColor: [
                "rgba(56, 189, 248, 0.88)",
                "rgba(99, 102, 241, 0.84)",
                "rgba(34, 197, 94, 0.8)",
                "rgba(234, 179, 8, 0.78)",
                "rgba(248, 113, 113, 0.75)",
                "rgba(148, 163, 184, 0.72)",
              ],
              borderColor: "rgba(15,23,42,0.82)",
              borderWidth: 1,
              borderRadius: 10,
              borderSkipped: false,
              barThickness: 18,
              maxBarThickness: 22,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 1000, easing: "easeOutQuart" },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `Completed Work Orders: ${ctx.raw}`,
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: "rgba(148, 163, 184, 0.18)" },
              ticks: { color: "#94a3b8", precision: 0 },
            },
            y: {
              grid: { display: false },
              ticks: { color: "#cbd5e1", font: { weight: "700" } },
            },
          },
        },
      });
    }
  }
}

async function renderPageStructure() {
  const root = document.getElementById("analytics-root") || document.querySelector("[data-reports-analytics-root]");
  if (!root) return;


  root.innerHTML = `
    <section class="analytics-modern">
      <header class="analytics-header">
        <div class="analytics-header-text">
          <h2 class="analytics-title">Analytics & Reports</h2>
          <p class="analytics-subtitle">Executive KPIs, charts, and AI insights updated every 30 seconds.</p>
        </div>

        <div class="analytics-actions">
          <button class="btn ghost" id="export-pdf" type="button">📄 Export PDF</button>
          <button class="btn ghost" id="export-excel" type="button">📊 Export Excel</button>
          <button class="btn ghost" id="print-report" type="button">🖨️ Print</button>
        </div>
      </header>

      <section class="analytics-kpis">
        <article class="card glass analytics-kpi-card">
          <p class="analytics-kpi-label">Total Workers</p>
          <p class="analytics-kpi-value" id="kpi-total-workers">0</p>
          <p class="analytics-kpi-meta">Workers in reporting scope</p>
        </article>

        <article class="card glass analytics-kpi-card">
          <p class="analytics-kpi-label">Open Tickets</p>
          <p class="analytics-kpi-value" id="kpi-open-tickets">0</p>
          <p class="analytics-kpi-meta">Not resolved yet</p>
        </article>

        <article class="card glass analytics-kpi-card">
          <p class="analytics-kpi-label">Active Equipment</p>
          <p class="analytics-kpi-value" id="kpi-active-equipment">0</p>
          <p class="analytics-kpi-meta">Available assets</p>
        </article>

        <article class="card glass analytics-kpi-card">
          <p class="analytics-kpi-label">Safety Score</p>
          <p class="analytics-kpi-value" id="kpi-safety-score">0</p>
          <p class="analytics-kpi-meta">100-based risk score</p>
        </article>
      </section>

      <section class="analytics-charts-stack">
        <article class="card glass analytics-chart-card">
          <div class="analytics-chart-head">
            <h3 class="h2">Tickets by Department</h3>
          </div>
          <div class="analytics-chart-canvas-wrap analytics-chart-canvas-wrap--dept">
            <canvas id="chart-dept"></canvas>
          </div>
        </article>

        <article class="card glass analytics-chart-card analytics-chart-featured">
          <div class="analytics-chart-head">
            <h3 class="h2">Safety Incidents by Month</h3>
            <span class="analytics-badge">Incident Trends</span>
          </div>
          <div class="analytics-chart-canvas-wrap analytics-chart-canvas-wrap--incidents">
            <canvas id="chart-incidents"></canvas>
          </div>
        </article>

        <div class="analytics-dual-grid">
          <article class="card glass analytics-chart-card analytics-chart-featured">
            <div class="analytics-chart-head">
              <h3 class="h2">Equipment Downtime Status</h3>
              <span class="analytics-badge">Live Status</span>
            </div>
            <div class="analytics-chart-canvas-wrap analytics-chart-canvas-wrap--equipment">
              <canvas id="chart-equipment"></canvas>
            </div>
          </article>

          <article class="card glass analytics-chart-card analytics-chart-featured">
            <div class="analytics-chart-head">
              <h3 class="h2">Worker Productivity Ranking</h3>
              <span class="analytics-badge">Top Performers</span>
            </div>
            <div class="analytics-chart-canvas-wrap analytics-chart-canvas-wrap--productivity">
              <canvas id="chart-productivity"></canvas>
            </div>
          </article>
        </div>
      </section>

      <section class="card glass analytics-ai-card">
        <div class="analytics-chart-head">
          <h3 class="h2">AI Insights</h3>
        </div>
        <div id="ai-prediction-root"></div>
      </section>
    </section>
  `;

  ensureButtonsWire();
}

function renderMissingWorkerContextState() {
  const root = document.getElementById("analytics-root") || document.querySelector("[data-reports-analytics-root]");
  if (!root) return;

  root.innerHTML = `
    <section class="analytics-modern">
      <section class="card glass analytics-empty-state">
        <h3 class="h2">Analytics & Reports</h3>
        <div class="muted">
          Worker context unavailable. Sign in again to load your scoped analytics report.
        </div>
      </section>
    </section>
  `;
}

export async function initReportsAnalytics() {
  const root = document.getElementById("analytics-root") || document.querySelector("[data-reports-analytics-root]");
  if (!root) return;

  if (!hasWorkerContext()) {
    renderMissingWorkerContextState();
    return;
  }

  // Lazy-load SheetJS for Excel export
  if (!window.XLSX) {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    s.async = true;
    document.head.appendChild(s);
  }

  await renderPageStructure();

  // Start KPI engine (Supabase fetching + 30s refresh)
  await initWorkerExecAnalytics();

  // Start AI risk prediction engine (30s refresh)
  initAIPredictionEngine();

  // Initial chart render
  renderChartsFromState();

  // Re-render charts on the same cadence
  setInterval(async () => {
    if (!hasWorkerContext()) {
      renderMissingWorkerContextState();
      return;
    }

    try {
      await refreshWorkerExecAnalytics();
      renderChartsFromState();
    } catch (e) {
      console.warn("exec analytics chart rerender failed", e);
    }
  }, 30000);
}
