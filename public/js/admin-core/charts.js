import { supabase } from "../supabaseClient.js";


let statusChartInstance;
let priorityChartInstance;


function destroyChart(chart) {
  try {
    if (chart && typeof chart.destroy === "function") chart.destroy();
  } catch (_) {
    // ignore
  }
}

export async function loadCharts() {
  const canvas = document.getElementById("statusChart");
  if (!canvas) return;

  destroyChart(statusChartInstance);

  // Fetch ticket status counts
  const { data, error } = await supabase.from("tickets").select("status");
  if (error) throw error;

  const labels = {
    "Open": 0,
    "In Progress": 0,
    "Resolved": 0,
    "Closed": 0,
  };

  for (const t of data || []) {
    const s = t?.status;
    if (s in labels) labels[s] += 1;
  }

  const chartLabels = ["Open", "In Progress", "Resolved", "Closed"];
  const chartValues = chartLabels.map((l) => labels[l]);

  statusChartInstance = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: chartLabels,
      datasets: [
        {
          data: chartValues,
          backgroundColor: [
            "#60a5fa", // Open
            "#fbbf24", // In Progress
            "#34d399", // Resolved
            "#94a3b8", // Closed
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
      cutout: "60%",
    },
  });

  // ================= Priority Analysis =================
  const priorityCanvas = document.getElementById("priorityChart");
  if (!priorityCanvas) return;

  destroyChart(priorityChartInstance);

  const {
    data: priorityData,
    error: priorityError,
  } = await supabase.from("tickets").select("priority");
  if (priorityError) throw priorityError;

  const priorityLabels = ["Low", "Medium", "High", "Critical"];
  const priorityCounts = {
    Low: 0,
    Medium: 0,
    High: 0,
    Critical: 0,
  };

  for (const t of priorityData || []) {
    const p = t?.priority;
    if (p in priorityCounts) priorityCounts[p] += 1;
  }

  const priorityValues = priorityLabels.map((l) => priorityCounts[l]);

  priorityChartInstance = new Chart(priorityCanvas, {
    type: "doughnut",
    data: {
      labels: priorityLabels,
      datasets: [
        {
          data: priorityValues,
          backgroundColor: [
            "#60a5fa", // Low
            "#fbbf24", // Medium
            "#fb7185", // High
            "#ef4444", // Critical
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
      cutout: "60%",
    },
  });
}



