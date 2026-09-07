import { supabase } from "./supabaseClient.js";

export async function initAnalyticsCharts() {
  const chartEl = document.getElementById("analytics-chart");
  if (!chartEl) return;

  // Dynamic import so the page still loads without Chart.js if needed.
  const { Chart } = await import("https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const tickets = await supabase.from("tickets").select("status");
  if (tickets.error) throw tickets.error;

  const counts = (tickets.data || []).reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  const labels = Object.keys(counts);
  const values = labels.map((l) => counts[l]);

  new Chart(chartEl, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Tickets by Status",
          data: values,
          backgroundColor: "rgba(99, 102, 241, 0.6)",
          borderColor: "rgba(99, 102, 241, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: { beginAtZero: true },
      },
    },
  });
}

