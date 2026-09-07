import { supabase } from "./supabaseClient.js";
import { createAnnouncementsSubscription } from "./realtime.js";

function byDataAttr(attr) {
  return document.querySelector(`[${attr}]`);
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isOpenStatus(status) {
  const s = String(status || "");
  return ["Open", "Assigned", "Pending", "In Progress"].includes(s);
}

function isResolvedStatus(status) {
  const s = String(status || "");
  return ["Resolved", "Closed"].includes(s);
}

function setText(el, value) {
  if (!el) return;
  el.textContent = String(value ?? 0);
}

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user || null;
}

export async function initDashboard() {
  const welcomeEl = document.querySelector("[data-welcome-message]");
  const totalEl = byDataAttr("data-total-tickets");
  const openEl = byDataAttr("data-open-tickets");
  const resolvedEl = byDataAttr("data-resolved-tickets");
  const announcementsEl = byDataAttr("data-recent-announcements");

  if (!totalEl && !openEl && !resolvedEl && !announcementsEl && !welcomeEl) return;

  const user = await getCurrentUser();
  if (!user) {
    if (welcomeEl) welcomeEl.textContent = "Welcome";
    if (announcementsEl) announcementsEl.textContent = "Sign in to see dashboard data.";
    return;
  }

  // Welcome
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role, department")
.eq("id", user.id)
      .single();

    const name = profile?.full_name ? profile.full_name : null;

    // Header welcome message (existing)
    if (welcomeEl) {
      const first = name ? String(name).split(" ")[0] : null;
      welcomeEl.textContent = first ? `Welcome back, ${first}` : "Welcome back";
    }

    // Dashboard profile banner (new)
    const profileNameEl = document.querySelector("[data-profile-name]");
    const profileRoleEl = document.querySelector("[data-profile-role]");
    const profileDeptEl = document.querySelector("[data-profile-department]");

    if (profileNameEl) profileNameEl.textContent = name ? `Welcome Back, ${name}` : "Welcome Back";
    if (profileRoleEl) profileRoleEl.textContent = profile?.role || "Worker";
    if (profileDeptEl) profileDeptEl.textContent = profile?.department || "Department";
  } catch (e) {
    // ignore
  }

  async function loadTicketStats() {
    // We only count tickets assigned to this worker_id.
    const { data, error } = await supabase
      .from("tickets")
      .select("status")
      .eq("worker_id", user.id);

    if (error) throw error;

    const tickets = data || [];
    const total = tickets.length;
    const open = tickets.filter((t) => isOpenStatus(t.status)).length;
    const resolved = tickets.filter((t) => isResolvedStatus(t.status)).length;

    setText(totalEl, safeNumber(total));
    setText(openEl, safeNumber(open));
    setText(resolvedEl, safeNumber(resolved));
  }

  async function loadRecentAnnouncements() {
    if (!announcementsEl) return;

    announcementsEl.textContent = "Loading...";

    const { data, error } = await supabase
      .from("announcements")
      .select("title, message, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) throw error;

    const items = data || [];
    if (!items.length) {
      announcementsEl.textContent = "No announcements right now.";
      return;
    }

    announcementsEl.innerHTML = (items || []).map((a) => {
      const title = a.title ? String(a.title) : "Announcement";
      const msg = a.message ? String(a.message) : "";
      const when = a.created_at ? new Date(a.created_at).toLocaleString() : "";
      return `
        <div style="margin-bottom:10px">
          <div style="font-weight:800; color:var(--text)">${title}</div>
          <div class="muted" style="font-size:12.5px; margin-top:2px; white-space:pre-wrap">${msg}</div>
          ${when ? `<div class="muted" style="font-size:11.5px; margin-top:4px">${when}</div>` : ""}
        </div>
      `;
    }).join("");
  }

  // Initial load
  await Promise.allSettled([
    loadTicketStats(),
    loadRecentAnnouncements(),
  ]);

  // Realtime: announcements
  const unsubscribeAnnouncements = createAnnouncementsSubscription({
    onInsert: async () => {
      try { await loadRecentAnnouncements(); } catch (e) { console.error(e); }
    },
    onUpdate: async () => {
      try { await loadRecentAnnouncements(); } catch (e) { console.error(e); }
    }
  });

  // Realtime: tickets stats update (simple reload)
  // Reuse existing tickets subscription pattern from realtime.js.
  // We avoid adding a hard dependency to tickets.js; instead we subscribe here.
  const channel = supabase
    .channel("ticket-stats")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tickets" },
      async () => {
        try { await loadTicketStats(); } catch (e) { console.error(e); }
      }
    )
    .subscribe();

  // Cleanup not wired because dashboard.js initDashboard is fire-and-forget.
  // However, the app life-cycle is single-page; this is acceptable.
  return () => {
    try { supabase.removeChannel(channel); } catch {}
    try { unsubscribeAnnouncements?.(); } catch {}
  };
}




