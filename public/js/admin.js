import { requireAdmin } from "./adminGuard.js";
import { supabase } from "./supabaseClient.js";


/**
 * Update profile picture & name in sidebar and enterprise topbar
 * after admin is authenticated.
 */
function renderAdminProfilePic(profile) {
  // ── Sidebar profile ──
  const sidebarAvatar = document.querySelector(".sidebar-profile .avatar");
  const sidebarName = document.querySelector(".sidebar-profile h4");
  const sidebarRole = document.querySelector(".sidebar-profile p");

  if (sidebarAvatar) {
    if (profile?.avatar_url) {
      sidebarAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="Admin avatar" />`;
    } else {
      sidebarAvatar.textContent = "👤";
    }
  }
  if (sidebarName) {
    sidebarName.textContent = profile?.full_name || "Administrator";
  }
  if (sidebarRole) {
    sidebarRole.textContent = profile?.department || "Mining Operations";
  }

  // ── Enterprise topbar user section ──
  const topbarAvatar = document.querySelector(".enterprise-topbar-user .avatar");
  const topbarName = document.querySelector(".enterprise-topbar-user .name");
  const topbarRole = document.querySelector(".enterprise-topbar-user .role");

  if (topbarAvatar) {
    if (profile?.avatar_url) {
      topbarAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="Admin avatar" />`;
    } else {
      topbarAvatar.textContent = "👤";
    }
  }
  if (topbarName) {
    topbarName.textContent = profile?.full_name || "Administrator";
  }
  if (topbarRole) {
    topbarRole.textContent = profile?.department || "Mining Operations";
  }

  // ── Greeting header ──
  const greeting = document.querySelector(".enterprise-topbar-greeting h1");
  if (greeting) {
    const displayName = profile?.full_name || "Admin";
    greeting.textContent = `Good Morning, ${displayName}`;
  }
}


import { loadWorkforce } from "./admin-modules/workforce.js";
import { loadEquipment } from "./admin-modules/equipment.js";
import { loadSafety } from "./admin-modules/safety.js";
import { loadScheduling } from "./admin-modules/scheduling.js";
import { loadAnalyticsModule } from "./admin-modules/analytics.js";
import { loadKhingbotModule } from "./admin-modules/khingbot.js";
import { loadSettingsModule } from "./admin-modules/settings.js";
import { loadAdminTicketsModule } from "./admin-modules/tickets.js";
import { loadReports } from "./admin-modules/reports.js";
import { loadUsers } from "./admin-modules/users.js";
import { initWorkOrders } from "./admin-modules/work-orders-ui.js";






















import { showPanel, setupNavigation } from "./admin-core/navigation.js";
import { setupLogout } from "./admin-core/logout.js";
import { loadDashboard, refreshAdminData, cleanupTicketActivityFeedRealtime } from "./admin-core/dashboard.js";
import { loadCharts } from "./admin-core/charts.js";


import { initAIIntelligenceCenter } from "./ai-intelligence.js";
import { initAIPredictionEngine } from "./ai-prediction-engine.js";

import { initNotificationsPanel, cleanupNotifications } from "./notifications.js";









/*
====================================
 TICKETS
====================================
*/



/*
====================================
 USERS
====================================
*/














/*
====================================
 MODULE LOADER
====================================
*/


async function loadModule(view){


switch(view){


case "dashboard":

await loadDashboard();
await initWorkOrders();

break;



case "tickets":

await loadAdminTicketsModule();

break;



case "users":

await loadUsers();

break;



case "analytics":

await loadAnalyticsModule();

break;





case "workforce":

await loadWorkforce();

break;



case "equipment":

await loadEquipment();

break;




case "safety":

await loadSafety();

break;




case "scheduling":

await loadScheduling();

break;




case "reports":

await loadReports();

break;



case "ai":
case "ai-center":

await initAIIntelligenceCenter();
await initAIPredictionEngine();

console.log(
"AI Center ready"
);

break;




case "control-center":

console.log(
"Control Center ready"
);

break;



case "settings":

await loadSettingsModule();

break;




case "khingbot":

await loadKhingbotModule();

break;






default:

console.log(
view,
"not implemented"
);


}


}





/*
====================================
 INITIALIZE
====================================
*/


document.addEventListener(
"DOMContentLoaded",
async()=>{


const allowed = await requireAdmin();


if(!allowed){

    return;
}


// Render admin profile picture and name in sidebar/topbar
renderAdminProfilePic(window.currentAdmin);


setupNavigation(loadModule);

setupLogout();



// Cleanup realtime subscriptions on reload/unload to prevent duplicate listeners.
window.addEventListener("beforeunload", () => {

    try {
        cleanupTicketActivityFeedRealtime();
        cleanupNotifications();
    } catch {}

});

// Initialize notifications panel
await initNotificationsPanel();

await refreshAdminData();



});
