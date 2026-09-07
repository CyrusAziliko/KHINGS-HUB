import { supabase } from "../supabaseClient.js";

export async function getDashboardStats() {
  const [tickets, openTickets, resolvedTickets, workers, users] =
    await Promise.all([
      supabase
        .from("tickets")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),

      supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "resolved"),

      supabase
        .from("workers")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true }),
    ]);

  return {
    totalTickets: tickets.count ?? 0,
    openTickets: openTickets.count ?? 0,
    resolvedTickets: resolvedTickets.count ?? 0,
    totalWorkers: workers.count ?? 0,
    totalUsers: users.count ?? 0,
  };
}

export async function getRecentTickets() {
  const { data, error } = await supabase
    .from("tickets")
    .select(`
        id,
        ticket_number,
        title,
        status,
        priority,
        created_at
    `)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data;
}

function getRelativeTime(dateStr) {
  if (!dateStr) return "—";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return "—";
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 0) return "just now";
  if (diffSec < 60) return diffSec + "s ago";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return diffMin + "m ago";
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return diffHr + "h ago";
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return diffDay + "d ago";
  return new Date(dateStr).toLocaleDateString();
}

function statusIcon(status) {
  const s = (status || "").toLowerCase().trim();
  if (s === "open" || s === "pending") return "🟡";
  if (s === "in_progress" || s === "in progress") return "🔵";
  if (s === "resolved" || s === "completed") return "🟢";
  if (s === "closed") return "⚪";
  return "🟡";
}

function statusClass(status) {
  const s = (status || "").toLowerCase().trim();
  if (s === "open" || s === "pending") return "open";
  if (s === "in_progress" || s === "in progress") return "in_progress";
  if (s === "resolved" || s === "completed") return "resolved";
  if (s === "closed") return "closed";
  return "open";
}

export async function getActivityFeed() {
  const activities = [];

  // 1. Tickets (last 10)
  try {
    const { data: tickets } = await supabase
      .from("tickets")
      .select("id,title,status,priority,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(10);

    (tickets || []).forEach((t) => {
      activities.push({
        type: "ticket",
        icon: "🎫",
        title: t.title || "Untitled Ticket",
        description: `Status changed to ${t.status}`,
        status: t.status,
        priority: t.priority,
        time: t.updated_at || t.created_at,
        relativeTime: getRelativeTime(t.updated_at || t.created_at),
        badge: statusIcon(t.status),
        badgeClass: statusClass(t.status),
      });
    });
  } catch (e) {
    console.warn("activity: tickets fetch failed", e);
  }

  // 2. Work Orders (last 8)
  try {
    const { data: workOrders } = await supabase
      .from("work_orders")
      .select("id,title,status,priority,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(8);

    (workOrders || []).forEach((wo) => {
      activities.push({
        type: "work_order",
        icon: "📋",
        title: wo.title || "Work Order",
        description: `Status: ${wo.status}`,
        status: wo.status,
        priority: wo.priority,
        time: wo.updated_at || wo.created_at,
        relativeTime: getRelativeTime(wo.updated_at || wo.created_at),
        badge: statusIcon(wo.status),
        badgeClass: statusClass(wo.status),
      });
    });
  } catch (e) {
    console.warn("activity: work_orders fetch failed", e);
  }

  // 3. New Users / Profiles (last 8)
  try {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,full_name,role,created_at")
      .order("created_at", { ascending: false })
      .limit(8);

    (profiles || []).forEach((p) => {
      activities.push({
        type: "user",
        icon: "👤",
        title: p.full_name || "New User",
        description: `Registered as ${p.role || "user"}`,
        status: "active",
        priority: null,
        time: p.created_at,
        relativeTime: getRelativeTime(p.created_at),
        badge: "🟢",
        badgeClass: "resolved",
      });
    });
  } catch (e) {
    console.warn("activity: profiles fetch failed", e);
  }

  // 4. Equipment changes (last 8)
  try {
    const { data: equipment } = await supabase
      .from("equipment")
      .select("id,name,status,updated_at,created_at")
      .order("updated_at", { ascending: false })
      .limit(8);

    (equipment || []).forEach((eq) => {
      activities.push({
        type: "equipment",
        icon: "🚜",
        title: eq.name || "Equipment",
        description: `Status: ${eq.status}`,
        status: eq.status,
        priority: null,
        time: eq.updated_at || eq.created_at,
        relativeTime: getRelativeTime(eq.updated_at || eq.created_at),
        badge: eq.status === "Active" ? "🟢" : eq.status === "Maintenance" ? "🟡" : "🔴",
        badgeClass: eq.status === "Active" ? "resolved" : eq.status === "Maintenance" ? "open" : "closed",
      });
    });
  } catch (e) {
    console.warn("activity: equipment fetch failed", e);
  }

  // Sort all activities by time descending, limit to 20
  activities.sort((a, b) => {
    const ta = a.time ? new Date(a.time).getTime() : 0;
    const tb = b.time ? new Date(b.time).getTime() : 0;
    return tb - ta;
  });

  return activities.slice(0, 20);
}

export async function getWorkers() {
  const { data, error } = await supabase
    .from("workers")
    .select(`
        id,
        full_name,
        position,
        department,
        status
    `)
    .order("full_name");

  if (error) throw error;
  return data;
}

