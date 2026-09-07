import { supabase } from "./supabaseClient.js";


export function initAIReport() {
  const el = document.getElementById("ai-report-content");
  const btn = document.getElementById("refresh-report");

  if (!el) return;

  // small typewriter-like reveal (no external deps)
  function revealHTML(html, opts = {}) {
    const { typingSpeed = 10, cursor = "▍" } = opts;

    const text = String(html ?? "");
    el.innerHTML = "";

    let i = 0;
    const tick = () => {
      i++;
      const chunk = text.slice(0, i);

      el.textContent = chunk;
      if (i < text.length) {
        el.textContent = chunk + cursor;
        setTimeout(tick, typingSpeed);
      } else {
        el.textContent = "";
        el.innerHTML = html;
      }
    };

    tick();
  }

  async function fetchData() {
    // NOTE: schema/table names should match your DB.
    // Uses graceful fallbacks so UI doesn't break.

    const { data: tickets, error: ticketsErr } = await supabase
      .from("tickets")
      .select("status, priority");

    const { data: incidents, error: incidentsErr } = await supabase
      .from("safety_incidents")
      .select("severity, status");

    const { data: equipment, error: equipmentErr } = await supabase
      .from("equipment")
      .select("status");

    if (ticketsErr) console.warn("tickets fetch error", ticketsErr);
    if (incidentsErr) console.warn("safety_incidents fetch error", incidentsErr);
    if (equipmentErr) console.warn("equipment fetch error", equipmentErr);

    return {
      tickets: tickets || [],
      incidents: incidents || [],
      equipment: equipment || [],
    };
  }

  function analyze(data) {
    const tickets = data.tickets || [];
    const incidents = data.incidents || [];
    const equipment = data.equipment || [];

    const openTickets = tickets.filter((t) => t.status !== "Resolved").length;
    const highPriority = tickets.filter(
      (t) => t.priority === "High" || t.priority === "Critical"
    ).length;

    const activeIncidents = incidents.filter((i) => i.status !== "Resolved").length;
    const criticalIncidents = incidents.filter(
      (i) => i.severity === "High" || i.severity === "Critical"
    ).length;

    const equipmentIssues = equipment.filter((e) => e.status !== "Active").length;

    let riskLevel = "Low";
    if (criticalIncidents > 0 || highPriority > 5) riskLevel = "High";
    else if (activeIncidents > 0 || openTickets > 10) riskLevel = "Medium";

    return {
      openTickets,
      highPriority,
      activeIncidents,
      criticalIncidents,
      equipmentIssues,
      riskLevel,
    };
  }

  function generateReportText(stats) {
    const insight =
      stats.riskLevel === "High"
        ? "Immediate attention required. Safety and operational risks are elevated."
        : stats.riskLevel === "Medium"
          ? "Moderate operational load detected. Monitor active tickets and incidents."
          : "Operations are stable. No critical risks detected.";

    return `
📌 DAILY OPERATIONS REPORT (KHING AI)

• Open Tickets: ${stats.openTickets}
• High Priority Tickets: ${stats.highPriority}

• Active Safety Incidents: ${stats.activeIncidents}
• Critical Incidents: ${stats.criticalIncidents}

• Equipment Issues: ${stats.equipmentIssues}

🧠 AI RISK LEVEL: ${stats.riskLevel}

🧠 AI INSIGHT:
${insight}
    `;
  }


  let riskChart;

  async function saveRisk(stats) {
    let score = 0;

    score += stats.openTickets * 1;
    score += stats.highPriority * 2;
    score += stats.activeIncidents * 3;
    score += stats.criticalIncidents * 5;
    score += stats.equipmentIssues * 2;

    let level = "Low";
    if (score > 20) level = "High";
    else if (score > 10) level = "Medium";

    const payload = [
      {
        risk_level: level,
        risk_score: score,
        created_at: new Date(),
      },
    ];

    const { error } = await supabase.from("risk_history").insert(payload);
    if (error) console.warn("risk_history insert failed", error);

    return { score, level };
  }

  async function fetchRiskHistory() {
    const { data } = await supabase
      .from("risk_history")
      .select("risk_score, created_at")
      .order("created_at", { ascending: true })
      .limit(10);

    return data || [];
  }

  function renderChart(history) {
    const ctx = document.getElementById("riskChart");
    if (!ctx || typeof Chart === "undefined") return;

    const labels = history.map((h) =>
      h.created_at ? new Date(h.created_at).toLocaleDateString() : ""
    );
    const values = history.map((h) => h.risk_score);

    if (riskChart) riskChart.destroy();

    riskChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Risk Trend",
            data: values,
            borderColor: "#22c55e",
            backgroundColor: "rgba(34,197,94,0.2)",
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: {
              color: "#e5e7eb",
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#94a3b8" },
          },
          y: {
            ticks: { color: "#94a3b8" },
          },
        },
      },
    });
  }

  let lastReportText = "";

  function exportPDF(statsText) {
    if (!window.jspdf || typeof window.jspdf.jsPDF === "undefined") {
      console.error("jsPDF not loaded");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const date = new Date().toLocaleString();


    doc.setFontSize(16);
    doc.text("KHING AI Daily Operations Report", 10, 10);


    doc.setFontSize(10);
    doc.text(`Generated: ${date}`, 10, 18);

    doc.setFontSize(12);

    const lines = doc.splitTextToSize(String(statsText ?? ""), 180);
    doc.text(lines, 10, 30);

    doc.save(`mining-report-${Date.now()}.pdf`);
  }

  async function generateReport() {
    if (btn) btn.disabled = true;

    el.innerHTML = "🔄 Fetching live mining data from Supabase...";


    try {
      const data = await fetchData();
      const stats = analyze(data);

      const risk = await saveRisk(stats);
      const history = await fetchRiskHistory();

      // keep a small delay for “AI feel”
      await new Promise((r) => setTimeout(r, 800));

      lastReportText = generateReportText({ ...stats, riskLevel: risk.level });
      revealHTML(lastReportText, { typingSpeed: 8 });
      renderChart(history);

    } catch (e) {
      console.error(e);
      el.innerHTML =
        "⚠️ Could not generate report right now. Check console/logs and try Refresh.";
    } finally {
      if (btn) btn.disabled = false;
    }
  }



  const downloadBtn = document.getElementById("download-report");
  downloadBtn?.addEventListener("click", () => {
    exportPDF(lastReportText);
  });

  btn?.addEventListener("click", generateReport);

  // auto-run

  generateReport();
}


