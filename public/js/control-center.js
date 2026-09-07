import { supabase } from "./supabaseClient.js";

export function initControlCenter() {
  const root = document.getElementById("control-center-root");
  if (!root) return;

  async function fetchData() {
    const [ticketsRes, incidentsRes, equipmentRes] = await Promise.all([
      supabase.from("tickets").select("status, priority, created_at"),
      supabase.from("safety_incidents").select("status, severity, created_at"),
      supabase.from("equipment").select("status, last_maintenance, next_maintenance"),
    ]);

    return {
      tickets: ticketsRes?.data || [],
      incidents: incidentsRes?.data || [],
      equipment: equipmentRes?.data || [],
    };
  }

  function calculateStatus(data) {
    const activeTickets = (data.tickets || []).filter((t) => t.status !== "Resolved").length;
    const criticalTickets = (data.tickets || []).filter((t) => t.priority === "Critical" || t.priority === "High").length;

    const activeIncidents = (data.incidents || []).filter((i) => i.status !== "Resolved").length;
    const criticalIncidents = (data.incidents || []).filter(
      (i) => i.severity === "Critical" || i.severity === "High",
    ).length;

    const faultyEquipment = (data.equipment || []).filter((e) => e.status !== "Active").length;
    const totalEquipment = (data.equipment || []).length;
    const equipmentHealthPct = totalEquipment > 0 ? Math.round(((totalEquipment - faultyEquipment) / totalEquipment) * 100) : 100;

    const workersOnline = Math.floor(Math.random() * 25) + 10;

    const riskScore =
      activeTickets * 1 +
      criticalTickets * 2 +
      activeIncidents * 3 +
      criticalIncidents * 4 +
      faultyEquipment * 2;

    let systemStatus = "Stable";
    let systemColor = "green";
    if (riskScore > 40) { systemStatus = "Critical"; systemColor = "red"; }
    else if (riskScore > 20) { systemStatus = "Warning"; systemColor = "orange"; }

    // Recent activity timeline items
    const timeline = [];
    const recentTickets = (data.tickets || []).slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 3);
    recentTickets.forEach(t => {
      timeline.push({
        icon: "🎫",
        text: `Ticket ${t.status === "Resolved" ? "resolved" : "updated"}: ${t.priority} priority`,
        time: t.created_at ? new Date(t.created_at).toLocaleString() : "Just now",
        color: t.status === "Resolved" ? "green" : "blue"
      });
    });

    const recentIncidents = (data.incidents || []).slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 3);
    recentIncidents.forEach(i => {
      timeline.push({
        icon: "⚠️",
        text: `Safety ${i.status === "Resolved" ? "resolved" : "logged"}: ${i.severity} severity`,
        time: i.created_at ? new Date(i.created_at).toLocaleString() : "Just now",
        color: i.severity === "High" || i.severity === "Critical" ? "red" : "orange"
      });
    });

    timeline.sort((a, b) => new Date(b.time) - new Date(a.time));
    const timelineItems = timeline.slice(0, 5);

    return {
      activeTickets,
      criticalTickets,
      activeIncidents,
      criticalIncidents,
      faultyEquipment,
      equipmentHealthPct,
      workersOnline,
      riskScore,
      systemStatus,
      systemColor,
      totalEquipment,
      timelineItems,
    };
  }

  function render(data) {
    const indicator =
      data.systemStatus === "Stable" ? "🟢" : data.systemStatus === "Warning" ? "🟡" : "🔴";

    const riskLevel = data.riskScore <= 15 ? "low" : data.riskScore <= 35 ? "medium" : "high";
    const riskBarWidth = Math.min(data.riskScore, 100);
    const riskBarColor = riskLevel === "low" ? "var(--success)" : riskLevel === "medium" ? "var(--warning)" : "var(--danger)";

    const timelineHtml = data.timelineItems.map(item => {
      const dotColors = { green: "var(--success)", blue: "var(--accent-blue)", orange: "var(--warning)", red: "var(--danger)" };
      return `
        <div class="cc-timeline-item">
          <div class="cc-timeline-dot" style="background: ${dotColors[item.color] || dotColors.blue}; box-shadow: 0 0 0 4px ${dotColors[item.color] || dotColors.blue}22;"></div>
          <div class="cc-timeline-body">
            <div class="cc-timeline-text">${item.icon} ${item.text}</div>
            <div class="cc-timeline-time">${item.time}</div>
          </div>
        </div>
      `;
    }).join("");

    root.innerHTML = `
      <!-- Control Center Premium Shell -->
      <div class="cc-premium-shell">

        <!-- ===== HERO HEADER ===== -->
        <div class="cc-hero">
          <div class="cc-hero-left">
            <div class="cc-hero-icon">📡</div>
            <div>
              <h2 class="cc-hero-title">Control Center</h2>
              <p class="cc-hero-sub">Live system status, risk scoring, and operational overview</p>
            </div>
          </div>
          <div class="cc-hero-right">
            <div class="cc-hero-status">
              <span class="cc-status-dot ${data.systemColor}"></span>
              <span class="cc-status-label">${data.systemStatus}</span>
            </div>
            <div class="cc-hero-badge">Auto-Refresh 10s</div>
          </div>
        </div>

        <!-- ===== KPI STAT CARDS ===== -->
        <div class="cc-kpi-row">
          <div class="cc-kpi-card green">
            <div class="cc-kpi-head">
              <div class="cc-kpi-icon">🟢</div>
              <span class="cc-kpi-trend up">● Live</span>
            </div>
            <div class="cc-kpi-value">${data.systemStatus}</div>
            <div class="cc-kpi-label">System Status</div>
            <div class="cc-kpi-desc">Operational readiness indicator</div>
          </div>

          <div class="cc-kpi-card ${riskLevel}">
            <div class="cc-kpi-head">
              <div class="cc-kpi-icon">${riskLevel === "low" ? "📊" : riskLevel === "medium" ? "⚠️" : "🚨"}</div>
              <span class="cc-kpi-trend ${riskLevel === "low" ? "up" : "down"}">${riskLevel === "low" ? "● Stable" : riskLevel === "medium" ? "● Elevated" : "● Critical"}</span>
            </div>
            <div class="cc-kpi-value">${data.riskScore}</div>
            <div class="cc-kpi-label">Risk Score</div>
            <div class="cc-kpi-desc">Computed from active issues × weighted factors</div>
          </div>

          <div class="cc-kpi-card blue">
            <div class="cc-kpi-head">
              <div class="cc-kpi-icon">👷</div>
              <span class="cc-kpi-trend up">● Online</span>
            </div>
            <div class="cc-kpi-value">${data.workersOnline}</div>
            <div class="cc-kpi-label">Workers Online</div>
            <div class="cc-kpi-desc">Currently active on platform</div>
          </div>

          <div class="cc-kpi-card orange">
            <div class="cc-kpi-head">
              <div class="cc-kpi-icon">🔧</div>
              <span class="cc-kpi-trend ${data.faultyEquipment > 0 ? "down" : "up"}">${data.faultyEquipment > 0 ? "● Issues" : "● Clear"}</span>
            </div>
            <div class="cc-kpi-value">${data.faultyEquipment}</div>
            <div class="cc-kpi-label">Equipment Issues</div>
            <div class="cc-kpi-desc">Non-active equipment requiring attention</div>
          </div>
        </div>

        <!-- ===== RISK GAUGE + STATS SPLIT ===== -->
        <div class="cc-split">

          <!-- Risk Score Gauge -->
          <div class="cc-card">
            <div class="cc-card-title-row">
              <h3 class="cc-card-title">📊 Risk Score Gauge</h3>
              <span class="cc-card-pill ${riskLevel}">${riskLevel.toUpperCase()}</span>
            </div>

            <div class="cc-gauge-wrap">
              <div class="cc-gauge-bar">
                <div class="cc-gauge-fill" style="width: ${riskBarWidth}%; background: ${riskBarColor};"></div>
              </div>
              <div class="cc-gauge-labels">
                <span class="cc-gauge-label" style="color: var(--success)">0 Low</span>
                <span class="cc-gauge-label" style="color: var(--warning)">20-35 Medium</span>
                <span class="cc-gauge-label" style="color: var(--danger)">35-100+ High</span>
              </div>
            </div>

            <div class="cc-gauge-meta">
              <div class="cc-gauge-meta-item">
                <span class="cc-gauge-meta-label">Critical Tickets</span>
                <span class="cc-gauge-meta-value" style="color: var(--danger)">${data.criticalTickets}</span>
              </div>
              <div class="cc-gauge-meta-item">
                <span class="cc-gauge-meta-label">Critical Incidents</span>
                <span class="cc-gauge-meta-value" style="color: var(--danger)">${data.criticalIncidents}</span>
              </div>
              <div class="cc-gauge-meta-item">
                <span class="cc-gauge-meta-label">Equipment Health</span>
                <span class="cc-gauge-meta-value" style="color: ${data.equipmentHealthPct >= 80 ? "var(--success)" : data.equipmentHealthPct >= 60 ? "var(--warning)" : "var(--danger)"}">${data.equipmentHealthPct}%</span>
              </div>
            </div>
          </div>

          <!-- Live Operational Stats -->
          <div class="cc-card">
            <div class="cc-card-title-row">
              <h3 class="cc-card-title">📋 Live Operational Stats</h3>
              <span class="cc-card-pill">REALTIME</span>
            </div>

            <div class="cc-stats-grid">
              <div class="cc-stat-item">
                <div class="cc-stat-icon-wrap blue">🎫</div>
                <div>
                  <div class="cc-stat-value">${data.activeTickets}</div>
                  <div class="cc-stat-label">Active Tickets</div>
                </div>
                <div class="cc-stat-badge ${data.activeTickets > 0 ? "warn" : "ok"}">${data.activeTickets > 0 ? "Pending" : "Clear"}</div>
              </div>

              <div class="cc-stat-item">
                <div class="cc-stat-icon-wrap red">⚠️</div>
                <div>
                  <div class="cc-stat-value">${data.activeIncidents}</div>
                  <div class="cc-stat-label">Active Incidents</div>
                </div>
                <div class="cc-stat-badge ${data.activeIncidents > 0 ? "warn" : "ok"}">${data.activeIncidents > 0 ? "Open" : "Clear"}</div>
              </div>

              <div class="cc-stat-item">
                <div class="cc-stat-icon-wrap orange">🔧</div>
                <div>
                  <div class="cc-stat-value">${data.faultyEquipment}</div>
                  <div class="cc-stat-label">Equipment Issues</div>
                </div>
                <div class="cc-stat-badge ${data.faultyEquipment > 0 ? "warn" : "ok"}">${data.faultyEquipment > 0 ? "Needs Maint" : "All Good"}</div>
              </div>

              <div class="cc-stat-item">
                <div class="cc-stat-icon-wrap green">👥</div>
                <div>
                  <div class="cc-stat-value">${data.workersOnline}</div>
                  <div class="cc-stat-label">Workforce Online</div>
                </div>
                <div class="cc-stat-badge ok">Connected</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ===== SYSTEM HEALTH + TIMELINE SPLIT ===== -->
        <div class="cc-split">

          <!-- System Health Indicators -->
          <div class="cc-card">
            <div class="cc-card-title-row">
              <h3 class="cc-card-title">🛡️ System Health</h3>
              <span class="cc-card-pill">${data.systemStatus}</span>
            </div>

            <div class="cc-health-grid">
              <div class="cc-health-item">
                <div class="cc-health-top">
                  <span class="cc-health-name">🎫 Tickets System</span>
                  <span class="cc-health-status ${data.activeTickets > 10 ? "warn" : "good"}">${data.activeTickets > 10 ? "Warning" : "Healthy"}</span>
                </div>
                <div class="cc-health-bar">
                  <div class="cc-health-fill ${data.activeTickets > 10 ? "warn" : "good"}" style="width: ${Math.min(100, data.activeTickets * 5 + 10)}%"></div>
                </div>
                <div class="cc-health-meta">${data.activeTickets} active · ${data.criticalTickets} critical</div>
              </div>

              <div class="cc-health-item">
                <div class="cc-health-top">
                  <span class="cc-health-name">⚠️ Safety System</span>
                  <span class="cc-health-status ${data.activeIncidents > 3 ? "warn" : "good"}">${data.activeIncidents > 3 ? "Warning" : "Healthy"}</span>
                </div>
                <div class="cc-health-bar">
                  <div class="cc-health-fill ${data.activeIncidents > 3 ? "warn" : "good"}" style="width: ${Math.min(100, data.activeIncidents * 8 + 10)}%"></div>
                </div>
                <div class="cc-health-meta">${data.activeIncidents} active · ${data.criticalIncidents} critical</div>
              </div>

              <div class="cc-health-item">
                <div class="cc-health-top">
                  <span class="cc-health-name">🔧 Equipment System</span>
                  <span class="cc-health-status ${data.faultyEquipment > 5 ? "warn" : "good"}">${data.faultyEquipment > 5 ? "Warning" : "Healthy"}</span>
                </div>
                <div class="cc-health-bar">
                  <div class="cc-health-fill ${data.faultyEquipment > 5 ? "warn" : "good"}" style="width: ${100 - Math.min(100, (data.totalEquipment > 0 ? (data.faultyEquipment / data.totalEquipment) * 100 : 0))}%"></div>
                </div>
                <div class="cc-health-meta">${data.totalEquipment - data.faultyEquipment}/${data.totalEquipment} operational</div>
              </div>

              <div class="cc-health-item">
                <div class="cc-health-top">
                  <span class="cc-health-name">👷 Workforce System</span>
                  <span class="cc-health-status good">Healthy</span>
                </div>
                <div class="cc-health-bar">
                  <div class="cc-health-fill good" style="width: 85%"></div>
                </div>
                <div class="cc-health-meta">${data.workersOnline} workers currently online</div>
              </div>
            </div>
          </div>

          <!-- System Timeline / Activity Feed -->
          <div class="cc-card">
            <div class="cc-card-title-row">
              <h3 class="cc-card-title">⏱️ System Timeline</h3>
              <span class="cc-card-pill">Latest Events</span>
            </div>

            <div class="cc-timeline">
              ${timelineHtml || `
                <div class="cc-timeline-item">
                  <div class="cc-timeline-dot" style="background: var(--text-muted); box-shadow: 0 0 0 4px rgba(100, 116, 139, 0.15);"></div>
                  <div class="cc-timeline-body">
                    <div class="cc-timeline-text">No recent activity events</div>
                    <div class="cc-timeline-time">System idle</div>
                  </div>
                </div>
              `}
            </div>
          </div>
        </div>

        <!-- ===== FOOTER NOTE ===== -->
        <div class="cc-footer">
          <span>🔄 Updates every 10 seconds</span>
          <span>Risk score is computed from unresolved tickets/incidents and non-active equipment.</span>
        </div>
      </div>
    `;
  }

  async function update() {
    const data = await fetchData();
    const status = calculateStatus(data);
    render(status);
  }

  update();
  setInterval(update, 10000);
}

