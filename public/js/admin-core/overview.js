import { supabase } from "../supabaseClient.js";

export async function loadOverview() {
  const setKpiText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  // Loading states
  setKpiText("kpi-workers", "Loading...");
  setKpiText("totalUsers", "Loading...");
  setKpiText("totalTickets", "Loading...");
  setKpiText("openTickets", "Loading...");
  setKpiText("resolvedTickets", "Loading...");

  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  // Workers (profiles.role === 'worker')
  let workersCount = null;
  try {
    const { count, error } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "worker");
    if (error) throw error;
    workersCount = count ?? 0;
    setValue("kpi-workers", workersCount);
  } catch (err) {
    console.error("Failed to load workers KPI:", err);
    setValue("kpi-workers", "Error");
  }

  // Users (all profiles)
  try {
    const { count, error } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    const usersCount = count ?? 0;
    setValue("totalUsers", usersCount);
  } catch (err) {
    console.error("Failed to load users KPI:", err);
    setValue("totalUsers", "Error");
  }

  // Tickets (all tickets)
  let totalTicketsCount = null;
  try {
    const { count, error } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    totalTicketsCount = count ?? 0;
    setValue("totalTickets", totalTicketsCount);
  } catch (err) {
    console.error("Failed to load tickets KPI:", err);
    setValue("totalTickets", "Error");
  }

  // Resolved (tickets.status === 'resolved')
  let resolvedTicketsCount = null;
  try {
    const { count, error } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("status", "resolved");
    if (error) throw error;
    resolvedTicketsCount = count ?? 0;
    setValue("resolvedTickets", resolvedTicketsCount);
  } catch (err) {
    console.error("Failed to load resolved tickets KPI:", err);
    setValue("resolvedTickets", "Error");
  }

  // Open (tickets.status !== 'resolved')
  try {
    const { count, error } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .neq("status", "resolved");
    if (error) throw error;
    const openTicketsCount = count ?? 0;
    setValue("openTickets", openTicketsCount);
  } catch (err) {
    console.error("Failed to load open tickets KPI:", err);
    setValue("openTickets", "Error");
  }

  // Continue existing non-KPI overview logic (equipment/safety/etc.)
  try {
    const [
      equipment,
      safety,
      _notifications,
    ] = await Promise.all([
      supabase.from("equipment").select("*", { count: "exact", head: true }),
      supabase
        .from("safety_incidents")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true }),
    ]);

    // These KPIs are not part of your phase-4.1 requirements but are used by the existing dashboard.
    setValue("kpi-equipment-card", equipment.count ?? 0);
    setValue("kpi-incidents", safety.count ?? 0);

    // Keep open-backlog derived from openTickets if available.
    // If openTickets failed (set to "Error"), fall back to 0.
    const openTicketsElValue = document.getElementById("openTickets")?.textContent;
    const openTicketsNum = openTicketsElValue === "Error" || !openTicketsElValue ? 0 : Number(openTicketsElValue) || 0;
    setValue("kpi-open-backlog", openTicketsNum);

    // SLA = Resolved / Total * 100 (rounded)
    const totalTickets = typeof totalTicketsCount === "number" ? totalTicketsCount : 0;
    const resolvedCount = typeof resolvedTicketsCount === "number" ? resolvedTicketsCount : 0;

    if (totalTickets > 0) {
      const slaPercent = Math.round((resolvedCount / totalTickets) * 100);
      setValue("kpi-sla", `${slaPercent}%`);
    } else {
      setValue("kpi-sla", "N/A");
    }

    // Production = Active Equipment / Total Equipment * 100 (rounded)
    const totalEquipment = equipment.count ?? 0;

    const tryCount = async (query) => {
      const res = await query;
      return res.count ?? 0;
    };

    let activeEquipmentCount = null;
    if (totalEquipment > 0) {
      try {
        activeEquipmentCount = await tryCount(
          supabase
            .from("equipment")
            .select("*", { count: "exact", head: true })
            .eq("status", "Active"),
        );
      } catch (e1) {
        try {
          activeEquipmentCount = await tryCount(
            supabase
              .from("equipment")
              .select("*", { count: "exact", head: true })
              .eq("is_active", true),
          );
        } catch (e2) {
          try {
            activeEquipmentCount = await tryCount(
              supabase
                .from("equipment")
                .select("*", { count: "exact", head: true })
                .eq("active", true),
            );
          } catch (e3) {
            activeEquipmentCount = null;
          }
        }
      }
    }

    if (activeEquipmentCount === null || totalEquipment === 0) {
      setValue("kpi-production", "N/A");
      setValue("hero-efficiency", "N/A Efficiency");
    } else {
      const productionPercent = Math.round(
        (activeEquipmentCount / totalEquipment) * 100,
      );
      setValue("kpi-production", `${productionPercent}%`);
      setValue("hero-efficiency", `${productionPercent}% Efficiency`);
    }

    // Safety Reviews = <open safety incidents> Pending Safety Reviews
    let openSafetyIncidentsCount = null;
    try {
      openSafetyIncidentsCount = await tryCount(
        supabase
          .from("safety_incidents")
          .select("*", { count: "exact", head: true })
          .eq("status", "Open"),
      );
    } catch (e1) {
      try {
        openSafetyIncidentsCount = await tryCount(
          supabase
            .from("safety_incidents")
            .select("*", { count: "exact", head: true })
            .eq("status", "Pending"),
        );
      } catch (e2) {
        openSafetyIncidentsCount = null;
      }
    }

    if (openSafetyIncidentsCount === null) {
      setValue("hero-safety-reviews", "N/A Pending Safety Reviews");
    } else {
      setValue(
        "hero-safety-reviews",
        `${openSafetyIncidentsCount} Pending Safety Reviews`,
      );
    }
  } catch (err) {
    console.error("Dashboard overview failed:", err);
  }
}



