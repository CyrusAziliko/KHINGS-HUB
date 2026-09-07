import { loadOverview } from "./overview.js";
import { loadCharts } from "./charts.js";
import { getActivityFeed } from "../services/adminDataService.js";
import { createActivityFeedTicketsSubscription } from "../realtime.js";

let activityTicketsUnsubscribe = null;
let activityTicketsInitialized = false;

function priorityColor(priority) {
  const p = (priority || "").toLowerCase().trim();
  if (p === "critical") return "#ef4444";
  if (p === "high") return "#f59e0b";
  if (p === "medium") return "#3b82f6";
  if (p === "low") return "#22c55e";
  return "";
}

async function loadActivityFeed() {
  const container = document.getElementById("activity-feed");
  if (!container) return;

  const activities = await getActivityFeed();
  const count = activities ? activities.length : 0;

  container.innerHTML = `
    <div class="actv-feed">
      <div class="actv-feed-header">
        <div class="actv-feed-header-left">
          <span class="actv-feed-icon">📋</span>
          <span class="actv-feed-title">Activity Feed</span>
          <span class="actv-feed-count">${count}</span>
        </div>
        <div class="actv-feed-header-right">
          <span class="actv-feed-live"></span>
          <span class="actv-feed-live-text">Live</span>
        </div>
      </div>
      <div class="actv-feed-list">
        ${
          count === 0
            ? `<div class="actv-feed-empty">
                 <div class="actv-feed-empty-icon">📭</div>
                 <h3>No Recent Activity</h3>
                 <p>Activity from tickets, work orders, users, and equipment will appear here.</p>
               </div>`
            : activities.map((item, idx) => `
                <div class="actv-item" style="animation-delay:${idx * 30}ms">
                  <div class="actv-item-icon-wrap actv-item-icon-wrap--${item.type}">
                    ${item.icon}
                  </div>
                  <div class="actv-item-body">
                    <div class="actv-item-title-row">
                      <strong class="actv-item-title">${item.title}</strong>
                      ${item.badge ? `<span class="actv-item-badge actv-item-badge--${item.badgeClass}">${item.badge} ${item.status}</span>` : ""}
                    </div>
                    <div class="actv-item-desc">${item.description}</div>
                    <div class="actv-item-meta">
                      <span class="actv-item-time">${item.relativeTime}</span>
                      ${item.priority ? `<span class="actv-item-pri" style="--pri-color:${priorityColor(item.priority)}">${item.priority}</span>` : ""}
                      <span class="actv-item-type">${item.type.replace("_", " ")}</span>
                    </div>
                  </div>
                </div>
              `).join("")
        }
      </div>
    </div>
  `;
}

function shouldHandleTicketEvent(payload) {
    const eventType = payload?.eventType || payload?.type;
    return eventType === "INSERT" || eventType === "UPDATE";
}

function startTicketActivityFeedRealtime() {
    if (activityTicketsInitialized) return () => {};
    activityTicketsInitialized = true;

    activityTicketsUnsubscribe = createActivityFeedTicketsSubscription({
        onAny: async (payload) => {
            try {
                if (!shouldHandleTicketEvent(payload)) return;
                await loadActivityFeed();
            } catch (e) {
                console.error(e);
            }
        }
    });

    return () => {
        try {
            activityTicketsUnsubscribe?.();
        } catch {}
        activityTicketsUnsubscribe = null;
        activityTicketsInitialized = false;
    };
}

export async function loadDashboard() {

    console.log("Admin dashboard loading...");


    await Promise.all([
        loadOverview(),
        loadCharts(),
    ]);


    await loadActivityFeed();
    startTicketActivityFeedRealtime();


    console.log("Admin dashboard ready");
}





export async function refreshAdminData() {

    await loadDashboard();
}

export function cleanupTicketActivityFeedRealtime() {
    if (!activityTicketsInitialized) return;
    try {
        activityTicketsUnsubscribe?.();
    } catch {}
    activityTicketsUnsubscribe = null;
    activityTicketsInitialized = false;
}
