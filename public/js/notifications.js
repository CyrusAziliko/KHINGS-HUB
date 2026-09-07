import { supabase } from "./supabaseClient.js";
import { createNotificationsSubscription } from "./realtime.js";

function byId(id) { return document.getElementById(id); }

let notifDropdownOpen = false;
let notifUnsubscribe = null;

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 0) return "just now";
  if (diffSec < 60) return diffSec + "s ago";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return diffMin + "m ago";
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return diffHr + "h ago";
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return diffDay + "d ago";
  return new Date(dateStr).toLocaleDateString();
}

function closeDropdown() {
  const dropdown = byId("notifications-dropdown");
  if (!dropdown) return;
  dropdown.classList.remove("open");
  notifDropdownOpen = false;
}

function openDropdown() {
  const dropdown = byId("notifications-dropdown");
  if (!dropdown) return;
  dropdown.classList.add("open");
  notifDropdownOpen = true;
}

function toggleDropdown(e) {
  e.stopPropagation();
  if (notifDropdownOpen) {
    closeDropdown();
  } else {
    openDropdown();
    loadNotifications();
  }
}

function handleClickOutside(e) {
  const dropdown = byId("notifications-dropdown");
  const bellBtn = byId("notif-bell-btn");
  if (!dropdown || !bellBtn) return;
  if (!dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
    closeDropdown();
  }
}

function renderNotifications(data) {
  const list = byId("notifications-list");
  const badge = byId("notifications-badge");
  if (!list) return;

  const unread = (data || []).filter((n) => !n.read_status).length;
  if (badge) badge.textContent = String(unread);

  if (!data || data.length === 0) {
    list.innerHTML = '<div class="notif-dropdown-empty">No notifications yet</div>';
    return;
  }

  list.innerHTML = data.map((n) => `
    <div class="notif-dropdown-item ${n.read_status ? "read" : "unread"}">
      <div class="notif-dropdown-item-dot ${n.read_status ? "read" : "unread"}"></div>
      <div class="notif-dropdown-item-body">
        <div class="notif-dropdown-item-msg">${escapeHtml(n.message || "No message")}</div>
        <div class="notif-dropdown-item-time">${formatTime(n.created_at)}</div>
      </div>
    </div>
  `).join("");
}

async function loadNotifications() {
  const list = byId("notifications-list");
  if (!list) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data, error } = await supabase
    .from("notifications")
    .select("id,message,read_status,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Error loading notifications:", error);
    return;
  }

  renderNotifications(data);
}

async function setupMarkAllRead() {
  const markAll = document.querySelector("[data-mark-notifications-all]");
  if (!markAll) return;

  // Replace with clone to remove stale listeners
  const newMarkAll = markAll.cloneNode(true);
  markAll.parentNode.replaceChild(newMarkAll, markAll);

  newMarkAll.addEventListener("click", async (e) => {
    e.stopPropagation();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read_status: true })
      .eq("user_id", user.id)
      .eq("read_status", false);
    if (error) console.error("Error marking all as read:", error);
    await loadNotifications();
  });
}

export async function initNotificationsPanel() {
  // Check if bell button exists on this page
  const bellBtn = byId("notif-bell-btn");
  if (!bellBtn) return;

  // Cleanup previous instance
  if (notifUnsubscribe) {
    notifUnsubscribe();
    notifUnsubscribe = null;
  }
  document.removeEventListener("click", handleClickOutside);

  // Load initial notifications
  await loadNotifications();
  await setupMarkAllRead();

  // Set up real-time subscription
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    notifUnsubscribe = createNotificationsSubscription({
      userId: user.id,
      onInsert: async () => {
        try {
          await loadNotifications();
          await setupMarkAllRead();
        } catch (e) {
          console.error(e);
        }
      }
    });
  }

  // Set up toggle listener (remove stale then add fresh)
  const newBell = bellBtn.cloneNode(true);
  bellBtn.parentNode.replaceChild(newBell, bellBtn);
  newBell.addEventListener("click", toggleDropdown);

  // Click outside to close
  document.addEventListener("click", handleClickOutside);
}

export function cleanupNotifications() {
  if (notifUnsubscribe) {
    notifUnsubscribe();
    notifUnsubscribe = null;
  }
  document.removeEventListener("click", handleClickOutside);
  closeDropdown();
}

