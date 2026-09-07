import { supabase } from "../../supabaseClient.js";

/**
 * KHING AI - Operational Metrics Engine
 * 
 * Fetches enterprise-wide operational data from Supabase
 * and returns a normalized metrics object for the AI engine.
 */

export async function fetchOperationalMetrics() {
  console.log("[AI Engine] Fetching operational metrics...");

  try {
    // Fetch all data sources in parallel
    const [
      profilesRes,
      workersRes,
      ticketsRes,
      incidentsRes,
      equipmentRes,
      notificationsRes,
    ] = await Promise.allSettled([
      supabase.from("profiles").select("id, role, department, status"),
      supabase.from("workers").select("id, department, status, availability"),
      supabase.from("tickets").select("id, status, priority, category, created_at, assigned_to"),
      supabase.from("safety_incidents").select("id, status, severity, created_at"),
      supabase.from("equipment").select("id, status, condition"),
      supabase.from("notifications").select("id, read_status"),
    ]);

    // Safely extract data
    const profiles = profilesRes.status === "fulfilled" ? profilesRes.value?.data || [] : [];
    const workers = workersRes.status === "fulfilled" ? workersRes.value?.data || [] : [];
    const tickets = ticketsRes.status === "fulfilled" ? ticketsRes.value?.data || [] : [];
    const incidents = incidentsRes.status === "fulfilled" ? incidentsRes.value?.data || [] : [];
    const equipment = equipmentRes.status === "fulfilled" ? equipmentRes.value?.data || [] : [];
    const notifications = notificationsRes.status === "fulfilled" ? notificationsRes.value?.data || [] : [];

    // ── Compute metrics ─────────────────────────────────
    
    // Workers
    const totalWorkers = workers.length;
    const activeWorkers = workers.filter(w => w.status === "active").length;
    const departmentDistribution = {};
    workers.forEach(w => {
      if (w.department) {
        departmentDistribution[w.department] = (departmentDistribution[w.department] || 0) + 1;
      }
    });

    // Work Orders (tickets as work orders proxy)
    const totalWorkOrders = tickets.length;
    const openWorkOrders = tickets.filter(t => t.status === "Open").length;
    const inProgressWorkOrders = tickets.filter(t => t.status === "In Progress").length;
    const resolvedWorkOrders = tickets.filter(t => t.status === "Resolved" || t.status === "Closed").length;
    
    // Count overdue (no due_date on tickets, but we can estimate by high/critical priority and age)
    const highPriorityOrders = tickets.filter(
      t => t.priority === "High" || t.priority === "Critical"
    ).length;
    
    // Assigned vs unassigned
    const assignedOrders = tickets.filter(t => t.assigned_to).length;
    const unassignedOrders = tickets.filter(t => !t.assigned_to).length;

    // Safety Incidents
    const totalIncidents = incidents.length;
    const criticalIncidents = incidents.filter(
      i => i.severity === "Critical" || i.severity === "High"
    ).length;
    const openIncidents = incidents.filter(i => i.status === "Open" || i.status === "In Progress").length;
    const resolvedIncidents = incidents.filter(i => i.status === "Resolved").length;

    // Equipment
    const totalEquipment = equipment.length;
    const operationalEquipment = equipment.filter(e => e.status === "Active" || e.status === "available").length;
    const maintenanceEquipment = equipment.filter(e => e.status === "maintenance" || e.condition === "needs_repair").length;
    const offlineEquipment = equipment.filter(e => e.status === "offline").length;

    // Tickets (support tickets)
    const totalTickets = tickets.length;
    const pendingTickets = tickets.filter(t => t.status !== "Resolved" && t.status !== "Closed").length;
    const resolvedTickets = resolvedWorkOrders;

    // Notifications
    const totalNotifications = notifications.length;
    const unreadNotifications = notifications.filter(n => !n.read_status).length;

    // Profiles
    const adminProfiles = profiles.filter(p => p.role === "admin").length;
    const workerProfiles = profiles.filter(p => p.role === "worker").length;
    const supervisorProfiles = profiles.filter(p => p.role === "supervisor").length;

    const metrics = {
      // Timestamp
      collected_at: new Date().toISOString(),

      // Workers
      workers: {
        total: totalWorkers,
        active: activeWorkers,
        departments: departmentDistribution,
      },

      // Work Orders (tickets as work orders)
      workOrders: {
        total: totalWorkOrders,
        open: openWorkOrders,
        inProgress: inProgressWorkOrders,
        completed: resolvedWorkOrders,
        highPriority: highPriorityOrders,
        assigned: assignedOrders,
        unassigned: unassignedOrders,
        overdue: highPriorityOrders, // proxy for overdue
      },

      // Safety Incidents
      safety: {
        total: totalIncidents,
        critical: criticalIncidents,
        open: openIncidents,
        resolved: resolvedIncidents,
      },

      // Equipment
      equipment: {
        total: totalEquipment,
        operational: operationalEquipment,
        maintenance: maintenanceEquipment,
        offline: offlineEquipment,
      },

      // Tickets (support)
      tickets: {
        total: totalTickets,
        pending: pendingTickets,
        resolved: resolvedTickets,
      },

      // Notifications
      notifications: {
        total: totalNotifications,
        unread: unreadNotifications,
      },

      // Profiles
      profiles: {
        total: profiles.length,
        admins: adminProfiles,
        workers: workerProfiles,
        supervisors: supervisorProfiles,
      },
    };

    console.log("[AI Engine] Metrics collected:", metrics);
    return metrics;

  } catch (error) {
    console.error("[AI Engine] Error fetching metrics:", error);
    throw new Error("Failed to collect operational metrics: " + error.message);
  }
}
